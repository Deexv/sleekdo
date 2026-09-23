import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AgentAdapter, AgentConfig, AgentEvent, AgentSession } from './agent-adapter.js';

export function resolveBinary(cmd: string): { command: string; extraArgs: string[] } {
  if (process.platform !== 'win32') {
    return { command: cmd, extraArgs: [] };
  }

  const ext = path.extname(cmd).toLowerCase();
  const pathext = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').map((x) => x.toLowerCase());
  const pathDirs = (process.env.PATH || '').split(path.delimiter);

  function checkExts(base: string): string | null {
    if (ext) {
      if (fs.existsSync(base)) return base;
      return null;
    }
    for (const e of pathext) {
      const full = base + e;
      if (fs.existsSync(full)) return full;
    }
    return null;
  }

  let resolved: string | null = null;
  if (cmd.includes('/') || cmd.includes('\\')) {
    resolved = checkExts(cmd);
  } else {
    for (const d of pathDirs) {
      if (!d) continue;
      const target = checkExts(path.join(d, cmd));
      if (target) {
        resolved = target;
        break;
      }
    }
  }

  if (!resolved) {
    return { command: cmd, extraArgs: [] };
  }

  const resolvedExt = path.extname(resolved).toLowerCase();
  if (resolvedExt === '.exe' || resolvedExt === '.com') {
    return { command: resolved, extraArgs: [] };
  }

  if (resolvedExt === '.cmd' || resolvedExt === '.bat') {
    try {
      const content = fs.readFileSync(resolved, 'utf8');
      const match = content.match(/"([^"]+\.js)"/i);
      if (match) {
        const dp0 = path.dirname(resolved);
        const jsRel = match[1].replace(/%~?dp0%?\\/gi, '');
        const jsPath = path.resolve(dp0, jsRel);
        if (fs.existsSync(jsPath)) {
          return { command: process.execPath, extraArgs: [jsPath] };
        }
      }
    } catch {
      // Fallback to unresolved binary
    }
  }

  return { command: resolved, extraArgs: [] };
}

export class GenericPTYAdapter implements AgentAdapter {
  public readonly name = 'GenericPTYAdapter';
  private readonly defaultCommand: string;
  private readonly defaultArgs: string[];
  private readonly active = new Map<string, { process: ChildProcess; emitter: EventEmitter; completed: boolean }>();

  constructor(defaultCommand = 'claude', defaultArgs: string[] = ['-p', '{prompt}']) {
    this.defaultCommand = defaultCommand;
    this.defaultArgs = defaultArgs;
  }

  public async start(config: AgentConfig): Promise<AgentSession> {
    const id = `pty_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.active.set(id, {
      process: null as any,
      emitter: new EventEmitter(),
      completed: false,
    });
    return {
      id,
      config,
      startTime: Date.now(),
      isAlive: true,
    };
  }

  public async send(session: AgentSession, input: string): Promise<void> {
    let state = this.active.get(session.id);
    if (!state) {
      state = { process: null as any, emitter: new EventEmitter(), completed: false };
      this.active.set(session.id, state);
    }
    state.completed = false;
    const emitter = state.emitter;
    const cmd = session.config.model || this.defaultCommand;

    // Substitute prompt template placeholder
    const hasPlaceholder = this.defaultArgs.some((a) => a.includes('{prompt}'));
    let args: string[];
    if (hasPlaceholder) {
      args = this.defaultArgs.map((arg) => (arg === '{prompt}' ? input : arg.replace('{prompt}', input)));
    } else {
      args = [...this.defaultArgs, input];
    }

    const { command, extraArgs } = resolveBinary(cmd);
    const finalArgs = [...extraArgs, ...args];

    const child = spawn(command, finalArgs, {
      cwd: session.config.workspaceDir,
      env: { ...process.env, ...session.config.env },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    state.process = child;

    child.on('error', (err) => {
      emitter.emit('event', {
        type: 'message',
        timestamp: Date.now(),
        data: { stderr: err.message },
      } as AgentEvent);
      state.completed = true;
      session.isAlive = false;
      emitter.emit('event', {
        type: 'session_completed',
        timestamp: Date.now(),
        data: { exitCode: 1, error: err.message },
      } as AgentEvent);
    });

    emitter.emit('event', {
      type: 'session_started',
      timestamp: Date.now(),
      data: { sessionId: session.id },
    } as AgentEvent);

    let rawOutput = '';

    child.stdout?.on('data', (d) => {
      const text = d.toString();
      rawOutput += text;
      emitter.emit('event', {
        type: 'message',
        timestamp: Date.now(),
        data: { text },
      } as AgentEvent);
    });

    child.stderr?.on('data', (d) => {
      emitter.emit('event', {
        type: 'message',
        timestamp: Date.now(),
        data: { stderr: d.toString() },
      } as AgentEvent);
    });

    child.on('close', (code) => {
      if (state.completed) return;
      state.completed = true;
      session.isAlive = false;
      emitter.emit('event', {
        type: 'turn_completed',
        timestamp: Date.now(),
        data: { exitCode: code, rawOutput },
      } as AgentEvent);
      emitter.emit('event', {
        type: 'session_completed',
        timestamp: Date.now(),
        data: { exitCode: code },
      } as AgentEvent);
    });
  }

  public async interrupt(session: AgentSession): Promise<void> {
    const state = this.active.get(session.id);
    if (state) {
      state.process.kill('SIGINT');
    }
  }

  public async stop(session: AgentSession): Promise<void> {
    const state = this.active.get(session.id);
    if (state) {
      state.process.kill('SIGKILL');
      this.active.delete(session.id);
    }
    session.isAlive = false;
  }

  public async isAlive(session: AgentSession): Promise<boolean> {
    return this.active.get(session.id)?.completed === false;
  }

  public async *events(session: AgentSession): AsyncIterable<AgentEvent> {
    const state = this.active.get(session.id);
    if (!state) return;

    const queue: AgentEvent[] = [];
    let resolveNext: (() => void) | null = null;
    let done = false;

    const listener = (event: AgentEvent) => {
      queue.push(event);
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
      if (event.type === 'session_completed') {
        done = true;
      }
    };

    state.emitter.on('event', listener);

    try {
      while (!done || queue.length > 0) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else if (!done) {
          await new Promise<void>((resolve) => {
            resolveNext = resolve;
          });
        }
      }
    } finally {
      state.emitter.off('event', listener);
    }
  }

  public async detectTurnCompletion(session: AgentSession): Promise<boolean> {
    return this.active.get(session.id)?.completed || false;
  }
}

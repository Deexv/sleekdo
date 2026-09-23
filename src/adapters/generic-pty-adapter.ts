import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { AgentAdapter, AgentConfig, AgentEvent, AgentSession } from './agent-adapter.js';

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
    return {
      id,
      config,
      startTime: Date.now(),
      isAlive: true,
    };
  }

  public async send(session: AgentSession, input: string): Promise<void> {
    const emitter = new EventEmitter();
    const cmd = session.config.model || this.defaultCommand;

    // Substitute prompt template placeholder
    const hasPlaceholder = this.defaultArgs.some((a) => a.includes('{prompt}'));
    let args: string[];
    if (hasPlaceholder) {
      args = this.defaultArgs.map((arg) => (arg === '{prompt}' ? input : arg.replace('{prompt}', input)));
    } else {
      args = [...this.defaultArgs, input];
    }

    const child = spawn(cmd, args, {
      cwd: session.config.workspaceDir,
      env: { ...process.env, ...session.config.env },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const state = { process: child, emitter, completed: false };
    this.active.set(session.id, state);

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

import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import { AgentAdapter, AgentConfig, AgentEvent, AgentSession } from './agent-adapter.js';

interface PiProcessContext {
  process: ChildProcess | null;
  eventEmitter: EventEmitter;
  turnCompleted: boolean;
  rawOutput: string;
  exitCode: number | null;
}

export class PiAdapter implements AgentAdapter {
  public readonly name = 'PiAdapter';
  private readonly cliPath: string;
  private readonly activeProcesses = new Map<string, PiProcessContext>();

  constructor(cliPath?: string) {
    this.cliPath = cliPath || this.findPiCliPath();
  }

  private findPiCliPath(): string {
    if (process.env.PI_CLI_PATH && fs.existsSync(process.env.PI_CLI_PATH)) {
      return process.env.PI_CLI_PATH;
    }

    const appData = process.env.APPDATA || '';
    const userProfile = process.env.USERPROFILE || '';
    const candidatePaths = [
      path.join(appData, 'npm', 'node_modules', '@earendil-works', 'pi-coding-agent', 'dist', 'cli.js'),
      path.join(userProfile, 'AppData', 'Roaming', 'npm', 'node_modules', '@earendil-works', 'pi-coding-agent', 'dist', 'cli.js'),
      path.join(userProfile, '.pi', 'agent', 'bin', 'cli.js'),
    ];

    for (const cand of candidatePaths) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }

    return 'pi'; // Fallback to PATH binary
  }

  public async start(config: AgentConfig): Promise<AgentSession> {
    const sessionId = `pi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const eventEmitter = new EventEmitter();

    this.activeProcesses.set(sessionId, {
      process: null,
      eventEmitter,
      turnCompleted: false,
      rawOutput: '',
      exitCode: null,
    });

    return {
      id: sessionId,
      config,
      startTime: Date.now(),
      isAlive: true,
      metadata: { cliPath: this.cliPath },
    };
  }

  public async send(session: AgentSession, input: string): Promise<void> {
    const ctx = this.activeProcesses.get(session.id);
    if (!ctx) {
      throw new Error(`Session ${session.id} not found in active processes`);
    }

    ctx.turnCompleted = false;
    ctx.rawOutput = '';
    ctx.exitCode = null;

    const args: string[] = [];

    // Use non-interactive print mode with JSON events
    args.push('-p');
    args.push('--mode', 'json');

    if (session.config.ephemeralSession !== false) {
      args.push('--no-session');
    }

    if (session.config.provider) {
      args.push('--provider', session.config.provider);
    }
    if (session.config.model) {
      args.push('--model', session.config.model);
    }
    if (session.config.tools && session.config.tools.length > 0) {
      const piSupportedTools = new Set(['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls']);
      const validTools = session.config.tools.filter((t) => piSupportedTools.has(t));
      if (validTools.length > 0) {
        args.push('--tools', validTools.join(','));
      }
    }
    if (session.config.systemPrompt) {
      args.push('--system-prompt', session.config.systemPrompt);
    }

    // Pass the user input as prompt
    args.push(input);

    const isJsFile = this.cliPath.endsWith('.js');
    const executable = isJsFile ? process.execPath : this.cliPath;
    const spawnArgs = isJsFile ? [this.cliPath, ...args] : args;

    ctx.process = spawn(executable, spawnArgs, {
      cwd: session.config.workspaceDir,
      env: { ...process.env, ...session.config.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Initial events
    ctx.eventEmitter.emit('event', {
      type: 'session_started',
      timestamp: Date.now(),
      data: { sessionId: session.id, role: session.config.role },
    } as AgentEvent);

    ctx.eventEmitter.emit('event', {
      type: 'turn_started',
      timestamp: Date.now(),
      data: { input },
    } as AgentEvent);

    let stdoutBuffer = '';

    ctx.process.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      ctx.rawOutput += text;
      stdoutBuffer += text;

      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        this.parseAndEmitEvent(line, ctx.eventEmitter);
      }
    });

    ctx.process.stderr?.on('data', (chunk: Buffer) => {
      ctx.rawOutput += chunk.toString();
    });

    ctx.process.on('close', (code) => {
      ctx.exitCode = code;
      ctx.turnCompleted = true;
      session.isAlive = false;

      // Flush remaining buffer
      if (stdoutBuffer.trim()) {
        this.parseAndEmitEvent(stdoutBuffer, ctx.eventEmitter);
      }

      ctx.eventEmitter.emit('event', {
        type: 'turn_completed',
        timestamp: Date.now(),
        data: { exitCode: code, rawOutput: ctx.rawOutput },
      } as AgentEvent);

      ctx.eventEmitter.emit('event', {
        type: 'session_completed',
        timestamp: Date.now(),
        data: { exitCode: code },
      } as AgentEvent);
    });

    ctx.process.on('error', (err) => {
      ctx.turnCompleted = true;
      session.isAlive = false;
      ctx.eventEmitter.emit('event', {
        type: 'error',
        timestamp: Date.now(),
        data: { error: err.message },
      } as AgentEvent);
      ctx.eventEmitter.emit('event', {
        type: 'session_completed',
        timestamp: Date.now(),
        data: { error: err.message },
      } as AgentEvent);
    });
  }

  private parseAndEmitEvent(line: string, emitter: EventEmitter): void {
    try {
      const parsed = JSON.parse(line);
      const timestamp = Date.now();

      switch (parsed.type) {
        case 'turn_start':
          emitter.emit('event', { type: 'turn_started', timestamp, data: parsed } as AgentEvent);
          break;
        case 'message_update':
          if (parsed.assistantMessageEvent?.type === 'thinking_delta') {
            emitter.emit('event', {
              type: 'thinking',
              timestamp,
              data: { delta: parsed.assistantMessageEvent.delta },
            } as AgentEvent);
          } else if (parsed.assistantMessageEvent?.type === 'text_delta') {
            emitter.emit('event', {
              type: 'message',
              timestamp,
              data: { delta: parsed.assistantMessageEvent.delta },
            } as AgentEvent);
          }
          break;
        case 'message_end':
        case 'turn_end':
          if (parsed.message?.content) {
            for (const item of parsed.message.content) {
              if (item.type === 'toolCall') {
                emitter.emit('event', {
                  type: 'tool_call',
                  timestamp,
                  data: { id: item.id, name: item.name, args: item.arguments },
                } as AgentEvent);
              }
            }
          }
          break;
        case 'agent_end':
          if (parsed.messages) {
            for (const msg of parsed.messages) {
              if (msg.role === 'toolResult') {
                emitter.emit('event', {
                  type: 'tool_result',
                  timestamp,
                  data: { toolCallId: msg.toolCallId, name: msg.toolName, content: msg.content },
                } as AgentEvent);
              }
            }
          }
          break;
        case 'agent_settled':
          emitter.emit('event', {
            type: 'turn_completed',
            timestamp,
            data: { reason: 'agent_settled' },
          } as AgentEvent);
          break;
      }
    } catch {
      // Plain text or unformatted line
      emitter.emit('event', {
        type: 'message',
        timestamp: Date.now(),
        data: { text: line },
      } as AgentEvent);
    }
  }

  public async interrupt(session: AgentSession): Promise<void> {
    const ctx = this.activeProcesses.get(session.id);
    if (ctx && ctx.process) {
      try {
        ctx.process.kill('SIGINT');
      } catch {
        // ignore
      }
    }
  }

  public async stop(session: AgentSession): Promise<void> {
    const ctx = this.activeProcesses.get(session.id);
    if (ctx && ctx.process) {
      try {
        ctx.process.kill('SIGKILL');
      } catch {
        // ignore
      }
      this.activeProcesses.delete(session.id);
    }
    session.isAlive = false;
  }

  public async isAlive(session: AgentSession): Promise<boolean> {
    const ctx = this.activeProcesses.get(session.id);
    if (!ctx) return false;
    return ctx.exitCode === null && !ctx.turnCompleted;
  }

  public async *events(session: AgentSession): AsyncIterable<AgentEvent> {
    const ctx = this.activeProcesses.get(session.id);
    if (!ctx) return;

    const queue: AgentEvent[] = [];
    let resolveNext: (() => void) | null = null;
    let finished = false;

    const listener = (event: AgentEvent) => {
      queue.push(event);
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
      if (event.type === 'session_completed') {
        finished = true;
      }
    };

    ctx.eventEmitter.on('event', listener);

    try {
      while (!finished || queue.length > 0) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else if (!finished) {
          await new Promise<void>((resolve) => {
            resolveNext = resolve;
          });
        }
      }
    } finally {
      ctx.eventEmitter.off('event', listener);
    }
  }

  public async detectTurnCompletion(session: AgentSession): Promise<boolean> {
    const ctx = this.activeProcesses.get(session.id);
    if (!ctx) return true;
    return ctx.turnCompleted || ctx.exitCode !== null;
  }

  public getRawOutput(sessionId: string): string {
    return this.activeProcesses.get(sessionId)?.rawOutput || '';
  }
}

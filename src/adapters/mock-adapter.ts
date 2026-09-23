import { EventEmitter } from 'node:events';
import { AgentAdapter, AgentConfig, AgentEvent, AgentSession } from './agent-adapter.js';

export type MockHandler = (input: string, session: AgentSession, emit: (event: AgentEvent) => void) => Promise<void>;

export class MockAdapter implements AgentAdapter {
  public readonly name = 'MockAdapter';
  private handlers: MockHandler[] = [];
  private readonly sessions = new Map<string, { emitter: EventEmitter; completed: boolean; alive: boolean }>();

  public setHandler(handler: MockHandler): void {
    this.handlers = [handler];
  }

  public addHandler(handler: MockHandler): void {
    this.handlers.push(handler);
  }

  public async start(config: AgentConfig): Promise<AgentSession> {
    const id = `mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.sessions.set(id, {
      emitter: new EventEmitter(),
      completed: false,
      alive: true,
    });
    return {
      id,
      config,
      startTime: Date.now(),
      isAlive: true,
    };
  }

  public async send(session: AgentSession, input: string): Promise<void> {
    const ctx = this.sessions.get(session.id);
    if (!ctx) throw new Error('Session not found');

    ctx.completed = false;
    ctx.alive = true;

    const handler = this.handlers.shift() || this.defaultHandler;

    const emit = (event: AgentEvent) => {
      ctx.emitter.emit('event', event);
    };

    emit({ type: 'session_started', timestamp: Date.now(), data: { sessionId: session.id } });
    emit({ type: 'turn_started', timestamp: Date.now(), data: { input } });

    try {
      await handler(input, session, emit);
      ctx.completed = true;
      ctx.alive = false;
      session.isAlive = false;

      emit({ type: 'turn_completed', timestamp: Date.now(), data: { success: true } });
      emit({ type: 'session_completed', timestamp: Date.now(), data: { success: true } });
    } catch (err: any) {
      ctx.completed = true;
      ctx.alive = false;
      session.isAlive = false;
      emit({ type: 'error', timestamp: Date.now(), data: { error: err.message } });
      emit({ type: 'turn_completed', timestamp: Date.now(), data: { error: err.message } });
      emit({ type: 'session_completed', timestamp: Date.now(), data: { error: err.message } });
    }
  }

  private defaultHandler: MockHandler = async (_input, _session, emit) => {
    emit({
      type: 'message',
      timestamp: Date.now(),
      data: { text: 'Task completed successfully.' },
    });
  };

  public async interrupt(session: AgentSession): Promise<void> {
    const ctx = this.sessions.get(session.id);
    if (ctx) {
      ctx.completed = true;
      ctx.alive = false;
      session.isAlive = false;
    }
  }

  public async stop(session: AgentSession): Promise<void> {
    await this.interrupt(session);
    this.sessions.delete(session.id);
  }

  public async isAlive(session: AgentSession): Promise<boolean> {
    return this.sessions.get(session.id)?.alive || false;
  }

  public async *events(session: AgentSession): AsyncIterable<AgentEvent> {
    const ctx = this.sessions.get(session.id);
    if (!ctx) return;

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

    ctx.emitter.on('event', listener);

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
      ctx.emitter.off('event', listener);
    }
  }

  public async detectTurnCompletion(session: AgentSession): Promise<boolean> {
    return this.sessions.get(session.id)?.completed || false;
  }
}

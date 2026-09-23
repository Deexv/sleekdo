/**
 * Wraps an AgentAdapter and tees every event emitted by its sessions to a
 * sink (e.g. the CLI), without altering the stream the consumer sees.
 */
import { AgentAdapter, AgentSession, AgentEvent, AgentConfig } from './agent-adapter.js';

export type AgentEventSink = (ev: AgentEvent) => void;

export class TeeAdapter implements AgentAdapter {
  public readonly name: string;

  constructor(
    private readonly inner: AgentAdapter,
    private readonly sink: AgentEventSink
  ) {
    this.name = inner.name;
  }

  async start(config: AgentConfig): Promise<AgentSession> {
    return this.inner.start(config);
  }

  async send(session: AgentSession, input: string): Promise<void> {
    return this.inner.send(session, input);
  }

  async interrupt(session: AgentSession): Promise<void> {
    return this.inner.interrupt(session);
  }

  async stop(session: AgentSession): Promise<void> {
    return this.inner.stop(session);
  }

  async isAlive(session: AgentSession): Promise<boolean> {
    return this.inner.isAlive(session);
  }

  async *events(session: AgentSession): AsyncIterable<AgentEvent> {
    for await (const ev of this.inner.events(session)) {
      try {
        this.sink(ev);
      } catch {
        // A broken sink must never break the agent stream
      }
      yield ev;
    }
  }

  async detectTurnCompletion(session: AgentSession): Promise<boolean> {
    return this.inner.detectTurnCompletion(session);
  }
}

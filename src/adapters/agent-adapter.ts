export type AgentEventType =
  | 'session_started'
  | 'turn_started'
  | 'message'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'turn_completed'
  | 'session_completed'
  | 'error';

export interface AgentEvent {
  type: AgentEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface AgentConfig {
  workspaceDir: string;
  role: 'A1' | 'A2' | 'A3';
  systemPrompt?: string;
  tools?: string[];
  provider?: string;
  model?: string;
  ephemeralSession?: boolean;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

export interface AgentSession {
  id: string;
  config: AgentConfig;
  startTime: number;
  isAlive: boolean;
  metadata?: Record<string, unknown>;
}

export interface AgentAdapter {
  readonly name: string;
  start(config: AgentConfig): Promise<AgentSession>;
  send(session: AgentSession, input: string): Promise<void>;
  interrupt(session: AgentSession): Promise<void>;
  stop(session: AgentSession): Promise<void>;
  isAlive(session: AgentSession): Promise<boolean>;
  events(session: AgentSession): AsyncIterable<AgentEvent>;
  detectTurnCompletion(session: AgentSession): Promise<boolean>;
}

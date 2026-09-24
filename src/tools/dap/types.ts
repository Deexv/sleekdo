/**
 * Debug Adapter Protocol (DAP) Types (Sections 13, 14, 40)
 */

export interface Source {
  name?: string;
  path?: string;
  sourceReference?: number;
}

export interface SourceBreakpoint {
  line: number;
  column?: number;
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
}

export interface DapBreakpoint {
  id?: number;
  verified: boolean;
  message?: string;
  source?: Source;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface DapStackFrame {
  id: number;
  name: string;
  source?: Source;
  line: number;
  column: number;
  presentationHint?: string;
}

export interface DapScope {
  name: string;
  variablesReference: number;
  expensive: boolean;
}

export interface DapVariable {
  name: string;
  value: string;
  type?: string;
  variablesReference?: number;
}

export interface DapThread {
  id: number;
  name: string;
}

export type DapStopReason = 'step' | 'breakpoint' | 'exception' | 'pause' | 'entry' | 'unknown';

export interface DapStopEvent {
  reason: DapStopReason;
  threadId?: number;
  description?: string;
  text?: string;
}

export interface DapLaunchConfig {
  adapterCommand?: string;
  adapterArgs?: string[];
  program: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stopOnEntry?: boolean;
}

export interface DapRuntimeEvidence {
  timestamp: number;
  stopReason: DapStopReason;
  location: {
    file?: string;
    line?: number;
    column?: number;
    functionName?: string;
  };
  stackFrames: DapStackFrame[];
  variables: DapVariable[];
  evaluatedExpressions?: Record<string, string>;
}

import * as path from 'node:path';
import { DapClient } from './client.js';
import type {
  DapLaunchConfig,
  DapRuntimeEvidence,
  DapScope,
  DapStackFrame,
  DapStopEvent,
  DapVariable,
  SourceBreakpoint,
} from './types.js';

export interface DebugSessionOptions {
  program: string;
  args?: string[];
  cwd?: string;
  breakpoints?: { [filePath: string]: SourceBreakpoint[] };
  adapterCommand?: string;
  adapterArgs?: string[];
}

export class DapSessionManager {
  public readonly workspaceDir: string;
  private client: DapClient | null = null;
  private evidenceLog: DapRuntimeEvidence[] = [];
  private lastStopEvent: DapStopEvent | null = null;

  constructor(workspaceDir: string) {
    this.workspaceDir = path.resolve(workspaceDir);
  }

  public async startSession(options: DebugSessionOptions): Promise<DapClient> {
    if (this.client && this.client.isConnected) {
      await this.client.disconnect();
    }

    const adapterCmd = options.adapterCommand || (process.platform === 'win32' ? 'node.exe' : 'node');
    const adapterArgs = options.adapterArgs || [];

    this.client = new DapClient();

    this.client.on('stopped', (ev: DapStopEvent) => {
      this.lastStopEvent = ev;
    });

    await this.client.startAdapter(adapterCmd, adapterArgs, options.cwd || this.workspaceDir);
    await this.client.initialize();

    // Set initial breakpoints if provided
    if (options.breakpoints) {
      for (const [file, bps] of Object.entries(options.breakpoints)) {
        await this.client.setBreakpoints(path.resolve(this.workspaceDir, file), bps);
      }
    }

    await this.client.launch({
      program: path.resolve(this.workspaceDir, options.program),
      args: options.args || [],
      cwd: options.cwd || this.workspaceDir,
    });

    await this.client.configurationDone();

    return this.client;
  }

  /**
   * Captures runtime snapshot at the current breakpoint/stop location for A1/A3 verification.
   */
  public async captureEvidence(threadId?: number, watchExpressions: string[] = []): Promise<DapRuntimeEvidence | null> {
    if (!this.client || !this.client.isConnected) return null;

    let targetThreadId = threadId;
    if (targetThreadId === undefined) {
      const threads = await this.client.threads();
      if (threads.length === 0) return null;
      targetThreadId = threads[0].id;
    }

    const stackFrames = await this.client.stackTrace(targetThreadId, 0, 10);
    const topFrame = stackFrames[0];

    const variables: DapVariable[] = [];
    if (topFrame) {
      const scopes = await this.client.scopes(topFrame.id);
      for (const scope of scopes) {
        if (!scope.expensive && scope.variablesReference > 0) {
          const vars = await this.client.variables(scope.variablesReference);
          variables.push(...vars);
        }
      }
    }

    const evaluatedExpressions: Record<string, string> = {};
    if (topFrame && watchExpressions.length > 0) {
      for (const expr of watchExpressions) {
        try {
          const val = await this.client.evaluate(expr, topFrame.id);
          evaluatedExpressions[expr] = val;
        } catch (err: any) {
          evaluatedExpressions[expr] = `<error: ${err.message}>`;
        }
      }
    }

    const evidence: DapRuntimeEvidence = {
      timestamp: Date.now(),
      stopReason: this.lastStopEvent?.reason || 'unknown',
      location: {
        file: topFrame?.source?.path,
        line: topFrame?.line,
        column: topFrame?.column,
        functionName: topFrame?.name,
      },
      stackFrames,
      variables,
      evaluatedExpressions,
    };

    this.evidenceLog.push(evidence);
    return evidence;
  }

  public getEvidenceLog(): DapRuntimeEvidence[] {
    return [...this.evidenceLog];
  }

  public clearEvidence(): void {
    this.evidenceLog = [];
  }

  public async stop(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }
}

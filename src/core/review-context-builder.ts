import { Task, WorkspaceDiff, SleekdoState } from '../types/domain.js';
import { FilesystemEngine } from '../evidence/filesystem-engine.js';

export interface ReviewContext {
  originalRequest: string;
  task: Task;
  acceptanceCriteria: string[];
  sleekdoStateRevision: number;
  a1Summary: string;
  diffSummary: {
    createdFiles: string[];
    modifiedFiles: string[];
    deletedFiles: string[];
    changedDependencies?: string[];
    changedConfiguration?: string[];
  };
  gitDiff: string;
  testResultsSummary?: string;
  previousFindings?: string[];
  relevantFileContents: Record<string, string>;
}

export class ReviewContextBuilder {
  private readonly fsEngine: FilesystemEngine;

  constructor(fsEngine: FilesystemEngine) {
    this.fsEngine = fsEngine;
  }

  public buildContext(
    task: Task,
    state: SleekdoState,
    diff: WorkspaceDiff,
    a1Summary: string,
    gitDiff: string,
    testResultsSummary?: string
  ): ReviewContext {
    const relevantFileContents: Record<string, string> = {};

    // Collect changed files content (up to reasonable size limit)
    const affectedFiles = [...diff.createdFiles, ...diff.modifiedFiles];
    for (const file of affectedFiles.slice(0, 15)) {
      const content = this.fsEngine.readFile(file);
      if (content !== null) {
        relevantFileContents[file] = this.redactSecrets(content);
      }
    }

    const previousFindings: string[] = [];
    if (task.rejectionHistory) {
      for (const rej of task.rejectionHistory) {
        previousFindings.push(`[${new Date(rej.timestamp).toISOString()}] ${rej.problem}: ${rej.requiredCorrection}`);
      }
    }

    return {
      originalRequest: state.originalRequest,
      task,
      acceptanceCriteria: task.acceptanceCriteria,
      sleekdoStateRevision: state.revision,
      a1Summary: this.redactSecrets(a1Summary),
      diffSummary: {
        createdFiles: diff.createdFiles,
        modifiedFiles: diff.modifiedFiles,
        deletedFiles: diff.deletedFiles,
        changedDependencies: diff.changedDependencies,
        changedConfiguration: diff.changedConfiguration,
      },
      gitDiff: this.redactSecrets(gitDiff),
      testResultsSummary: testResultsSummary ? this.redactSecrets(testResultsSummary) : undefined,
      previousFindings: previousFindings.length > 0 ? previousFindings : undefined,
      relevantFileContents,
    };
  }

  private redactSecrets(text: string): string {
    return text
      .replace(/([a-zA-Z0-9_-]*(?:api[_-]?key|token|secret|password|bearer)[a-zA-Z0-9_-]*\s*[:=]\s*['"]?)[a-zA-Z0-9_.-]{8,}(['"]?)/gi, '$1[REDACTED]$2')
      .replace(/(sk-[a-zA-Z0-9]{20,})/g, '[REDACTED_API_KEY]');
  }
}

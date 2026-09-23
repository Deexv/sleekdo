import { WorkspaceSnapshot, WorkspaceDiff, SnapshotId } from '../types/domain.js';
import { FilesystemEngine } from './filesystem-engine.js';
import { GitEngine } from './git-engine.js';

export class SnapshotEngine {
  private readonly fsEngine: FilesystemEngine;
  private readonly gitEngine: GitEngine;

  constructor(fsEngine: FilesystemEngine, gitEngine: GitEngine) {
    this.fsEngine = fsEngine;
    this.gitEngine = gitEngine;
  }

  public captureSnapshot(id?: SnapshotId): WorkspaceSnapshot {
    const files = this.fsEngine.scanWorkspace();
    const gitInfo = this.gitEngine.getQuickSummary();

    const snapshotId = id || `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      id: snapshotId,
      timestamp: Date.now(),
      files,
      gitCommit: gitInfo.commit,
      gitStatusSummary: gitInfo.statusSummary,
      totalFiles: Object.keys(files).length,
    };
  }

  public calculateDiff(before: WorkspaceSnapshot, after: WorkspaceSnapshot): WorkspaceDiff {
    const createdFiles: string[] = [];
    const modifiedFiles: string[] = [];
    const deletedFiles: string[] = [];

    const beforeKeys = new Set(Object.keys(before.files));
    const afterKeys = new Set(Object.keys(after.files));

    for (const file of afterKeys) {
      if (!beforeKeys.has(file)) {
        createdFiles.push(file);
      } else {
        const beforeItem = before.files[file];
        const afterItem = after.files[file];
        if (beforeItem.sha256 !== afterItem.sha256 || beforeItem.size !== afterItem.size) {
          modifiedFiles.push(file);
        }
      }
    }

    for (const file of beforeKeys) {
      if (!afterKeys.has(file)) {
        deletedFiles.push(file);
      }
    }

    // Extract directories
    const extractDirs = (fileList: string[]): string[] => {
      const dirs = new Set<string>();
      for (const f of fileList) {
        const parts = f.split('/');
        if (parts.length > 1) {
          parts.pop();
          dirs.add(parts.join('/'));
        }
      }
      return Array.from(dirs);
    };

    return {
      beforeSnapshotId: before.id,
      afterSnapshotId: after.id,
      createdFiles: createdFiles.sort(),
      modifiedFiles: modifiedFiles.sort(),
      deletedFiles: deletedFiles.sort(),
      createdDirectories: extractDirs(createdFiles).sort(),
      deletedDirectories: extractDirs(deletedFiles).sort(),
    };
  }
}

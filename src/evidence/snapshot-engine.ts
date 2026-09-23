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

    // Extract dependencies from package.json if present
    const dependencies: Record<string, string> = {};
    const pkgContent = this.fsEngine.readFile('package.json');
    if (pkgContent) {
      try {
        const pkg = JSON.parse(pkgContent);
        const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        for (const [k, v] of Object.entries(allDeps)) {
          dependencies[k] = String(v);
        }
      } catch {
        // Ignore invalid package.json
      }
    }

    // Extract configuration files
    const configurationFiles: Record<string, string> = {};
    const configRegex = /^(?:tsconfig.*\.json|package\.json|\.env.*|.*\.config\..*|Dockerfile|docker-compose.*|\.gitignore|sleekdo\.config\.json)$/i;
    for (const [filePath, meta] of Object.entries(files)) {
      const baseName = filePath.split('/').pop() || filePath;
      if (configRegex.test(baseName) || filePath.includes('.config/')) {
        configurationFiles[filePath] = meta.sha256;
      }
    }

    const snapshotId = id || `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      id: snapshotId,
      timestamp: Date.now(),
      dependencies,
      configurationFiles,
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

    // Calculate changed dependencies
    const changedDependencies: string[] = [];
    const beforeDeps = before.dependencies || {};
    const afterDeps = after.dependencies || {};
    for (const [dep, ver] of Object.entries(afterDeps)) {
      if (!(dep in beforeDeps)) {
        changedDependencies.push(`added: ${dep}@${ver}`);
      } else if (beforeDeps[dep] !== ver) {
        changedDependencies.push(`updated: ${dep} (${beforeDeps[dep]} -> ${ver})`);
      }
    }
    for (const dep of Object.keys(beforeDeps)) {
      if (!(dep in afterDeps)) {
        changedDependencies.push(`removed: ${dep}`);
      }
    }

    // Calculate changed configuration
    const changedConfiguration: string[] = [];
    const beforeConfigs = before.configurationFiles || {};
    const afterConfigs = after.configurationFiles || {};
    for (const [cfg, sha] of Object.entries(afterConfigs)) {
      if (!(cfg in beforeConfigs)) {
        changedConfiguration.push(`created: ${cfg}`);
      } else if (beforeConfigs[cfg] !== sha) {
        changedConfiguration.push(`modified: ${cfg}`);
      }
    }
    for (const cfg of Object.keys(beforeConfigs)) {
      if (!(cfg in afterConfigs)) {
        changedConfiguration.push(`deleted: ${cfg}`);
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
      changedDependencies: changedDependencies.sort(),
      changedConfiguration: changedConfiguration.sort(),
    };
  }
}

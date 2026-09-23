import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface GitSummary {
  isGitRepo: boolean;
  branch?: string;
  commit?: string;
  statusSummary?: string;
  diff?: string;
}

export class GitEngine {
  private readonly workspaceDir: string;
  private readonly isRepo: boolean;

  constructor(workspaceDir: string) {
    this.workspaceDir = path.resolve(workspaceDir);
    this.isRepo = fs.existsSync(path.join(this.workspaceDir, '.git'));
  }

  public getQuickSummary(): GitSummary {
    if (!this.isRepo) {
      return { isGitRepo: false };
    }

    try {
      const branch = this.runGit('rev-parse --abbrev-ref HEAD').trim();
      const commit = this.runGit('rev-parse HEAD').trim();
      const status = this.runGit('status --short').trim();
      return {
        isGitRepo: true,
        branch,
        commit,
        statusSummary: status,
      };
    } catch {
      return { isGitRepo: true };
    }
  }

  public getDiff(stagedOnly = false): string {
    if (!this.isRepo) return '';
    try {
      const cmd = stagedOnly ? 'diff --cached' : 'diff';
      return this.runGit(cmd);
    } catch {
      return '';
    }
  }

  public getStatus(): string {
    if (!this.isRepo) return '';
    try {
      return this.runGit('status --porcelain');
    } catch {
      return '';
    }
  }

  private runGit(args: string): string {
    return execSync(`git ${args}`, {
      cwd: this.workspaceDir,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      timeout: 5000,
    });
  }
}

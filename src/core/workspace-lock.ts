import * as fs from 'node:fs';
import * as path from 'node:path';

export interface LockInfo {
  locked: boolean;
  lockedBy: 'A1' | 'A3' | 'ORCHESTRATOR';
  lockedAt: number;
  pid: number;
  reason: string;
}

export class WorkspaceLock {
  private readonly lockFilePath: string;

  constructor(workspaceDir: string) {
    const lockDir = path.join(workspaceDir, '.sleekdo', 'locks');
    if (!fs.existsSync(lockDir)) {
      fs.mkdirSync(lockDir, { recursive: true });
    }
    this.lockFilePath = path.join(lockDir, 'workspace.lock');
  }

  public isLocked(): boolean {
    if (!fs.existsSync(this.lockFilePath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(this.lockFilePath, 'utf8');
      const lock: LockInfo = JSON.parse(content);
      // Stale lock detection via PID
      if (!this.isProcessAlive(lock.pid)) {
        // Stale lock from crashed process: self-heal
        this.unlock();
        return false;
      }
      return lock.locked;
    } catch {
      // Corrupted lock file: clear it
      this.unlock();
      return false;
    }
  }

  public getLockInfo(): LockInfo | null {
    if (!fs.existsSync(this.lockFilePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(this.lockFilePath, 'utf8')) as LockInfo;
    } catch {
      return null;
    }
  }

  public acquire(lockedBy: 'A1' | 'A3' | 'ORCHESTRATOR', reason: string): boolean {
    if (this.isLocked()) {
      const info = this.getLockInfo();
      // Idempotency: if already locked by the same PID and owner, allow
      if (info && info.pid === process.pid && info.lockedBy === lockedBy) {
        return true;
      }
      return false;
    }

    const lockInfo: LockInfo = {
      locked: true,
      lockedBy,
      lockedAt: Date.now(),
      pid: process.pid,
      reason,
    };

    const tempPath = `${this.lockFilePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(lockInfo, null, 2), 'utf8');
    fs.renameSync(tempPath, this.lockFilePath);
    return true;
  }

  public unlock(): void {
    if (fs.existsSync(this.lockFilePath)) {
      try {
        fs.unlinkSync(this.lockFilePath);
      } catch {
        // Ignore unlink error if already deleted
      }
    }
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (e: any) {
      return e.code === 'EPERM';
    }
  }
}

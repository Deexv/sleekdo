import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export interface FileMetadata {
  size: number;
  sha256: string;
}

export class FilesystemEngine {
  private readonly workspaceDir: string;
  private readonly ignoredDirs: Set<string>;

  constructor(workspaceDir: string, additionalIgnored: string[] = []) {
    this.workspaceDir = path.resolve(workspaceDir);
    this.ignoredDirs = new Set([
      '.git',
      'node_modules',
      '.sleekdo',
      '.gemini',
      '.pi',
      'dist',
      'build',
      ...additionalIgnored,
    ]);
  }

  public scanWorkspace(): Record<string, FileMetadata> {
    const results: Record<string, FileMetadata> = {};
    this.walk(this.workspaceDir, results);
    return results;
  }

  private walk(currentDir: string, map: Record<string, FileMetadata>): void {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (this.ignoredDirs.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(this.workspaceDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        this.walk(fullPath, map);
      } else if (entry.isFile()) {
        try {
          const stats = fs.statSync(fullPath);
          const buffer = fs.readFileSync(fullPath);
          const hash = crypto.createHash('sha256').update(buffer).digest('hex');
          map[relPath] = {
            size: stats.size,
            sha256: hash,
          };
        } catch {
          // File may have been removed or locked while scanning
        }
      }
    }
  }

  public getFileHash(relPath: string): string | null {
    const fullPath = path.join(this.workspaceDir, relPath);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return null;
    }
    const buffer = fs.readFileSync(fullPath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  public readFile(relPath: string): string | null {
    const fullPath = path.join(this.workspaceDir, relPath);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return null;
    }
    return fs.readFileSync(fullPath, 'utf8');
  }
}

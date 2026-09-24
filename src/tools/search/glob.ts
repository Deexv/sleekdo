import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface GlobResult {
  path: string;       // relative path
  absolutePath: string;
  size: number;
  isDirectory: boolean;
}

const DEFAULT_IGNORE = new Set(['node_modules', '.git', '.sleekdo', 'dist', '.vscode', '.idea']);

export async function globFiles(
  rootDir: string,
  pattern = '*',
  options: { maxResults?: number; ignore?: string[]; includeDirs?: boolean } = {}
): Promise<GlobResult[]> {
  const maxResults = options.maxResults ?? 200;
  const ignoreSet = new Set([...DEFAULT_IGNORE, ...(options.ignore || [])]);
  const results: GlobResult[] = [];

  const regex = convertGlobToRegex(pattern);

  async function walk(currentDir: string): Promise<void> {
    if (results.length >= maxResults) return;

    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) break;
      if (ignoreSet.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (options.includeDirs && regex.test(relPath)) {
          results.push({
            path: relPath,
            absolutePath: fullPath,
            size: 0,
            isDirectory: true,
          });
        }
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (regex.test(relPath) || regex.test(entry.name)) {
          let size = 0;
          try {
            const stat = await fs.stat(fullPath);
            size = stat.size;
          } catch {
            // ignore stat failure
          }
          results.push({
            path: relPath,
            absolutePath: fullPath,
            size,
            isDirectory: false,
          });
        }
      }
    }
  }

  await walk(rootDir);
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

function convertGlobToRegex(glob: string): RegExp {
  if (glob === '*' || glob === '**/*') return /.*/;
  let reStr = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  return new RegExp(`^${reStr}$`, 'i');
}

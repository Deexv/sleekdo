import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { globFiles } from './glob.js';

export interface GrepMatch {
  file: string;
  lineNumber: number;
  lineContent: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

export interface GrepOptions {
  caseSensitive?: boolean;
  isRegex?: boolean;
  contextLines?: number;
  filePattern?: string;
  maxMatches?: number;
}

export async function grepSearch(
  rootDir: string,
  query: string,
  options: GrepOptions = {}
): Promise<{ matches: GrepMatch[]; totalMatches: number; filesSearched: number; truncated: boolean }> {
  const maxMatches = options.maxMatches ?? 100;
  const context = options.contextLines ?? 0;
  const flags = options.caseSensitive ? 'g' : 'gi';

  let regex: RegExp;
  try {
    regex = options.isRegex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
  } catch (err: any) {
    throw new Error(`Invalid regex query: ${err.message}`);
  }

  const files = await globFiles(rootDir, options.filePattern || '**/*');
  const matches: GrepMatch[] = [];
  let totalMatches = 0;
  let truncated = false;

  for (const file of files) {
    if (file.isDirectory) continue;
    if (file.size > 2 * 1024 * 1024) continue; // Skip huge files > 2MB

    let text: string;
    try {
      text = await fs.readFile(file.absolutePath, 'utf8');
    } catch {
      continue;
    }

    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      regex.lastIndex = 0;
      if (regex.test(lines[i])) {
        totalMatches++;
        if (matches.length < maxMatches) {
          const match: GrepMatch = {
            file: file.path,
            lineNumber: i + 1,
            lineContent: lines[i],
          };

          if (context > 0) {
            const startBefore = Math.max(0, i - context);
            match.contextBefore = lines.slice(startBefore, i);
            const endAfter = Math.min(lines.length, i + 1 + context);
            match.contextAfter = lines.slice(i + 1, endAfter);
          }

          matches.push(match);
        } else {
          truncated = true;
        }
      }
    }
  }

  return {
    matches,
    totalMatches,
    filesSearched: files.length,
    truncated,
  };
}

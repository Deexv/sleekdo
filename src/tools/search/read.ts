import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface StructuredReadOptions {
  startLine?: number; // 1-indexed
  endLine?: number;   // 1-indexed, inclusive
  maxLines?: number;  // max lines to return (default 400)
  outlineMode?: boolean; // extract function / class declarations only
}

export interface StructuredReadResult {
  filePath: string;
  totalLines: number;
  totalBytes: number;
  startLine: number;
  endLine: number;
  content: string;
  isTruncated: boolean;
  outline?: Array<{ line: number; text: string }>;
}

export async function structuredRead(
  filePath: string,
  options: StructuredReadOptions = {}
): Promise<StructuredReadResult> {
  const resolved = path.resolve(filePath);
  const raw = await fs.readFile(resolved, 'utf8');
  const allLines = raw.split(/\r?\n/);
  const totalLines = allLines.length;
  const totalBytes = Buffer.byteLength(raw, 'utf8');

  if (options.outlineMode) {
    const outline: Array<{ line: number; text: string }> = [];
    const outlineRegex = /^\s*(export\s+)?(async\s+)?(function|class|interface|type|enum|const\s+[A-Za-z0-9_]+\s*=\s*(async\s+)?\()/;
    for (let i = 0; i < allLines.length; i++) {
      if (outlineRegex.test(allLines[i])) {
        outline.push({ line: i + 1, text: allLines[i].trim() });
      }
    }
    return {
      filePath,
      totalLines,
      totalBytes,
      startLine: 1,
      endLine: totalLines,
      content: outline.map((o) => `L${o.line}: ${o.text}`).join('\n'),
      isTruncated: false,
      outline,
    };
  }

  const maxLines = options.maxLines ?? 400;
  const startLine = Math.max(1, options.startLine ?? 1);
  const requestedEnd = options.endLine ?? totalLines;
  const actualEnd = Math.min(totalLines, Math.min(requestedEnd, startLine + maxLines - 1));

  const selectedLines = allLines.slice(startLine - 1, actualEnd);
  const isTruncated = actualEnd < requestedEnd || actualEnd < totalLines;

  return {
    filePath,
    totalLines,
    totalBytes,
    startLine,
    endLine: actualEnd,
    content: selectedLines.join('\n'),
    isTruncated,
  };
}

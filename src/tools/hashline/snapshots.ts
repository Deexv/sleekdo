import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { SnapshotRecord } from './types.js';

/**
 * Normalizes content by stripping UTF-8 BOM and normalizing CRLF to LF.
 * Also tracks original line ending for preservation if required.
 */
export function normalizeContent(raw: string): { text: string; hasBom: boolean; lineEnding: '\r\n' | '\n' } {
  let hasBom = false;
  let text = raw;

  if (text.charCodeAt(0) === 0xfeff) {
    hasBom = true;
    text = text.slice(1);
  }

  const hasCrlf = text.includes('\r\n');
  const lineEnding = hasCrlf ? '\r\n' : '\n';
  text = text.replace(/\r\n/g, '\n');

  return { text, hasBom, lineEnding };
}

/**
 * Computes a 4-hex character snapshot tag from content matching Oh My Pi's convention.
 */
export function computeSnapshotTag(content: string): string {
  const normalized = normalizeContent(content).text;
  const hash = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  return hash.slice(0, 4).toLowerCase();
}

export class SnapshotStore {
  private snapshots = new Map<string, SnapshotRecord[]>();

  public recordSnapshot(filePath: string, content: string): SnapshotRecord {
    const normalizedPath = path.resolve(filePath);
    const tag = computeSnapshotTag(content);
    const record: SnapshotRecord = {
      filePath: normalizedPath,
      tag,
      content,
      timestamp: Date.now(),
    };

    const history = this.snapshots.get(normalizedPath) || [];
    history.push(record);
    if (history.length > 50) history.shift();
    this.snapshots.set(normalizedPath, history);

    return record;
  }

  public getLatest(filePath: string): SnapshotRecord | undefined {
    const normalizedPath = path.resolve(filePath);
    const history = this.snapshots.get(normalizedPath);
    return history && history.length > 0 ? history[history.length - 1] : undefined;
  }

  public findByTag(filePath: string, tag: string): SnapshotRecord | undefined {
    const normalizedPath = path.resolve(filePath);
    const history = this.snapshots.get(normalizedPath);
    if (!history) return undefined;
    return history.find((r) => r.tag.toLowerCase() === tag.toLowerCase());
  }

  public getTrackedFileCount(): number {
    return this.snapshots.size;
  }

  public clear(): void {
    this.snapshots.clear();
  }
}


import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { normalizeContent, computeSnapshotTag, SnapshotStore } from './snapshots.js';
import { parseHashlinePatch } from './parser.js';
import type {
  FileEditOutcome,
  HashlineApplyResult,
  HashlineConfig,
  HashlinePatch,
  HashlineSection,
} from './types.js';

export const DEFAULT_HASHLINE_CONFIG: HashlineConfig = {
  editMode: 'hashline',
  fuzzyMatching: false,
  fuzzyThreshold: 0.85,
  blockGeneratedFiles: true,
  preserveLineEndings: true,
};

export class HashlineEngine {
  public readonly snapshotStore: SnapshotStore;
  public readonly config: HashlineConfig;
  private readonly baseDir: string;

  constructor(baseDir: string, config: Partial<HashlineConfig> = {}, snapshotStore?: SnapshotStore) {
    this.baseDir = path.resolve(baseDir);
    this.config = { ...DEFAULT_HASHLINE_CONFIG, ...config };
    this.snapshotStore = snapshotStore || new SnapshotStore();
  }

  /**
   * Applies a Hashline patch atomically across all included sections.
   * If any file fails preflight or is stale, no files are modified.
   */
  public async applyPatch(patchInput: string | HashlinePatch): Promise<HashlineApplyResult> {
    const patch = typeof patchInput === 'string' ? parseHashlinePatch(patchInput) : patchInput;

    if (patch.sections.length === 0) {
      return {
        success: false,
        error: 'No valid sections found in Hashline patch.',
        atomicityPreserved: true,
      };
    }

    // Step 1: Preflight Phase (Read all target files into memory & verify tags)
    const fileBuffers = new Map<string, {
      originalContent: string;
      currentTag: string;
      lines: string[];
      hasBom: boolean;
      hasTrailingNewline: boolean;
      lineEnding: '\r\n' | '\n';
      isNew: boolean;
    }>();

    for (const section of patch.sections) {
      const resolvedPath = path.resolve(this.baseDir, section.filePath);

      if (!fileBuffers.has(resolvedPath)) {
        let content = '';
        let isNew = false;
        try {
          content = await fs.readFile(resolvedPath, 'utf8');
        } catch (err: any) {
          if (err.code === 'ENOENT') {
            isNew = true;
          } else {
            return {
              success: false,
              error: `Failed to read file ${section.filePath}: ${err.message}`,
              atomicityPreserved: true,
            };
          }
        }

        const { text, hasBom, lineEnding } = normalizeContent(content);
        const currentTag = computeSnapshotTag(text);

        // Stale detection check
        if (section.expectedTag && !isNew) {
          if (section.expectedTag.toLowerCase() !== currentTag.toLowerCase()) {
            return {
              success: false,
              staleDetected: true,
              conflictingFiles: [section.filePath],
              error: `Stale anchor detected in ${section.filePath}. Expected snapshot tag #${section.expectedTag}, but current file tag is #${currentTag}. Patch aborted to prevent code corruption.`,
              atomicityPreserved: true,
            };
          }
        }

        const hasTrailingNewline = text.endsWith('\n');
        const fileLines = text
          ? (hasTrailingNewline ? text.slice(0, -1).split('\n') : text.split('\n'))
          : [];

        fileBuffers.set(resolvedPath, {
          originalContent: content,
          currentTag,
          lines: fileLines,
          hasTrailingNewline,
          hasBom,
          lineEnding,
          isNew,
        });
      }
    }

    // Step 2: In-Memory Transformation & Preflight Validation
    const memoryRegisters = new Map<string, string[]>();
    const filesToDelete = new Set<string>();
    const filesToRename = new Map<string, string>(); // oldPath -> newPath
    const outcomes: FileEditOutcome[] = [];

    for (const section of patch.sections) {
      const resolvedPath = path.resolve(this.baseDir, section.filePath);
      const buffer = fileBuffers.get(resolvedPath)!;
      let workingLines = [...buffer.lines];
      let opCount = 0;

      // Sort operations in descending order of line numbers so preceding indices don't shift
      const sortedOps = [...section.operations].sort((a, b) => {
        if (a.type === 'APPEND' && b.type !== 'APPEND') return -1;
        if (b.type === 'APPEND' && a.type !== 'APPEND') return 1;
        const lineA = a.startLine ?? 0;
        const lineB = b.startLine ?? 0;
        if (lineB !== lineA) return lineB - lineA;
        const precedence: Record<string, number> = {
          INSERT_AFTER: 0,
          REPLACE: 1,
          CUT: 1,
          INSERT_BEFORE: 2,
          APPEND: -1,
          REMOVE: 3,
          MOVE: 3,
        };
        return (precedence[a.type] ?? 0) - (precedence[b.type] ?? 0);
      });

      for (const op of sortedOps) {
        opCount++;
        switch (op.type) {
          case 'REPLACE': {
            const start = (op.startLine ?? 1) - 1;
            const end = op.endLine ?? op.startLine ?? 1;
            if (start < 0 || (start > workingLines.length && workingLines.length > 0)) {
              return {
                success: false,
                error: `Invalid range ${op.startLine}.=${op.endLine} in ${section.filePath}: exceeds file length (${workingLines.length} lines).`,
                atomicityPreserved: true,
              };
            }
            const deleteCount = Math.max(0, end - start);
            workingLines.splice(start, deleteCount, ...(op.lines || []));
            break;
          }
          case 'INSERT_BEFORE': {
            const index = Math.max(0, (op.startLine ?? 1) - 1);
            workingLines.splice(index, 0, ...(op.lines || []));
            break;
          }
          case 'INSERT_AFTER': {
            const index = Math.min(workingLines.length, op.startLine ?? workingLines.length);
            workingLines.splice(index, 0, ...(op.lines || []));
            break;
          }
          case 'APPEND': {
            workingLines.push(...(op.lines || []));
            break;
          }
          case 'CUT': {
            const start = (op.startLine ?? 1) - 1;
            const end = op.endLine ?? op.startLine ?? 1;
            const deleteCount = Math.max(0, end - start);
            const cutLines = workingLines.splice(start, deleteCount);
            if (op.registerName) {
              memoryRegisters.set(op.registerName, cutLines);
            }
            break;
          }
          case 'REMOVE': {
            filesToDelete.add(resolvedPath);
            break;
          }
          case 'MOVE': {
            if (op.destinationPath) {
              const destResolved = path.resolve(this.baseDir, op.destinationPath);
              filesToRename.set(resolvedPath, destResolved);
            }
            break;
          }
        }
      }

      buffer.lines = workingLines;
      const newText = workingLines.join('\n');
      const newTag = computeSnapshotTag(newText);
      outcomes.push({
        filePath: section.filePath,
        oldTag: buffer.currentTag,
        newTag,
        linesChanged: Math.abs(workingLines.length - (buffer.originalContent ? buffer.originalContent.split('\n').length : 0)),
        appliedOperations: opCount,
      });
    }

    // Step 3: Atomic Commit Phase (Write all changes to disk)
    try {
      // Handle file deletions
      for (const fileToDelete of filesToDelete) {
        await fs.rm(fileToDelete, { force: true });
        fileBuffers.delete(fileToDelete);
      }

      // Handle file renames
      for (const [oldPath, newPath] of filesToRename.entries()) {
        await fs.mkdir(path.dirname(newPath), { recursive: true });
        const buf = fileBuffers.get(oldPath);
        if (buf) {
          fileBuffers.delete(oldPath);
          fileBuffers.set(newPath, buf);
        }
        await fs.rm(oldPath, { force: true });
      }

      // Write updated and new files
      for (const [filePath, buffer] of fileBuffers.entries()) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        let outText = buffer.lines.join(this.config.preserveLineEndings ? buffer.lineEnding : '\n');
        if (buffer.hasTrailingNewline && outText.length > 0 && !outText.endsWith('\n')) {
          outText += (this.config.preserveLineEndings ? buffer.lineEnding : '\n');
        }
        if (buffer.hasBom) {
          outText = '\ufeff' + outText;
        }
        await fs.writeFile(filePath, outText, 'utf8');

        // Record new snapshot in store
        this.snapshotStore.recordSnapshot(filePath, outText);
      }

      return {
        success: true,
        modifiedFiles: outcomes,
        atomicityPreserved: true,
      };
    } catch (err: any) {
      // In case of I/O failure during disk write, attempt rollback of original contents
      for (const [filePath, buffer] of fileBuffers.entries()) {
        try {
          if (!buffer.isNew) {
            await fs.writeFile(filePath, buffer.originalContent, 'utf8');
          }
        } catch {
          // ignore secondary rollback errors
        }
      }
      return {
        success: false,
        error: `I/O error during patch commit: ${err.message}`,
        atomicityPreserved: false,
      };
    }
  }

  /**
   * Previews a patch and returns line-by-line diff or errors without modifying disk.
   */
  public async preflight(patchInput: string | HashlinePatch): Promise<{ valid: boolean; error?: string; stale?: boolean }> {
    const patch = typeof patchInput === 'string' ? parseHashlinePatch(patchInput) : patchInput;

    for (const section of patch.sections) {
      const resolvedPath = path.resolve(this.baseDir, section.filePath);
      try {
        const content = await fs.readFile(resolvedPath, 'utf8');
        const tag = computeSnapshotTag(content);
        if (section.expectedTag && section.expectedTag.toLowerCase() !== tag.toLowerCase()) {
          return {
            valid: false,
            stale: true,
            error: `Stale anchor in ${section.filePath}: expected #${section.expectedTag}, actual #${tag}`,
          };
        }
      } catch (err: any) {
        if (err.code !== 'ENOENT' && !section.expectedTag) {
          return { valid: false, error: err.message };
        }
      }
    }
    return { valid: true };
  }
}

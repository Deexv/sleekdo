import type { HashlineOp, HashlinePatch, HashlineSection } from './types.js';

/**
 * Parses raw text in Hashline patch format.
 */
export function parseHashlinePatch(patchText: string): HashlinePatch {
  const lines = patchText.split(/\r?\n/);
  const sections: HashlineSection[] = [];

  let inPatch = false;
  let currentSection: HashlineSection | null = null;
  let currentOp: HashlineOp | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed === '*** Begin Patch') {
      inPatch = true;
      continue;
    }
    if (trimmed === '*** End Patch') {
      if (currentOp && currentSection) {
        currentSection.operations.push(currentOp);
        currentOp = null;
      }
      if (currentSection) {
        sections.push(currentSection);
        currentSection = null;
      }
      inPatch = false;
      break;
    }

    if (!inPatch) {
      // Allow patches without explicit Begin/End delimiters if they start with a section header
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        inPatch = true;
      } else {
        continue;
      }
    }

    // Section header: [filePath#tag] or [filePath]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      if (currentOp && currentSection) {
        currentSection.operations.push(currentOp);
        currentOp = null;
      }
      if (currentSection) {
        sections.push(currentSection);
      }

      const inner = trimmed.slice(1, -1).trim();
      const hashIdx = inner.lastIndexOf('#');
      let filePath: string;
      let expectedTag: string | undefined;

      if (hashIdx !== -1) {
        filePath = inner.slice(0, hashIdx).trim();
        expectedTag = inner.slice(hashIdx + 1).trim();
      } else {
        filePath = inner;
      }

      currentSection = {
        filePath,
        expectedTag,
        operations: [],
      };
      continue;
    }

    if (!currentSection) continue;

    // Operation headers
    // 1. PUT N.=M: (replace inclusive range)
    const replaceMatch = trimmed.match(/^PUT\s+(\d+)\.=(\d+):/i);
    if (replaceMatch) {
      if (currentOp) currentSection.operations.push(currentOp);
      currentOp = {
        type: 'REPLACE',
        startLine: parseInt(replaceMatch[1], 10),
        endLine: parseInt(replaceMatch[2], 10),
        lines: [],
        raw: rawLine,
      };
      continue;
    }

    // 2. PUT <N: (insert before line N)
    const insertBeforeMatch = trimmed.match(/^PUT\s+<(\d+):/i);
    if (insertBeforeMatch) {
      if (currentOp) currentSection.operations.push(currentOp);
      currentOp = {
        type: 'INSERT_BEFORE',
        startLine: parseInt(insertBeforeMatch[1], 10),
        lines: [],
        raw: rawLine,
      };
      continue;
    }

    // 3. PUT >N: (insert after line N)
    const insertAfterMatch = trimmed.match(/^PUT\s+>(\d+):/i);
    if (insertAfterMatch) {
      if (currentOp) currentSection.operations.push(currentOp);
      currentOp = {
        type: 'INSERT_AFTER',
        startLine: parseInt(insertAfterMatch[1], 10),
        lines: [],
        raw: rawLine,
      };
      continue;
    }

    // 4. PUT >$: (append to end of file)
    if (/^PUT\s+>\$:?/i.test(trimmed)) {
      if (currentOp) currentSection.operations.push(currentOp);
      currentOp = {
        type: 'APPEND',
        lines: [],
        raw: rawLine,
      };
      continue;
    }

    // 5. CUT N.=M [@name]
    const cutMatch = trimmed.match(/^CUT\s+(\d+)\.=(\d+)(?:\s+@(\w+))?/i);
    if (cutMatch) {
      if (currentOp) currentSection.operations.push(currentOp);
      currentSection.operations.push({
        type: 'CUT',
        startLine: parseInt(cutMatch[1], 10),
        endLine: parseInt(cutMatch[2], 10),
        registerName: cutMatch[3],
        raw: rawLine,
      });
      currentOp = null;
      continue;
    }

    // 6. REM (delete file)
    if (/^REM\b/i.test(trimmed)) {
      if (currentOp) currentSection.operations.push(currentOp);
      currentSection.operations.push({
        type: 'REMOVE',
        raw: rawLine,
      });
      currentOp = null;
      continue;
    }

    // 7. MV <dest>
    const mvMatch = trimmed.match(/^MV\s+(.+)$/i);
    if (mvMatch) {
      if (currentOp) currentSection.operations.push(currentOp);
      currentSection.operations.push({
        type: 'MOVE',
        destinationPath: mvMatch[1].trim(),
        raw: rawLine,
      });
      currentOp = null;
      continue;
    }

    // Body line starting with '+'
    if (rawLine.startsWith('+')) {
      if (currentOp && currentOp.lines) {
        // Strip the single leading '+'
        let bodyLine = rawLine.slice(1);
        // Special unescaping: '+- text' -> '- text', '++ text' -> '+ text'
        if (bodyLine.startsWith('- ') || bodyLine.startsWith('+ ')) {
          // escaped prefix
        }
        currentOp.lines.push(bodyLine);
      }
      continue;
    }
  }

  if (currentOp && currentSection) {
    currentSection.operations.push(currentOp);
  }
  if (currentSection) {
    sections.push(currentSection);
  }

  return { sections, raw: patchText };
}

/**
 * Hashline Types & Interfaces (Sections 15, 16, 17)
 */

export type HashlineOpType =
  | 'REPLACE'    // PUT N.=M:
  | 'INSERT_BEFORE' // PUT <N:
  | 'INSERT_AFTER'  // PUT >N:
  | 'APPEND'     // PUT >$:
  | 'CUT'        // CUT N.=M
  | 'REMOVE'     // REM
  | 'MOVE';      // MV <dest>

export interface HashlineOp {
  type: HashlineOpType;
  startLine?: number;
  endLine?: number;
  lines?: string[];
  registerName?: string;
  destinationPath?: string;
  raw: string;
}

export interface HashlineSection {
  filePath: string;
  expectedTag?: string;
  operations: HashlineOp[];
}

export interface HashlinePatch {
  sections: HashlineSection[];
  raw: string;
}

export interface HashlineConfig {
  editMode: 'hashline' | 'replace' | 'patch';
  fuzzyMatching: boolean;
  fuzzyThreshold: number;
  blockGeneratedFiles: boolean;
  preserveLineEndings: boolean;
}

export interface FileEditOutcome {
  filePath: string;
  oldTag: string;
  newTag: string;
  linesChanged: number;
  appliedOperations: number;
}

export interface HashlineApplyResult {
  success: boolean;
  error?: string;
  staleDetected?: boolean;
  conflictingFiles?: string[];
  modifiedFiles?: FileEditOutcome[];
  atomicityPreserved: boolean;
}

export interface SnapshotRecord {
  filePath: string;
  tag: string;
  content: string;
  timestamp: number;
}

/**
 * Domain types and invariants for Sleekdo orchestrator.
 */

export type TaskId = string;
export type SubtaskId = string;
export type RequirementId = string;
export type ReviewId = string;
export type InvestigationId = string;
export type SnapshotId = string;
export type EventId = string;

/**
 * Task lifecycle statuses per PRD Section 7.
 * PENDING -> READY -> IN_PROGRESS -> AWAITING_REVIEW -> APPROVED
 * Rejected flow: AWAITING_REVIEW -> REJECTED -> REMEDIATION_REQUIRED -> SUBTASKS_CREATED -> IN_PROGRESS
 * Terminal: APPROVED
 * Special: BLOCKED, DEFERRED
 */
export type TaskStatus =
  | 'PENDING'
  | 'READY'
  | 'IN_PROGRESS'
  | 'AWAITING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'REMEDIATION_REQUIRED'
  | 'SUBTASKS_CREATED'
  | 'BLOCKED'
  | 'DEFERRED';

export type TaskType =
  | 'task'
  | 'subtask'
  | 'remediation'
  | 'integration'
  | 'regression'
  | 'refactoring'
  | 'testing'
  | 'cleanup';

export interface Task {
  id: TaskId;
  parentId: TaskId | null;
  type: TaskType;
  title: string;
  objective: string;
  requirements: string[];
  acceptanceCriteria: string[];
  dependencies: TaskId[];
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  approvedAt?: number;
  rejectionHistory?: TaskRejection[];
  remediationRequirements?: string[];
  subtaskIds?: TaskId[];
  metadata?: Record<string, unknown>;
}

export interface TaskRejection {
  reviewId: ReviewId;
  timestamp: number;
  problem: string;
  evidence: string;
  affectedRequirement: string;
  requiredCorrection: string;
  verificationCriteria: string;
}

export type ProjectStatus =
  | 'INITIALIZING'
  | 'PLANNING'
  | 'PLAN_REVIEW'
  | 'EXECUTING'
  | 'REVIEWING'
  | 'REASSESSING'
  | 'FINAL_CLEANUP'
  | 'FINAL_VERIFICATION'
  | 'BLOCKED'
  | 'COMPLETE'
  | 'FAILED';

export interface Requirement {
  id: RequirementId;
  description: string;
  source: 'user_request' | 'implementation_discovery';
  originatingTaskId?: TaskId;
  status: 'pending' | 'in_progress' | 'satisfied' | 'blocked';
  taskIds: TaskId[];
  verificationCriteria: string[];
  verifiedAt?: number;
}

export type ReviewDecision = 'APPROVE' | 'REJECT' | 'BLOCK';

export interface BlockingIssue {
  description: string;
  evidence: string;
  affectedRequirement: string;
  requiredFix: string;
  verification: string;
}

export interface ReviewResult {
  id: ReviewId;
  taskId: TaskId;
  stateRevision: number;
  workspaceSnapshotSha: string;
  reviewerProvider: string;
  reviewerModel: string;
  startedAt: number;
  completedAt: number;
  decision: ReviewDecision;
  summary: string;
  requirementCompliance: boolean;
  acceptanceCriteriaMet: boolean;
  implementationExists: boolean;
  testsPass: boolean;
  noRegressions: boolean;
  scopeControlled: boolean;
  noDeadCodeIntroduced: boolean;
  blockingIssues: BlockingIssue[];
  notes?: string;
}

export type DeadCodeClassification =
  | 'CONFIRMED_DEAD'
  | 'PROBABLY_DEAD'
  | 'DYNAMICALLY_REFERENCED'
  | 'UNKNOWN'
  | 'REQUIRED';

export interface DeadCodeItem {
  id: string;
  file: string;
  symbol?: string;
  type: 'file' | 'function' | 'class' | 'export' | 'dependency' | 'diagnostic';
  classification: DeadCodeClassification;
  reason: string;
  referencesFound: string[];
  remediationTaskId?: TaskId;
  actionTaken?: 'removed' | 'retained_with_justification';
  justification?: string;
}

export interface InvestigationHypothesis {
  id: string;
  description: string;
  status: 'untested' | 'surviving' | 'eliminated';
  evidence?: string;
}

export interface Investigation {
  id: InvestigationId;
  taskId: TaskId;
  observedFailure: {
    expected: string;
    actual: string;
    scenario: string;
  };
  hypotheses: InvestigationHypothesis[];
  confirmedMechanism?: {
    description: string;
    evidence: string[];
  };
  fixPlan?: {
    description: string;
    smallestScopeFiles: string[];
    regressionTestPlan: string;
  };
  status: 'active' | 'confirmed' | 'resolved' | 'abandoned';
  createdAt: number;
  updatedAt: number;
}

export interface WorkspaceSnapshot {
  id: SnapshotId;
  timestamp: number;
  dependencies?: Record<string, string>;
  configurationFiles?: Record<string, string>;
  files: Record<string, { size: number; sha256: string }>;
  gitCommit?: string;
  gitStatusSummary?: string;
  totalFiles: number;
}

export interface WorkspaceDiff {
  beforeSnapshotId: SnapshotId;
  afterSnapshotId: SnapshotId;
  createdFiles: string[];
  modifiedFiles: string[];
  deletedFiles: string[];
  createdDirectories: string[];
  deletedDirectories: string[];
  changedDependencies: string[];
  changedConfiguration: string[];
}

export type EventType =
  | 'USER_REQUEST'
  | 'PLAN_CREATED'
  | 'PLAN_REVISED'
  | 'PLAN_APPROVED'
  | 'PLAN_REJECTED'
  | 'TASK_CREATED'
  | 'TASK_STARTED'
  | 'TASK_COMPLETION_CANDIDATE'
  | 'TASK_REVIEW_STARTED'
  | 'TASK_APPROVED'
  | 'TASK_REJECTED'
  | 'TASK_BLOCKED'
  | 'TASK_DEFERRED'
  | 'SUBTASK_CREATED'
  | 'SUBTASK_STARTED'
  | 'SUBTASK_APPROVED'
  | 'SUBTASK_REJECTED'
  | 'A1_MESSAGE'
  | 'A1_TOOL_CALL'
  | 'A1_TOOL_RESULT'
  | 'FILE_CREATED'
  | 'FILE_MODIFIED'
  | 'FILE_DELETED'
  | 'COMMAND_STARTED'
  | 'COMMAND_FINISHED'
  | 'TEST_STARTED'
  | 'TEST_FINISHED'
  | 'A3_REVIEW_STARTED'
  | 'A3_APPROVED'
  | 'A3_REJECTED'
  | 'PROJECT_REASSESSMENT'
  | 'PROJECT_COMPLETION_CHECK'
  | 'PROJECT_APPROVED'
  | 'PROJECT_BLOCKED'
  | 'HUMAN_OVERRIDE'
  | 'AUTO_RETRY'
  | 'CRASH_RECOVERED';

export interface SleekdoEvent {
  id: EventId;
  revision: number;
  timestamp: number;
  type: EventType;
  actor: 'ORCHESTRATOR' | 'A1' | 'A2' | 'A3' | 'USER' | 'SYSTEM';
  taskId?: TaskId;
  data: Record<string, unknown>;
}

export interface PlanVersionRecord {
  version: number;
  timestamp: number;
  reason: string;
  changesSummary: string;
  affectedRequirements: RequirementId[];
  affectedTasks: TaskId[];
  approvalState: 'approved' | 'rejected' | 'pending';
}

export interface SleekdoState {
  revision: number;
  projectId: string;
  originalRequest: string;
  status: ProjectStatus;
  planVersion: number;
  planHistory?: PlanVersionRecord[];
  isPaused?: boolean;
  currentTaskId: TaskId | null;
  activeSessionId?: string;
  workspaceLock?: {
    locked: boolean;
    lockedBy: 'A1' | 'A3' | 'ORCHESTRATOR';
    lockedAt: number;
    pid: number;
    reason: string;
  };
  tasks: Record<TaskId, Task>;
  requirements: Record<RequirementId, Requirement>;
  reviews: Record<ReviewId, ReviewResult>;
  investigations: Record<InvestigationId, Investigation>;
  cleanupFindings: DeadCodeItem[];
  snapshots: Record<SnapshotId, WorkspaceSnapshot>;
  completionState?: {
    isComplete: boolean;
    satisfiedAt?: number;
    verificationSummary?: Record<string, unknown>;
  };
  updatedAt: number;
}


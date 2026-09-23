import { Task, TaskStatus, TaskId } from '../types/domain.js';

export class InvalidStateTransitionError extends Error {
  constructor(public readonly taskId: TaskId, public readonly currentStatus: TaskStatus, public readonly targetStatus: TaskStatus, reason?: string) {
    super(`Invalid task state transition for ${taskId}: ${currentStatus} -> ${targetStatus}${reason ? ` (${reason})` : ''}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export class DependencyNotMetError extends Error {
  constructor(public readonly taskId: TaskId, public readonly unresolvedDependencyId: TaskId) {
    super(`Cannot advance task ${taskId}: dependent task ${unresolvedDependencyId} is not approved.`);
    this.name = 'DependencyNotMetError';
  }
}

/**
 * TaskStateMachine enforces PRD Section 7 state transitions and invariants.
 */
export class TaskStateMachine {
  private static readonly VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
    PENDING: ['READY', 'BLOCKED', 'DEFERRED'],
    READY: ['IN_PROGRESS', 'BLOCKED', 'DEFERRED'],
    IN_PROGRESS: ['AWAITING_REVIEW', 'BLOCKED'],
    AWAITING_REVIEW: ['APPROVED', 'REJECTED', 'BLOCKED'],
    REJECTED: ['REMEDIATION_REQUIRED'],
    REMEDIATION_REQUIRED: ['SUBTASKS_CREATED', 'IN_PROGRESS', 'BLOCKED'],
    SUBTASKS_CREATED: ['IN_PROGRESS', 'READY', 'BLOCKED'],
    APPROVED: [], // Terminal
    BLOCKED: ['READY', 'DEFERRED', 'REMEDIATION_REQUIRED'],
    DEFERRED: ['READY', 'PENDING'],
  };

  /**
   * Validates if a transition is legal.
   */
  public static canTransition(current: TaskStatus, target: TaskStatus): boolean {
    const allowed = this.VALID_TRANSITIONS[current] || [];
    return allowed.includes(target);
  }

  /**
   * Asserts transition validity. Throws if invalid.
   */
  public static assertCanTransition(task: Task, target: TaskStatus, allTasks: Record<TaskId, Task>): void {
    if (!this.canTransition(task.status, target)) {
      throw new InvalidStateTransitionError(task.id, task.status, target);
    }

    // Task skip prevention: When transitioning to READY or IN_PROGRESS, dependencies must be checked
    if (target === 'READY' || target === 'IN_PROGRESS') {
      for (const depId of task.dependencies) {
        const dep = allTasks[depId];
        if (!dep) {
          throw new DependencyNotMetError(task.id, depId);
        }
        if (dep.status !== 'APPROVED') {
          throw new DependencyNotMetError(task.id, depId);
        }
      }
    }

    // Subtask invariant: parent cannot be APPROVED until all subtasks are APPROVED
    if (target === 'APPROVED' && task.subtaskIds && task.subtaskIds.length > 0) {
      for (const subId of task.subtaskIds) {
        const sub = allTasks[subId];
        if (sub && sub.status !== 'APPROVED') {
          throw new InvalidStateTransitionError(task.id, task.status, target, `Subtask ${subId} is not approved yet (status: ${sub.status})`);
        }
      }
    }
  }

  /**
   * Applies transition to a task draft.
   */
  public static transition(task: Task, target: TaskStatus, allTasks: Record<TaskId, Task>): Task {
    this.assertCanTransition(task, target, allTasks);
    task.status = target;
    task.updatedAt = Date.now();
    if (target === 'APPROVED') {
      task.approvedAt = Date.now();
    }
    return task;
  }
}

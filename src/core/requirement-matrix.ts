import { Requirement, RequirementId, TaskId, Task } from '../types/domain.js';
import { StateStore } from '../storage/state-store.js';

export class RequirementMatrix {
  private readonly stateStore: StateStore;

  constructor(stateStore: StateStore) {
    this.stateStore = stateStore;
  }

  public registerRequirement(req: Omit<Requirement, 'status'>): Requirement {
    let created: Requirement | undefined;
    this.stateStore.updateState((draft) => {
      const full: Requirement = {
        ...req,
        status: 'pending',
      };
      draft.requirements[req.id] = full;
      created = full;
    });
    return created!;
  }

  public linkTaskToRequirement(reqId: RequirementId, taskId: TaskId): void {
    this.stateStore.updateState((draft) => {
      const req = draft.requirements[reqId];
      if (req && !req.taskIds.includes(taskId)) {
        req.taskIds.push(taskId);
      }
    });
  }

  public updateRequirementStatus(reqId: RequirementId, status: Requirement['status']): void {
    this.stateStore.updateState((draft) => {
      const req = draft.requirements[reqId];
      if (req) {
        req.status = status;
        if (status === 'satisfied') {
          req.verifiedAt = Date.now();
        }
      }
    });
  }

  public evaluateCoverage(): {
    total: number;
    satisfied: number;
    pending: number;
    blocked: number;
    inProgress: number;
    orphaned: RequirementId[];
    allSatisfied: boolean;
  } {
    const state = this.stateStore.getState();
    const requirements = Object.values(state.requirements);
    const tasks = state.tasks;

    let satisfied = 0;
    let pending = 0;
    let blocked = 0;
    let inProgress = 0;
    const orphaned: RequirementId[] = [];

    for (const req of requirements) {
      if (req.taskIds.length === 0) {
        orphaned.push(req.id);
      }

      // Check whether all linked tasks are APPROVED
      const linkedTasks = req.taskIds.map((id) => tasks[id]).filter(Boolean);
      const hasTasks = linkedTasks.length > 0;
      const allTasksApproved = hasTasks && linkedTasks.every((t) => t.status === 'APPROVED');
      const anyBlocked = linkedTasks.some((t) => t.status === 'BLOCKED');
      const anyInProgress = linkedTasks.some((t) => t.status === 'IN_PROGRESS' || t.status === 'AWAITING_REVIEW');

      if (allTasksApproved && (req.status === 'satisfied' || hasTasks)) {
        satisfied++;
      } else if (anyBlocked) {
        blocked++;
      } else if (anyInProgress) {
        inProgress++;
      } else {
        pending++;
      }
    }

    return {
      total: requirements.length,
      satisfied,
      pending,
      blocked,
      inProgress,
      orphaned,
      allSatisfied: requirements.length > 0 && satisfied === requirements.length,
    };
  }
}

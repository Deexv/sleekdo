import { StateStore } from '../storage/state-store.js';
import { EventStore } from '../storage/event-store.js';
import { WorkspaceLock } from './workspace-lock.js';
import { SnapshotEngine } from '../evidence/snapshot-engine.js';
import { Task, TaskStatus } from '../types/domain.js';

export interface RecoveryReport {
  recovered: boolean;
  activeTaskId: string | null;
  previousTaskStatus: TaskStatus | null;
  actionTaken: string;
  unlockedWorkspace: boolean;
}

export class CrashRecovery {
  private readonly stateStore: StateStore;
  private readonly eventStore: EventStore;
  private readonly lock: WorkspaceLock;
  private readonly snapshotEngine: SnapshotEngine;

  constructor(
    stateStore: StateStore,
    eventStore: EventStore,
    lock: WorkspaceLock,
    snapshotEngine: SnapshotEngine
  ) {
    this.stateStore = stateStore;
    this.eventStore = eventStore;
    this.lock = lock;
    this.snapshotEngine = snapshotEngine;
  }

  public recover(): RecoveryReport {
    const state = this.stateStore.getState();
    let unlocked = false;

    // 1. Check and heal stale lock
    if (this.lock.isLocked()) {
      this.lock.unlock();
      unlocked = true;
    }

    const currentTaskId = state.currentTaskId;
    if (!currentTaskId) {
      return {
        recovered: false,
        activeTaskId: null,
        previousTaskStatus: null,
        actionTaken: 'No active task found on restart; clean state.',
        unlockedWorkspace: unlocked,
      };
    }

    const task = state.tasks[currentTaskId];
    if (!task) {
      this.stateStore.updateState((draft) => {
        draft.currentTaskId = null;
      });
      return {
        recovered: true,
        activeTaskId: currentTaskId,
        previousTaskStatus: null,
        actionTaken: 'Active task reference cleared (task not found in state).',
        unlockedWorkspace: unlocked,
      };
    }

    const prevStatus = task.status;
    let actionTaken = '';

    // If task was IN_PROGRESS when crash occurred, we must not assume completion.
    // Transition back to READY so it can safely execute from beginning or continue.
    if (task.status === 'IN_PROGRESS') {
      this.stateStore.updateState((draft) => {
        const t = draft.tasks[currentTaskId];
        if (t) {
          t.status = 'READY';
          t.updatedAt = Date.now();
        }
      });
      actionTaken = `Interrupted task ${currentTaskId} reset from IN_PROGRESS to READY.`;
    } else if (task.status === 'AWAITING_REVIEW') {
      // Review was interrupted mid-flight; remains in AWAITING_REVIEW to trigger a fresh review session
      actionTaken = `Task ${currentTaskId} in AWAITING_REVIEW preserved for fresh verification session.`;
    } else {
      actionTaken = `Task ${currentTaskId} remains in ${task.status}.`;
    }

    this.eventStore.appendEvent(
      state.revision,
      'CRASH_RECOVERED',
      'ORCHESTRATOR',
      {
        taskId: currentTaskId,
        previousStatus: prevStatus,
        actionTaken,
        unlocked,
      },
      currentTaskId
    );

    return {
      recovered: true,
      activeTaskId: currentTaskId,
      previousTaskStatus: prevStatus,
      actionTaken,
      unlockedWorkspace: unlocked,
    };
  }
}

import { DeadCodeAnalyzer } from '../analysis/dead-code-analyzer.js';
import { StateStore } from '../storage/state-store.js';
import { DeadCodeItem, Task, TaskId } from '../types/domain.js';

export class CleanupManager {
  private readonly deadCodeAnalyzer: DeadCodeAnalyzer;
  private readonly stateStore: StateStore;

  constructor(deadCodeAnalyzer: DeadCodeAnalyzer, stateStore: StateStore) {
    this.deadCodeAnalyzer = deadCodeAnalyzer;
    this.stateStore = stateStore;
  }

  public runSweep(): DeadCodeItem[] {
    const findings = this.deadCodeAnalyzer.analyzeAll();
    this.stateStore.updateState((draft) => {
      draft.cleanupFindings = findings;
    });
    return findings;
  }

  public generateCleanupTasks(parentTaskId?: TaskId): Task[] {
    const state = this.stateStore.getState();
    const confirmedDead = state.cleanupFindings.filter((item) => item.classification === 'CONFIRMED_DEAD' && !item.remediationTaskId);

    const createdTasks: Task[] = [];

    for (const item of confirmedDead) {
      const taskId: TaskId = `cleanup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const subtask1Id: TaskId = `${taskId}.1`;
      const subtask2Id: TaskId = `${taskId}.2`;
      const subtask3Id: TaskId = `${taskId}.3`;

      const subtask1: Task = {
        id: subtask1Id,
        parentId: taskId,
        type: 'subtask',
        title: `Verify no runtime/build references for ${item.file}`,
        objective: `Confirm file ${item.file} is truly unreferenced before removal.`,
        requirements: [`Verify absence of imports or runtime loading for ${item.file}`],
        acceptanceCriteria: [`Verification command or search confirms no usage of ${item.file}`],
        dependencies: [],
        status: 'READY',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const subtask2: Task = {
        id: subtask2Id,
        parentId: taskId,
        type: 'subtask',
        title: `Remove dead file ${item.file}`,
        objective: `Safely delete confirmed dead file ${item.file}.`,
        requirements: [`Remove file ${item.file} from the project`],
        acceptanceCriteria: [`File ${item.file} no longer exists on filesystem`],
        dependencies: [subtask1Id],
        status: 'PENDING',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const subtask3: Task = {
        id: subtask3Id,
        parentId: taskId,
        type: 'subtask',
        title: `Run regression verification after deleting ${item.file}`,
        objective: `Verify project tests and build succeed after removing ${item.file}.`,
        requirements: [`Build passes`, `Tests pass`],
        acceptanceCriteria: [`Test suite completes cleanly without errors`],
        dependencies: [subtask2Id],
        status: 'PENDING',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const mainTask: Task = {
        id: taskId,
        parentId: parentTaskId || null,
        type: 'cleanup',
        title: `Remove confirmed dead code: ${item.file}`,
        objective: `Clean up confirmed obsolete file ${item.file} and verify no regression.`,
        requirements: [`Remove ${item.file}`, `Ensure project builds and tests pass`],
        acceptanceCriteria: [
          `Confirmed unreferenced`,
          `File removed`,
          `Regression tests pass cleanly`,
        ],
        dependencies: [],
        status: 'READY',
        subtaskIds: [subtask1Id, subtask2Id, subtask3Id],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.stateStore.updateState((draft) => {
        draft.tasks[taskId] = mainTask;
        draft.tasks[subtask1Id] = subtask1;
        draft.tasks[subtask2Id] = subtask2;
        draft.tasks[subtask3Id] = subtask3;

        const found = draft.cleanupFindings.find((f) => f.id === item.id);
        if (found) found.remediationTaskId = taskId;
      });

      createdTasks.push(mainTask, subtask1, subtask2, subtask3);
    }

    return createdTasks;
  }
}

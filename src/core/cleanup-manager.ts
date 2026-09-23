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

      const targetDesc = item.symbol ? `${item.symbol} in ${item.file}` : item.file;
      const isDep = item.type === 'dependency';

      const subtask1: Task = {
        id: subtask1Id,
        parentId: taskId,
        type: 'subtask',
        title: isDep ? `Verify no imports or usage for package ${item.symbol}` : `Verify no runtime/build references for ${targetDesc}`,
        objective: isDep ? `Confirm dependency ${item.symbol} is unneeded.` : `Confirm ${targetDesc} is truly unreferenced before removal.`,
        requirements: [isDep ? `Verify zero import/require statements for ${item.symbol}` : `Verify absence of imports or runtime loading for ${targetDesc}`],
        acceptanceCriteria: [`Verification confirms no usage of ${targetDesc}`],
        dependencies: [],
        status: 'READY',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const subtask2: Task = {
        id: subtask2Id,
        parentId: taskId,
        type: 'subtask',
        title: isDep ? `Remove dependency ${item.symbol} from package.json` : `Remove dead code in ${targetDesc}`,
        objective: isDep ? `Safely remove package ${item.symbol} from package.json.` : `Safely delete confirmed dead code ${targetDesc}.`,
        requirements: [isDep ? `Remove package ${item.symbol} from package.json` : `Remove dead code ${targetDesc}`],
        acceptanceCriteria: [isDep ? `Package ${item.symbol} is no longer declared in package.json` : `Dead code ${targetDesc} is removed`],
        dependencies: [subtask1Id],
        status: 'PENDING',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const subtask3: Task = {
        id: subtask3Id,
        parentId: taskId,
        type: 'subtask',
        title: `Run regression verification after removing ${targetDesc}`,
        objective: `Verify project tests and build succeed after removing ${targetDesc}.`,
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
        title: isDep ? `Remove unneeded dependency: ${item.symbol}` : `Remove confirmed dead code: ${targetDesc}`,
        objective: `Clean up confirmed obsolete ${isDep ? 'package' : 'code'} ${targetDesc} and verify no regression.`,
        requirements: [`Remove ${targetDesc}`, `Ensure project builds and tests pass`],
        acceptanceCriteria: [
          `Confirmed unreferenced`,
          `Obsolete artifact removed`,
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

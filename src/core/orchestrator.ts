import * as path from 'node:path';
import { StateStore } from '../storage/state-store.js';
import { EventStore } from '../storage/event-store.js';
import { ArtifactStore } from '../storage/artifact-store.js';
import { TaskStateMachine } from './state-machine.js';
import { WorkspaceLock } from './workspace-lock.js';
import { CrashRecovery } from './crash-recovery.js';
import { RequirementMatrix } from './requirement-matrix.js';
import { InvestigationSystem } from './investigation-system.js';
import { ReviewContextBuilder } from './review-context-builder.js';
import { FinalVerifier } from './final-verifier.js';
import { CleanupManager } from './cleanup-manager.js';
import { FilesystemEngine } from '../evidence/filesystem-engine.js';
import { GitEngine } from '../evidence/git-engine.js';
import { CommandEngine } from '../evidence/command-engine.js';
import { TestEngine } from '../evidence/test-engine.js';
import { SnapshotEngine } from '../evidence/snapshot-engine.js';
import { DeadCodeAnalyzer } from '../analysis/dead-code-analyzer.js';
import { AgentAdapter } from '../adapters/agent-adapter.js';
import { A1Worker } from '../roles/a1-worker.js';
import { A2Planner } from '../roles/a2-planner.js';
import { A3Reviewer } from '../roles/a3-reviewer.js';
import { Task, TaskId, TaskStatus, ReviewResult, SleekdoState } from '../types/domain.js';

export interface OrchestratorOptions {
  workspaceDir: string;
  workerAdapter: AgentAdapter;
  plannerAdapter?: AgentAdapter;
  reviewerAdapter?: AgentAdapter;
  maxConsecutiveRejections?: number;
  testCommand?: string;
  testArgs?: string[];
  maxIterations?: number;
}

export class Orchestrator {
  public readonly workspaceDir: string;
  public readonly stateStore: StateStore;
  public readonly eventStore: EventStore;
  public readonly artifactStore: ArtifactStore;
  public readonly lock: WorkspaceLock;
  public readonly crashRecovery: CrashRecovery;
  public readonly reqMatrix: RequirementMatrix;
  public readonly investigationSystem: InvestigationSystem;
  public readonly fsEngine: FilesystemEngine;
  public readonly gitEngine: GitEngine;
  public readonly commandEngine: CommandEngine;
  public readonly testEngine: TestEngine;
  public readonly snapshotEngine: SnapshotEngine;
  public readonly deadCodeAnalyzer: DeadCodeAnalyzer;
  public readonly cleanupManager: CleanupManager;
  public readonly reviewContextBuilder: ReviewContextBuilder;
  public readonly finalVerifier: FinalVerifier;

  public readonly worker: A1Worker;
  public readonly planner: A2Planner;
  public readonly reviewer: A3Reviewer;

  private readonly maxConsecutiveRejections: number;
  private readonly testCommand?: string;
  private readonly testArgs?: string[];
  private readonly maxIterations: number;
  private rejectionCounts = new Map<TaskId, number>();

  constructor(options: OrchestratorOptions) {
    this.workspaceDir = path.resolve(options.workspaceDir);
    this.maxConsecutiveRejections = options.maxConsecutiveRejections || 3;
    this.testCommand = options.testCommand;
    this.testArgs = options.testArgs;
    this.maxIterations = options.maxIterations || 50;

    this.stateStore = new StateStore(this.workspaceDir);
    this.eventStore = new EventStore(this.workspaceDir);
    this.artifactStore = new ArtifactStore(this.workspaceDir);
    this.lock = new WorkspaceLock(this.workspaceDir);

    this.fsEngine = new FilesystemEngine(this.workspaceDir);
    this.gitEngine = new GitEngine(this.workspaceDir);
    this.commandEngine = new CommandEngine(this.workspaceDir);
    this.testEngine = new TestEngine(this.commandEngine, this.workspaceDir);
    this.snapshotEngine = new SnapshotEngine(this.fsEngine, this.gitEngine);
    this.deadCodeAnalyzer = new DeadCodeAnalyzer(this.workspaceDir, this.fsEngine);
    this.cleanupManager = new CleanupManager(this.deadCodeAnalyzer, this.stateStore);
    this.reqMatrix = new RequirementMatrix(this.stateStore);
    this.investigationSystem = new InvestigationSystem(this.stateStore);
    this.reviewContextBuilder = new ReviewContextBuilder(this.fsEngine);
    this.finalVerifier = new FinalVerifier(this.stateStore, this.reqMatrix, this.testEngine, this.deadCodeAnalyzer);
    this.crashRecovery = new CrashRecovery(this.stateStore, this.eventStore, this.lock, this.snapshotEngine);

    const workerAdapter = options.workerAdapter;
    const plannerAdapter = options.plannerAdapter || options.workerAdapter;
    const reviewerAdapter = options.reviewerAdapter || options.workerAdapter;

    this.worker = new A1Worker(workerAdapter, this.workspaceDir);
    this.planner = new A2Planner(plannerAdapter, this.workspaceDir);
    this.reviewer = new A3Reviewer(reviewerAdapter, this.workspaceDir);
  }

  public async initialize(userRequest: string): Promise<void> {
    // 1. Crash recovery check on startup
    const recoveryReport = this.crashRecovery.recover();
    if (recoveryReport.recovered) {
      this.eventStore.appendEvent(
        this.stateStore.getRevision(),
        'CRASH_RECOVERED',
        'ORCHESTRATOR',
        recoveryReport as unknown as Record<string, unknown>
      );
    }

    const state = this.stateStore.getState();
    if (state.originalRequest && state.status !== 'INITIALIZING' && state.status !== 'FAILED') {
      // Already initialized, resume existing project
      return;
    }

    this.stateStore.updateState((draft) => {
      draft.originalRequest = userRequest;
      draft.status = 'PLANNING';
    });

    this.eventStore.appendEvent(
      this.stateStore.getRevision(),
      'USER_REQUEST',
      'USER',
      { request: userRequest }
    );

    // 2. A2 creates initial plan
    const initialPlan = await this.planner.createInitialPlan(userRequest);
    this.eventStore.appendEvent(
      this.stateStore.getRevision(),
      'PLAN_CREATED',
      'A2',
      initialPlan as unknown as Record<string, unknown>
    );

    // 3. A3 independently reviews initial plan
    this.stateStore.updateState((draft) => {
      draft.status = 'PLAN_REVIEW';
    });

    const planReview = await this.reviewer.reviewPlan(JSON.stringify(initialPlan, null, 2));
    if (!planReview.approved) {
      this.eventStore.appendEvent(
        this.stateStore.getRevision(),
        'PLAN_REJECTED',
        'A3',
        { reason: planReview.reason }
      );
      throw new Error(`Plan rejected by A3: ${planReview.reason}`);
    }

    this.eventStore.appendEvent(
      this.stateStore.getRevision(),
      'PLAN_APPROVED',
      'A3',
      { reason: planReview.reason }
    );

    // Register requirements and tasks in state
    this.stateStore.updateState((draft) => {
      draft.status = 'EXECUTING';

      for (const req of initialPlan.requirements) {
        draft.requirements[req.id] = {
          id: req.id,
          description: req.description,
          source: 'user_request',
          status: 'pending',
          taskIds: [],
          verificationCriteria: req.verificationCriteria,
        };
      }

      for (const t of initialPlan.tasks) {
        draft.tasks[t.id] = {
          id: t.id,
          parentId: null,
          type: t.type || 'task',
          title: t.title,
          objective: t.objective,
          requirements: t.requirements,
          acceptanceCriteria: t.acceptanceCriteria,
          dependencies: t.dependencies,
          status: t.dependencies.length === 0 ? 'READY' : 'PENDING',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        // Link requirements
        for (const reqId of t.requirements) {
          if (draft.requirements[reqId] && !draft.requirements[reqId].taskIds.includes(t.id)) {
            draft.requirements[reqId].taskIds.push(t.id);
          }
        }
      }

      draft.planVersion = 1;
      draft.planHistory = [
        {
          version: 1,
          timestamp: Date.now(),
          reason: 'Initial plan approved by A3',
          changesSummary: `Created ${initialPlan.tasks.length} tasks and ${initialPlan.requirements.length} requirements`,
          affectedRequirements: initialPlan.requirements.map((r) => r.id),
          affectedTasks: initialPlan.tasks.map((t) => t.id),
          approvalState: 'approved',
        },
      ];
    });
  }

  public async runToCompletion(): Promise<boolean> {
    let iteration = 0;

    while (iteration < this.maxIterations) {
      iteration++;

      // Check if project is paused by human override
      const currentState = this.stateStore.getState();
      if (currentState.isPaused) {
        return false;
      }
      if (currentState.status === 'COMPLETE') {
        return true;
      }

      // Step A: Find next authorized READY work item
      const nextTask = this.selectNextAuthorizedTask();

      if (!nextTask) {
        // No ready task found. Run recursive reassessment or check completion
        const reassessment = await this.planner.reassessProject(this.stateStore.getState());
        this.eventStore.appendEvent(
          this.stateStore.getRevision(),
          'PROJECT_REASSESSMENT',
          'A2',
          reassessment as unknown as Record<string, unknown>
        );

        if (reassessment.newTasks.length > 0) {
          this.incorporateDiscoveredTasks(reassessment);
          continue;
        }

        // Run dead-code sweep
        this.cleanupManager.runSweep();
        const cleanupTasks = this.cleanupManager.generateCleanupTasks();
        if (cleanupTasks.length > 0) {
          continue;
        }

        // Evaluate final verification
        const finalVerification = await this.finalVerifier.verifySystem({
          testCommand: this.testCommand,
          testArgs: this.testArgs,
        });

        if (finalVerification.isComplete && reassessment.isComplete) {
          this.stateStore.updateState((draft) => {
            draft.status = 'COMPLETE';
            draft.completionState = {
              isComplete: true,
              satisfiedAt: Date.now(),
              verificationSummary: finalVerification as unknown as Record<string, unknown>,
            };
          });

          this.eventStore.appendEvent(
            this.stateStore.getRevision(),
            'PROJECT_APPROVED',
            'ORCHESTRATOR',
            finalVerification as unknown as Record<string, unknown>
          );

          return true;
        } else {
          // If tasks exist but are blocked or unapproved, pause or fail gracefully
          const anyPending = Object.values(this.stateStore.getState().tasks).some(
            (t) => t.status !== 'APPROVED'
          );
          if (!anyPending && !finalVerification.isComplete) {
            // Need remediation tasks for missing checks
            this.createRemediationForVerificationGap(finalVerification);
            continue;
          }
          break;
        }
      }

      // Step B: Execute the selected authorized task
      await this.executeAuthorizedTask(nextTask);
    }

    return this.stateStore.getState().status === 'COMPLETE';
  }

  private selectNextAuthorizedTask(): Task | null {
    const state = this.stateStore.getState();
    const tasks = Object.values(state.tasks);

    // Update PENDING tasks whose dependencies are now all APPROVED
    for (const t of tasks) {
      if (t.status === 'PENDING') {
        const allDepsApproved = t.dependencies.every((depId) => state.tasks[depId]?.status === 'APPROVED');
        if (allDepsApproved) {
          this.stateStore.updateState((draft) => {
            const draftTask = draft.tasks[t.id];
            if (draftTask && draftTask.status === 'PENDING') {
              draftTask.status = 'READY';
              draftTask.updatedAt = Date.now();
            }
          });
        }
      }
    }

    // Refresh state
    const refreshed = this.stateStore.getState().tasks;
    const readyTasks = Object.values(refreshed).filter((t) => t.status === 'READY');
    if (readyTasks.length === 0) return null;

    // Prioritize subtasks, remediation, cleanup, normal tasks
    const priorityOrder: Record<string, number> = {
      remediation: 1,
      subtask: 2,
      cleanup: 3,
      task: 4,
    };

    readyTasks.sort((a, b) => {
      const pA = priorityOrder[a.type] || 5;
      const pB = priorityOrder[b.type] || 5;
      return pA - pB;
    });

    return readyTasks[0];
  }

  private async executeAuthorizedTask(task: Task): Promise<void> {
    const taskId = task.id;

    // 1. Transition task to IN_PROGRESS
    this.stateStore.updateState((draft) => {
      draft.currentTaskId = taskId;
      const t = draft.tasks[taskId];
      if (t) {
        TaskStateMachine.transition(t, 'IN_PROGRESS', draft.tasks);
      }
    });

    this.eventStore.appendEvent(
      this.stateStore.getRevision(),
      'TASK_STARTED',
      'ORCHESTRATOR',
      { taskId, title: task.title },
      taskId
    );

    // 2. Capture baseline workspace snapshot
    const baselineSnapshot = this.snapshotEngine.captureSnapshot();
    this.artifactStore.saveSnapshot(baselineSnapshot);

    // 3. A1 executes authorized task
    const executionResult = await this.worker.executeTask(task);

    this.eventStore.appendEvent(
      this.stateStore.getRevision(),
      'TASK_COMPLETION_CANDIDATE',
      'A1',
      {
        taskId,
        summary: executionResult.summary,
        toolCallsCount: executionResult.toolCalls.length,
      },
      taskId
    );

    // 4. Freeze workspace during review (PRD Section 49)
    this.lock.acquire('A3', `Reviewing task ${taskId}`);

    try {
      // 5. Capture final workspace state & diff
      const finalSnapshot = this.snapshotEngine.captureSnapshot();
      this.artifactStore.saveSnapshot(finalSnapshot);
      const diff = this.snapshotEngine.calculateDiff(baselineSnapshot, finalSnapshot);

      // Collect git diff and test evidence
      const gitDiff = this.gitEngine.getDiff();
      let testSummary: string | undefined;
      try {
        const testRes = await this.testEngine.runTests(this.testCommand, this.testArgs);
        testSummary = `Passed: ${testRes.passedTests}/${testRes.totalTests}, Exit: ${testRes.passed ? 0 : 1}`;
      } catch {
        testSummary = 'Tests not executed or command failed';
      }

      // 6. Transition to AWAITING_REVIEW
      this.stateStore.updateState((draft) => {
        const t = draft.tasks[taskId];
        if (t) {
          TaskStateMachine.transition(t, 'AWAITING_REVIEW', draft.tasks);
        }
      });

      this.eventStore.appendEvent(
        this.stateStore.getRevision(),
        'TASK_REVIEW_STARTED',
        'ORCHESTRATOR',
        { taskId },
        taskId
      );

      // 7. Fresh clean A3 session verifies task
      const reviewContext = this.reviewContextBuilder.buildContext(
        task,
        this.stateStore.getState(),
        diff,
        executionResult.summary,
        gitDiff,
        testSummary
      );

      const reviewResult: ReviewResult = await this.reviewer.reviewTask(
        reviewContext,
        finalSnapshot.gitCommit || 'fs_snapshot'
      );

      this.artifactStore.saveReview(reviewResult);

      // 8. Process review decision
      if (reviewResult.decision === 'APPROVE') {
        this.handleTaskApproval(taskId, reviewResult);
      } else if (reviewResult.decision === 'REJECT') {
        this.handleTaskRejection(taskId, reviewResult);
      } else {
        this.handleTaskBlocked(taskId, reviewResult);
      }
    } finally {
      // Unlock workspace after review completes
      this.lock.unlock();
      this.stateStore.updateState((draft) => {
        if (draft.currentTaskId === taskId) {
          draft.currentTaskId = null;
        }
      });
    }
  }

  private handleTaskApproval(taskId: TaskId, review: ReviewResult): void {
    this.rejectionCounts.delete(taskId);

    this.stateStore.updateState((draft) => {
      draft.reviews[review.id] = review;
      const t = draft.tasks[taskId];
      if (t) {
        TaskStateMachine.transition(t, 'APPROVED', draft.tasks);
      }

      // Check linked requirements
      for (const reqId of t.requirements) {
        const req = draft.requirements[reqId];
        if (req) {
          const allReqTasksApproved = req.taskIds.every((id) => draft.tasks[id]?.status === 'APPROVED');
          if (allReqTasksApproved) {
            req.status = 'satisfied';
            req.verifiedAt = Date.now();
          }
        }
      }
    });

    this.eventStore.appendEvent(
      this.stateStore.getRevision(),
      'TASK_APPROVED',
      'A3',
      { taskId, summary: review.summary },
      taskId
    );
  }

  private handleTaskRejection(taskId: TaskId, review: ReviewResult): void {
    const count = (this.rejectionCounts.get(taskId) || 0) + 1;
    this.rejectionCounts.set(taskId, count);

    this.stateStore.updateState((draft) => {
      draft.reviews[review.id] = review;
      const t = draft.tasks[taskId];
      if (t) {
        TaskStateMachine.transition(t, 'REJECTED', draft.tasks);
        TaskStateMachine.transition(t, 'REMEDIATION_REQUIRED', draft.tasks);

        if (!t.rejectionHistory) t.rejectionHistory = [];
        t.remediationRequirements = review.blockingIssues.map(
          (b) => `${b.description} -> Required fix: ${b.requiredFix} (Verification: ${b.verification})`
        );

        for (const issue of review.blockingIssues) {
          t.rejectionHistory.push({
            reviewId: review.id,
            timestamp: Date.now(),
            problem: issue.description,
            evidence: issue.evidence,
            affectedRequirement: issue.affectedRequirement,
            requiredCorrection: issue.requiredFix,
            verificationCriteria: issue.verification,
          });
        }

        // Ready for remediation
        t.status = 'READY';
      }
    });

    this.eventStore.appendEvent(
      this.stateStore.getRevision(),
      'TASK_REJECTED',
      'A3',
      { taskId, count, issues: review.blockingIssues },
      taskId
    );

    // PRD Section 25: Escalation on repeated rejection
    if (count >= this.maxConsecutiveRejections) {
      this.escalateRepeatedRejection(taskId, review);
    }
  }

  private handleTaskBlocked(taskId: TaskId, review: ReviewResult): void {
    this.stateStore.updateState((draft) => {
      draft.reviews[review.id] = review;
      const t = draft.tasks[taskId];
      if (t) {
        TaskStateMachine.transition(t, 'BLOCKED', draft.tasks);
      }
    });

    this.eventStore.appendEvent(
      this.stateStore.getRevision(),
      'TASK_BLOCKED',
      'A3',
      { taskId, summary: review.summary },
      taskId
    );
  }

  private escalateRepeatedRejection(taskId: TaskId, review: ReviewResult): void {
    const task = this.stateStore.getTask(taskId);
    if (!task) return;

    // Launch evidence-driven investigation
    const firstIssue = review.blockingIssues[0] || {
      description: 'Repeated task rejection without clear resolution',
      evidence: 'review_history',
    };

    const investigation = this.investigationSystem.createInvestigation(
      taskId,
      {
        expected: task.objective,
        actual: firstIssue.description,
        scenario: `Repeated rejection count ${this.rejectionCounts.get(taskId)}`,
      },
      [
        'Implementation defect in targeted files',
        'Incomplete acceptance criteria or flawed test expectation',
        'Missing subsystem dependency or configuration mismatch',
      ]
    );

    this.eventStore.appendEvent(
      this.stateStore.getRevision(),
      'TASK_BLOCKED',
      'ORCHESTRATOR',
      {
        taskId,
        reason: 'Escalated to investigation due to repeated rejections',
        investigationId: investigation.id,
      },
      taskId
    );
  }

  private incorporateDiscoveredTasks(reassessment: {
    newlyDiscoveredRequirements: Array<{ id: string; description: string; verificationCriteria: string[] }>;
    newTasks: Array<{
      id: string;
      title: string;
      objective: string;
      requirements: string[];
      acceptanceCriteria: string[];
      dependencies: string[];
      type?: string;
    }>;
  }): void {
    this.stateStore.updateState((draft) => {
      for (const req of reassessment.newlyDiscoveredRequirements) {
        if (!draft.requirements[req.id]) {
          draft.requirements[req.id] = {
            id: req.id,
            description: req.description,
            source: 'implementation_discovery',
            status: 'pending',
            taskIds: [],
            verificationCriteria: req.verificationCriteria,
          };
        }
      }

      for (const t of reassessment.newTasks) {
        if (!draft.tasks[t.id]) {
          draft.tasks[t.id] = {
            id: t.id,
            parentId: null,
            type: (t.type as any) || 'task',
            title: t.title,
            objective: t.objective,
            requirements: t.requirements,
            acceptanceCriteria: t.acceptanceCriteria,
            dependencies: t.dependencies,
            status: t.dependencies.length === 0 ? 'READY' : 'PENDING',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          for (const reqId of t.requirements) {
            if (draft.requirements[reqId] && !draft.requirements[reqId].taskIds.includes(t.id)) {
              draft.requirements[reqId].taskIds.push(t.id);
            }
          }
        }
      }

      draft.planVersion = (draft.planVersion || 1) + 1;
      if (!draft.planHistory) draft.planHistory = [];
      draft.planHistory.push({
        version: draft.planVersion,
        timestamp: Date.now(),
        reason: 'Recursive reassessment discovered new requirements and tasks',
        changesSummary: `Added ${reassessment.newTasks.length} task(s) and ${reassessment.newlyDiscoveredRequirements.length} requirement(s)`,
        affectedRequirements: reassessment.newlyDiscoveredRequirements.map((r) => r.id),
        affectedTasks: reassessment.newTasks.map((t) => t.id),
        approvalState: 'approved',
      });
    });
  }

  private createRemediationForVerificationGap(verification: {
    checks: Record<string, boolean>;
    details: { unresolvedDeadCode: number; blockingIssuesCount: number };
  }): void {
    const taskId: TaskId = `remediation_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const task: Task = {
      id: taskId,
      parentId: null,
      type: 'remediation',
      title: 'Satisfy outstanding verification criteria',
      objective: 'Resolve remaining test failures or dead code to achieve complete verification.',
      requirements: ['req_001'],
      acceptanceCriteria: ['All tests pass cleanly', 'All dead code addressed'],
      dependencies: [],
      status: 'READY',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.stateStore.updateState((draft) => {
      draft.tasks[taskId] = task;
    });

    this.eventStore.appendEvent(
      this.stateStore.getRevision(),
      'TASK_CREATED',
      'ORCHESTRATOR',
      { taskId, title: task.title },
      taskId
    );
  }
}

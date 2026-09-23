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
import { AgentAdapter, AgentEvent } from '../adapters/agent-adapter.js';
import { TeeAdapter } from '../adapters/tee-adapter.js';
import { A1Worker } from '../roles/a1-worker.js';
import { A2Planner } from '../roles/a2-planner.js';
import { A3Reviewer } from '../roles/a3-reviewer.js';
import { Task, TaskId, TaskStatus, ReviewResult, SleekdoState, RequirementId, TaskRejection } from '../types/domain.js';

export interface OrchestratorProgressEvent {
  phase:
    | 'planning'
    | 'plan_created'
    | 'plan_reviewed'
    | 'task_start'
    | 'task_implementing'
    | 'tests_running'
    | 'task_executed'
    | 'batch_reviewing'
    | 'task_approved'
    | 'task_rejected'
    | 'reassessing'
    | 'complete'
    | 'paused'
    | 'blocked';
  taskId?: TaskId;
  taskTitle?: string;
  message?: string;
  progressPercent?: number;
}

export type OrchestratorProgressCallback = (event: OrchestratorProgressEvent) => void;

export interface OrchestratorOptions {
  workspaceDir: string;
  workerAdapter: AgentAdapter;
  plannerAdapter?: AgentAdapter;
  reviewerAdapter?: AgentAdapter;
  maxConsecutiveRejections?: number;
  testCommand?: string;
  testArgs?: string[];
  maxIterations?: number;
  onProgress?: OrchestratorProgressCallback;
  agentEventSink?: (role: 'A1' | 'A2' | 'A3', ev: AgentEvent) => void;
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
  private autoRetryCounts = new Map<TaskId, number>();
  private executionSummaries = new Map<TaskId, string>();

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

    // Tee agent event streams to the sink (CLI live streaming) when provided
    const sink = options.agentEventSink;
    const maybeTee = (adapter: AgentAdapter, role: 'A1' | 'A2' | 'A3'): AgentAdapter =>
      sink ? new TeeAdapter(adapter, (ev) => sink(role, ev)) : adapter;

    this.worker = new A1Worker(maybeTee(workerAdapter, 'A1'), this.workspaceDir);
    this.planner = new A2Planner(maybeTee(plannerAdapter, 'A2'), this.workspaceDir);
    this.reviewer = new A3Reviewer(maybeTee(reviewerAdapter, 'A3'), this.workspaceDir);
    this.agentAdapter = workerAdapter;
    this.onProgress = options.onProgress;
  }

  /** Raw agent adapter, exposed for interactive CLI chat prompts. */
  public readonly agentAdapter: AgentAdapter;

  public onProgress?: OrchestratorProgressCallback;

  /** Optional live tee of agent events (role, event) for CLI streaming. */
  public agentEventSink?: (role: 'A1' | 'A2' | 'A3', ev: AgentEvent) => void;

  public calculateProgressPercent(): number {
    const state = this.stateStore.getState();
    const tasks = Object.values(state.tasks);
    if (tasks.length === 0) return 0;
    // Batch-review model: approved tasks count fully; executed-but-unreviewed
    // tasks count half, so progress reflects real work before final approval.
    const approved = tasks.filter((t) => t.status === 'APPROVED').length;
    const executed = tasks.filter((t) => t.status === 'AWAITING_REVIEW').length;
    return Math.round(((approved + executed * 0.5) / tasks.length) * 100);
  }

  public notifyProgress(event: OrchestratorProgressEvent): void {
    if (this.onProgress) {
      try {
        this.onProgress(event);
      } catch {
        // non-fatal progress listener error
      }
    }
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
    const hasTasks = Object.keys(state.tasks).length > 0;
    if (hasTasks && state.originalRequest && state.status !== 'INITIALIZING' && state.status !== 'FAILED') {
      // Already initialized with a viable plan, resume existing project
      return;
    }

    const effectiveRequest = userRequest || state.originalRequest;
    if (!effectiveRequest) {
      throw new Error('No user request provided for project initialization');
    }

    this.stateStore.updateState((draft) => {
      draft.originalRequest = effectiveRequest;
      draft.status = 'PLANNING';
    });

    this.eventStore.appendEvent(
      this.stateStore.getRevision(),
      'USER_REQUEST',
      'USER',
      { request: effectiveRequest }
    );

    this.notifyProgress({ phase: 'planning', message: 'Sleekdo is planning...' });

    // 2. A2 creates initial plan
    const initialPlan = await this.planner.createInitialPlan(effectiveRequest);
    this.notifyProgress({ phase: 'plan_created', message: 'Initial plan created' });
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
        const taskRequirements = Array.isArray(t.requirements) ? t.requirements : [];
        const taskDependencies = Array.isArray(t.dependencies) ? t.dependencies : [];
        draft.tasks[t.id] = {
          id: t.id,
          parentId: null,
          type: t.type || 'task',
          title: t.title,
          objective: t.objective,
          requirements: taskRequirements,
          acceptanceCriteria: Array.isArray(t.acceptanceCriteria) ? t.acceptanceCriteria : [],
          dependencies: taskDependencies,
          status: taskDependencies.length === 0 ? 'READY' : 'PENDING',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        // Link requirements
        for (const reqId of t.requirements || []) {
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

    this.notifyProgress({ phase: 'plan_reviewed', message: 'Plan independently reviewed' });
  }

  /**
   * Treats a user prompt as an updated build objective: it is added to the
   * existing objective, with the latest prompt taking priority wherever the
   * two conflict. Re-plans the task list accordingly (obsolete tasks marked,
   * new tasks added). Fresh projects are initialized with the prompt as-is.
   */
  public async refineObjective(prompt: string): Promise<boolean> {
    const state = this.stateStore.getState();
    if (!state.originalRequest || Object.keys(state.tasks).length === 0) {
      await this.initialize(prompt);
      return true;
    }

    const merged = [
      prompt,
      '',
      `[The directive above is the latest user input and takes priority over any conflicting part of the earlier objective below.]`,
      `[Earlier objective (for reference, superseded where conflicting): ${state.originalRequest}]`,
    ].join('\n');

    return this.handleRequirementChange(merged, { skipPlanReview: true });
  }

  public async handleRequirementChange(newRequest: string, opts?: { skipPlanReview?: boolean }): Promise<boolean> {
    const prevRevision = this.stateStore.getRevision();
    this.eventStore.appendEvent(
      prevRevision,
      'USER_REQUEST',
      'USER',
      { change: 'Requirement changed mid-development', newRequest }
    );

    this.stateStore.updateState((draft) => {
      draft.originalRequest = newRequest;
    });

    // 1. A2 Reassessment
    const currentState = this.stateStore.getState();
    const reassessment = await this.planner.reassessProject(currentState);

    // 2. Impact Analysis
    const currentTasks = Object.values(currentState.tasks);
    const affectedTaskIds: TaskId[] = [];
    const affectedReqIds: RequirementId[] = [];

    for (const obsId of reassessment.obsoleteTaskIds || []) {
      if (currentState.tasks[obsId]) {
        affectedTaskIds.push(obsId);
      }
    }

    for (const req of reassessment.newlyDiscoveredRequirements || []) {
      affectedReqIds.push(req.id);
    }

    for (const task of reassessment.newTasks || []) {
      affectedTaskIds.push(task.id);
    }

    // 3. Prepare revised plan for A3 verification
    const revisedPlan = {
      userRequest: newRequest,
      existingTasks: currentTasks.map((t) => ({ id: t.id, status: t.status, title: t.title })),
      newTasks: reassessment.newTasks,
      obsoleteTasks: reassessment.obsoleteTaskIds,
      newRequirements: reassessment.newlyDiscoveredRequirements,
      reason: reassessment.reason,
    };

    // 4. A3 verifies revised plan (PRD Section 78) — skipped for quick
    //    objective refinements, where the A2 reassessment is authoritative.
    if (!opts?.skipPlanReview) {
      const review = await this.reviewer.reviewPlan(JSON.stringify(revisedPlan, null, 2));
      if (!review.approved) {
        this.eventStore.appendEvent(
          this.stateStore.getRevision(),
          'PLAN_REJECTED',
          'A3',
          { reason: review.reason }
        );
        return false;
      }
    }

    // 5. Update requirements and tasks in state
    const newVersion = currentState.planVersion + 1;
    this.stateStore.updateState((draft) => {
      draft.planVersion = newVersion;

      for (const obsId of reassessment.obsoleteTaskIds || []) {
        if (draft.tasks[obsId]) {
          draft.tasks[obsId].status = 'REJECTED';
          draft.tasks[obsId].rejectionHistory = draft.tasks[obsId].rejectionHistory || [];
          draft.tasks[obsId].rejectionHistory!.push({
            reviewId: `rev_obsolete_${Date.now()}`,
            timestamp: Date.now(),
            problem: 'Task declared obsolete by requirement change',
            evidence: 'Requirement change impact analysis (PRD Section 78)',
            affectedRequirement: draft.tasks[obsId].requirements[0] || 'Unknown',
            requiredCorrection: 'None (obsolete)',
            verificationCriteria: 'Obsolete task cancelled',
          });
        }
      }

      for (const req of reassessment.newlyDiscoveredRequirements || []) {
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

      for (const t of reassessment.newTasks || []) {
        if (!t || !t.id || draft.tasks[t.id]) continue;
        {
          const taskRequirements = Array.isArray(t.requirements) ? t.requirements : [];
          const taskDependencies = Array.isArray(t.dependencies) ? t.dependencies : [];
          draft.tasks[t.id] = {
            id: t.id,
            parentId: null,
            type: t.type || 'task',
            title: t.title,
            objective: t.objective,
            requirements: taskRequirements,
            acceptanceCriteria: Array.isArray(t.acceptanceCriteria) ? t.acceptanceCriteria : [],
            dependencies: taskDependencies,
            status: taskDependencies.length === 0 ? 'READY' : 'PENDING',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          for (const reqId of t.requirements || []) {
            if (draft.requirements[reqId] && !draft.requirements[reqId].taskIds.includes(t.id)) {
              draft.requirements[reqId].taskIds.push(t.id);
            }
          }
        }
      }

      draft.planHistory = draft.planHistory || [];
      draft.planHistory.push({
        version: newVersion,
        timestamp: Date.now(),
        reason: reassessment.reason || 'User requirement changed',
        changesSummary: `Impact: ${affectedTaskIds.length} tasks and ${affectedReqIds.length} requirements affected.`,
        affectedRequirements: affectedReqIds,
        affectedTasks: affectedTaskIds,
        approvalState: 'approved',
      });
    });

    // Save versioned plan artifact
    this.artifactStore.savePlan(newVersion, revisedPlan);

    this.eventStore.appendEvent(
      this.stateStore.getRevision(),
      'PLAN_REVISED',
      'A2',
      { version: newVersion, changesSummary: revisedPlan }
    );

    return true;
  }

  public async runToCompletion(): Promise<boolean> {
    let iteration = 0;

    const initialState = this.stateStore.getState();
    if (Object.keys(initialState.tasks).length === 0 && initialState.originalRequest) {
      await this.initialize(initialState.originalRequest);
    }

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
        this.notifyProgress({ phase: 'reassessing', message: 'Reassessing remaining project tasks...' });
        const reassessment = await this.planner.reassessProject(this.stateStore.getState());
        this.eventStore.appendEvent(
          this.stateStore.getRevision(),
          'PROJECT_REASSESSMENT',
          'A2',
          reassessment as unknown as Record<string, unknown>
        );

        const newTasks = reassessment.newTasks || [];
        if (newTasks.length > 0) {
          this.incorporateDiscoveredTasks(reassessment);
          continue;
        }

        // Run dead-code sweep
        this.cleanupManager.runSweep();
        const cleanupTasks = this.cleanupManager.generateCleanupTasks();
        if (cleanupTasks.length > 0) {
          continue;
        }

        // Auto-recovery: retry stalled (BLOCKED/REJECTED) tasks before giving up
        if (this.autoRetryStalledTasks()) {
          continue;
        }

        // End-of-run batch review: verify ALL executed tasks in one A3 session
        const awaitingReview = Object.values(this.stateStore.getState().tasks).filter(
          (t) => t.status === 'AWAITING_REVIEW'
        );
        if (awaitingReview.length > 0) {
          const batchApproved = await this.runBatchReview(awaitingReview);
          if (batchApproved) {
            continue; // all approved -> next loop proceeds to final verification
          }
          continue; // rejections recorded -> tasks reset to READY for rework
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

          this.notifyProgress({
            phase: 'complete',
            progressPercent: 100,
            message: 'Project successfully completed and fully verified.',
          });

          return true;
        } else {
          // If tasks exist but are blocked or unapproved, pause or fail gracefully
          const allTasks = Object.values(this.stateStore.getState().tasks);
          const anyPending = allTasks.some((t) => t.status !== 'APPROVED');
          if (allTasks.length > 0 && !anyPending && !finalVerification.isComplete) {
            // Need remediation tasks for missing checks
            this.createRemediationForVerificationGap(finalVerification);
            continue;
          }
          break;
        }
      }

      // Step B: Execute the selected authorized task
      try {
        await this.executeAuthorizedTask(nextTask);
      } catch (e: any) {
        // A task whose dependencies are unmet must stall, not crash the run
        if (e?.name === 'DependencyNotMetError' || e?.name === 'InvalidStateTransitionError') {
          this.eventStore.appendEvent(
            this.stateStore.getRevision(),
            'TASK_BLOCKED',
            'ORCHESTRATOR',
            { taskId: nextTask.id, reason: e.message },
            nextTask.id
          );
          this.stateStore.updateState((draft) => {
            const t = draft.tasks[nextTask.id];
            if (t) {
              t.status = 'BLOCKED';
              t.updatedAt = Date.now();
            }
          });
          continue;
        }
        throw e;
      }
    }

    return this.stateStore.getState().status === 'COMPLETE';
  }

  /**
   * Runs ONE review session covering every executed task. Approved tasks are
   * marked APPROVED; rejected tasks are sent back to READY for rework.
   * Returns true when every reviewed task passed.
   */
  private async runBatchReview(awaitingTasks: Task[]): Promise<boolean> {
    this.notifyProgress({
      phase: 'batch_reviewing',
      message: `Reviewing all ${awaitingTasks.length} completed task(s) in one pass...`,
    });

    this.eventStore.appendEvent(this.stateStore.getRevision(), 'A3_REVIEW_STARTED', 'ORCHESTRATOR', {
      mode: 'batch',
      taskIds: awaitingTasks.map((t) => t.id),
    });

    let testSummary = 'Tests not executed';
    try {
      const testRes = await this.testEngine.runTests(this.testCommand, this.testArgs);
      testSummary = `Passed: ${testRes.passedTests}/${testRes.totalTests}, Exit: ${testRes.passed ? 0 : 1}`;
    } catch {
      // keep default
    }

    const verdict = await this.reviewer.reviewAllTasks({
      originalRequest: this.stateStore.getState().originalRequest || '',
      tasks: awaitingTasks.map((t) => ({
        id: t.id,
        title: t.title,
        objective: t.objective,
        requirements: t.requirements || [],
        acceptanceCriteria: t.acceptanceCriteria || [],
        workerSummary: this.executionSummaries.get(t.id) || 'No worker summary recorded',
      })),
      testSummary,
      gitDiff: this.gitEngine.getDiff(),
    });

    if (verdict.approved) {
      for (const t of awaitingTasks) {
        const syntheticReview: ReviewResult = {
          id: `rev_batch_${Date.now()}_${t.id}`,
          taskId: t.id,
          stateRevision: this.stateStore.getRevision(),
          workspaceSnapshotSha: 'batch_review',
          reviewerProvider: this.reviewerAdapterName(),
          reviewerModel: 'batch-review',
          startedAt: Date.now(),
          completedAt: Date.now(),
          decision: 'APPROVE',
          summary: verdict.summary || 'Approved in end-of-run batch review',
          requirementCompliance: true,
          acceptanceCriteriaMet: true,
          implementationExists: true,
          testsPass: true,
          noRegressions: true,
          scopeControlled: true,
          noDeadCodeIntroduced: true,
          blockingIssues: [],
        };
        this.artifactStore.saveReview(syntheticReview);
        this.handleTaskApproval(t.id, syntheticReview);
      }
      return true;
    }

    // Some tasks rejected: record rejections with per-task blocking issues
    const rejectedSet = new Set(verdict.rejectedTaskIds);
    for (const t of awaitingTasks) {
      if (!rejectedSet.has(t.id)) {
        // Not explicitly rejected -> approved in batch
        const syntheticReview: ReviewResult = {
          id: `rev_batch_${Date.now()}_${t.id}`,
          taskId: t.id,
          stateRevision: this.stateStore.getRevision(),
          workspaceSnapshotSha: 'batch_review',
          reviewerProvider: this.reviewerAdapterName(),
          reviewerModel: 'batch-review',
          startedAt: Date.now(),
          completedAt: Date.now(),
          decision: 'APPROVE',
          summary: verdict.summary || 'Approved in end-of-run batch review',
          requirementCompliance: true,
          acceptanceCriteriaMet: true,
          implementationExists: true,
          testsPass: true,
          noRegressions: true,
          scopeControlled: true,
          noDeadCodeIntroduced: true,
          blockingIssues: [],
        };
        this.artifactStore.saveReview(syntheticReview);
        this.handleTaskApproval(t.id, syntheticReview);
      } else {
        const issues = verdict.blockingIssues.filter((b) => b.taskId === t.id);
        const rejectionReview: ReviewResult = {
          id: `rev_batch_${Date.now()}_${t.id}`,
          taskId: t.id,
          stateRevision: this.stateStore.getRevision(),
          workspaceSnapshotSha: 'batch_review',
          reviewerProvider: this.reviewerAdapterName(),
          reviewerModel: 'batch-review',
          startedAt: Date.now(),
          completedAt: Date.now(),
          decision: 'REJECT',
          summary: issues.map((i) => i.description).join('; ') || verdict.summary || 'Rejected in batch review',
          requirementCompliance: false,
          acceptanceCriteriaMet: false,
          implementationExists: true,
          testsPass: true,
          noRegressions: true,
          scopeControlled: true,
          noDeadCodeIntroduced: true,
          blockingIssues: issues.map((i) => ({
            description: i.description,
            evidence: 'End-of-run batch review',
            affectedRequirement: t.requirements[0] || 'Batch review',
            requiredFix: i.requiredFix,
            verification: 'Task must pass batch review criteria on retry',
          })),
        };
        this.artifactStore.saveReview(rejectionReview);
        this.handleTaskRejection(t.id, rejectionReview);
      }
    }
    return false;
  }

  private reviewerAdapterName(): string {
    return (this.reviewer as unknown as { adapter?: { name?: string } }).adapter?.name || 'A3';
  }

  private autoRetryStalledTasks(): boolean {
    const MAX_AUTO_RETRIES = 2;
    const tasks = Object.values(this.stateStore.getState().tasks);
    const stalled = tasks.filter(
      (t) =>
        (t.status === 'REJECTED' || t.status === 'BLOCKED') &&
        (this.autoRetryCounts.get(t.id) || 0) < MAX_AUTO_RETRIES
    );
    if (stalled.length === 0) return false;

    this.stateStore.updateState((draft) => {
      for (const t of stalled) {
        const dt = draft.tasks[t.id];
        if (dt && (dt.status === 'REJECTED' || dt.status === 'BLOCKED')) {
          dt.status = 'READY';
          dt.updatedAt = Date.now();
        }
      }
    });

    for (const t of stalled) {
      this.autoRetryCounts.set(t.id, (this.autoRetryCounts.get(t.id) || 0) + 1);
      this.eventStore.appendEvent(
        this.stateStore.getRevision(),
        'AUTO_RETRY',
        'ORCHESTRATOR',
        { taskId: t.id, attempt: this.autoRetryCounts.get(t.id), reason: 'Run stalled with no ready tasks; auto-retrying' },
        t.id
      );
      this.notifyProgress({
        phase: 'reassessing',
        message: `Auto-retrying stalled task ${t.id} (attempt ${this.autoRetryCounts.get(t.id)})`,
      });
    }
    return true;
  }

  private selectNextAuthorizedTask(): Task | null {
    const state = this.stateStore.getState();
    const tasks = Object.values(state.tasks);

    // Update PENDING tasks whose dependencies are all satisfied (approved or
    // executed-and-queued for batch review)
    for (const t of tasks) {
      if (t.status === 'PENDING') {
        const allDepsSatisfied = t.dependencies.every((depId) => {
          const dep = state.tasks[depId];
          return dep && (dep.status === 'APPROVED' || dep.status === 'AWAITING_REVIEW');
        });
        if (allDepsSatisfied) {
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

    this.notifyProgress({ phase: 'task_start', taskId: task.id, taskTitle: task.title });
    this.notifyProgress({ phase: 'task_implementing', taskId: task.id, taskTitle: task.title, message: 'Worker: implementing...' });

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

    // 4. Capture final workspace state & diff (isolation check only; formal review is deferred to end-of-run batch)
    const finalSnapshot = this.snapshotEngine.captureSnapshot();
    this.artifactStore.saveSnapshot(finalSnapshot);
    const diff = this.snapshotEngine.calculateDiff(baselineSnapshot, finalSnapshot);

    // Enforce Workspace Isolation (PRD Section 48)
    const unauthorizedMutations = [...diff.createdFiles, ...diff.modifiedFiles, ...diff.deletedFiles]
      .filter((f) => f.startsWith('.sleekdo/') || f === '.sleekdo');

    if (unauthorizedMutations.length > 0) {
      this.eventStore.appendEvent(
        this.stateStore.getRevision(),
        'TASK_REJECTED',
        'ORCHESTRATOR',
        {
          taskId,
          reason: `Workspace isolation violation: A1 mutated protected Sleekdo control files: ${unauthorizedMutations.join(', ')}`,
        },
        taskId
      );

      const isolationViolationReview: ReviewResult = {
        id: `rev_isolation_${Date.now()}`,
        taskId,
        stateRevision: this.stateStore.getRevision(),
        workspaceSnapshotSha: finalSnapshot.gitCommit || 'fs_snapshot',
        reviewerProvider: 'orchestrator',
        reviewerModel: 'workspace-guard',
        startedAt: Date.now(),
        completedAt: Date.now(),
        decision: 'REJECT',
        summary: `Workspace isolation violation: A1 attempted to write to protected control directory .sleekdo/ (${unauthorizedMutations.join(', ')}).`,
        requirementCompliance: false,
        acceptanceCriteriaMet: false,
        implementationExists: false,
        testsPass: false,
        noRegressions: false,
        scopeControlled: false,
        noDeadCodeIntroduced: true,
        blockingIssues: [
          {
            description: `A1 modified protected control files: ${unauthorizedMutations.join(', ')}`,
            evidence: unauthorizedMutations[0],
            affectedRequirement: task.requirements[0] || 'PRD Section 48',
            requiredFix: 'Do not modify files inside .sleekdo/. Sleekdo control state is immutable to worker agents.',
            verification: 'Check that .sleekdo directory is untouched by task execution.',
          },
        ],
      };

      this.handleTaskRejection(taskId, isolationViolationReview);
      return;
    }

    // Run test evidence collection
    let testSummary: string | undefined;
    this.notifyProgress({ phase: 'tests_running', taskId: task.id, taskTitle: task.title, message: 'Tests: running...' });
    try {
      const testRes = await this.testEngine.runTests(this.testCommand, this.testArgs);
      testSummary = `Passed: ${testRes.passedTests}/${testRes.totalTests}, Exit: ${testRes.passed ? 0 : 1}`;
    } catch {
      testSummary = 'Tests not executed or command failed';
    }

    // 5. Mark executed: formal A3 review is deferred to a single batch review at end of run
    this.executionSummaries.set(taskId, executionResult.summary);
    this.stateStore.updateState((draft) => {
      const t = draft.tasks[taskId];
      if (t) {
        TaskStateMachine.transition(t, 'AWAITING_REVIEW', draft.tasks);
      }
    });
    this.notifyProgress({
      phase: 'task_executed',
      taskId: task.id,
      taskTitle: task.title,
      message: 'Executed. Queued for final batch review.',
    });

    this.stateStore.updateState((draft) => {
      if (draft.currentTaskId === taskId) {
        draft.currentTaskId = null;
      }
    });
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
      for (const reqId of t.requirements || []) {
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

    this.notifyProgress({
      phase: 'task_approved',
      taskId,
      taskTitle: this.stateStore.getTask(taskId)?.title,
      progressPercent: this.calculateProgressPercent(),
    });
  }

  private handleTaskRejection(taskId: TaskId, review: ReviewResult): void {
    const count = (this.rejectionCounts.get(taskId) || 0) + 1;
    this.rejectionCounts.set(taskId, count);

    this.notifyProgress({
      phase: 'task_rejected',
      taskId,
      taskTitle: this.stateStore.getTask(taskId)?.title,
      message: review.summary,
    });

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
    const newlyDiscoveredRequirements = (reassessment.newlyDiscoveredRequirements ?? []).filter(
      (r: any): r is { id: string; description: string; verificationCriteria: string[] } =>
        r && typeof r === 'object' && typeof r.id === 'string' && r.id
    );
    const newTasks = (reassessment.newTasks ?? []).filter(
      (t: any): t is { id: string; title: string; objective: string; requirements: string[]; acceptanceCriteria: string[]; dependencies: string[]; type?: string } =>
        t && typeof t === 'object' && typeof t.id === 'string' && t.id
    );
    this.stateStore.updateState((draft) => {
      for (const req of newlyDiscoveredRequirements) {
        if (!req || !req.id || draft.requirements[req.id]) continue;
        draft.requirements[req.id] = {
          id: req.id,
          description: req.description,
          source: 'implementation_discovery',
          status: 'pending',
          taskIds: [],
          verificationCriteria: Array.isArray(req.verificationCriteria) ? req.verificationCriteria : [],
        };
      }

      for (const t of newTasks) {
        if (!t || !t.id || draft.tasks[t.id]) continue;
        {
          const requirements = Array.isArray(t.requirements) ? t.requirements : [];
          const dependencies = Array.isArray(t.dependencies) ? t.dependencies : [];
          draft.tasks[t.id] = {
            id: t.id,
            parentId: null,
            type: (t.type as any) || 'task',
            title: t.title,
            objective: t.objective,
            requirements,
            acceptanceCriteria: Array.isArray(t.acceptanceCriteria) ? t.acceptanceCriteria : [],
            dependencies,
            status: dependencies.length === 0 ? 'READY' : 'PENDING',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          for (const reqId of requirements) {
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
        changesSummary: `Added ${newTasks.length} task(s) and ${newlyDiscoveredRequirements.length} requirement(s)`,
        affectedRequirements: newlyDiscoveredRequirements.map((r) => r.id),
        affectedTasks: newTasks.map((t) => t.id),
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

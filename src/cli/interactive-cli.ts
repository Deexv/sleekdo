import * as readline from 'node:readline';
import * as path from 'node:path';
import { Orchestrator, OrchestratorProgressEvent } from '../core/orchestrator.js';
import type { AgentAdapter } from '../adapters/agent-adapter.js';
import { StateStore } from '../storage/state-store.js';
import { EventStore } from '../storage/event-store.js';
import { Task, TaskStatus } from '../types/domain.js';

export interface InteractiveCliOptions {
  workspaceDir: string;
  agentName: string;
  workerAdapter: AgentAdapter;
  plannerAdapter?: AgentAdapter;
  reviewerAdapter?: AgentAdapter;
  orchestrator?: Orchestrator;
  testCommand?: string;
  testArgs?: string[];
  maxConsecutiveRejections?: number;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

export function formatBoxHeader(agentName: string, projectName: string, width = 48): string {
  const innerWidth = width - 4;
  const line = '─'.repeat(width - 2);
  const pad = (s: string) => s + ' '.repeat(Math.max(0, innerWidth - s.length));

  return [
    `╭${line}╮`,
    `│  ${pad('SLEEKDO')}│`,
    `│  ${pad(`Agent: ${agentName}`)}│`,
    `│  ${pad(`Project: ${projectName}`)}│`,
    `╰${line}╯`,
  ].join('\n');
}

export function formatProgressBar(percent: number, barWidth = 22): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * barWidth);
  const empty = barWidth - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${clamped}%`;
}

export function getTaskSymbol(status: TaskStatus): string {
  switch (status) {
    case 'APPROVED':
      return '✓';
    case 'IN_PROGRESS':
    case 'AWAITING_REVIEW':
      return '→';
    case 'READY':
    case 'PENDING':
      return '○';
    case 'REJECTED':
    case 'REMEDIATION_REQUIRED':
    case 'BLOCKED':
    case 'DEFERRED':
      return '✗';
    default:
      return '○';
  }
}

export class InteractiveCliSession {
  public readonly workspaceDir: string;
  public readonly agentName: string;
  public readonly projectName: string;
  public readonly orchestrator: Orchestrator;
  private readonly stateStore: StateStore;
  private readonly eventStore: EventStore;
  private readonly inStream: NodeJS.ReadableStream;
  private readonly outStream: NodeJS.WritableStream;
  private rl: readline.Interface | null = null;
  private isRunning = false;

  constructor(options: InteractiveCliOptions) {
    this.workspaceDir = path.resolve(options.workspaceDir);
    this.agentName = options.agentName;
    this.projectName = path.basename(this.workspaceDir) || 'sleekdo-project';
    this.inStream = options.input || process.stdin;
    this.outStream = options.output || process.stdout;
    if (options.orchestrator) {
      this.orchestrator = options.orchestrator;
    } else {
      this.orchestrator = new Orchestrator({
        workspaceDir: this.workspaceDir,
        workerAdapter: options.workerAdapter,
        plannerAdapter: options.plannerAdapter,
        reviewerAdapter: options.reviewerAdapter,
        testCommand: options.testCommand,
        testArgs: options.testArgs,
        maxConsecutiveRejections: options.maxConsecutiveRejections,
      });
    }

    this.stateStore = this.orchestrator.stateStore;
    this.eventStore = this.orchestrator.eventStore;

    // Attach progress listener
    this.orchestrator.onProgress = (event: OrchestratorProgressEvent) => {
      this.handleProgressEvent(event);
    };
  }

  public print(text: string): void {
    this.outStream.write(text + '\n');
  }

  private handleProgressEvent(event: OrchestratorProgressEvent): void {
    switch (event.phase) {
      case 'planning':
        this.print(`\nSleekdo is planning...\n`);
        break;
      case 'plan_created':
        this.print(`✓ Initial plan created`);
        break;
      case 'plan_reviewed':
        this.print(`✓ Plan independently reviewed\n`);
        this.renderTasksList();
        this.print(`\nA1 Worker: ${this.agentName}`);
        this.print(`A3 Reviewer: active\n`);
        break;
      case 'task_start':
        this.print(`\n${event.taskId} ${event.taskTitle || ''}`);
        break;
      case 'task_implementing':
        this.print(`  Worker: implementing...`);
        break;
      case 'tests_running':
        this.print(`  Tests: running...`);
        break;
      case 'review_pending':
        this.print(`  Review: pending...`);
        break;
      case 'task_approved': {
        const percent = event.progressPercent ?? this.orchestrator.calculateProgressPercent();
        this.print(`  ✓ Approved`);
        this.print(`\n${formatProgressBar(percent)}\n`);
        break;
      }
      case 'task_rejected':
        this.print(`  ✗ Rejected: ${event.message || 'Criteria not met'}`);
        break;
      case 'reassessing':
        this.print(`\n[Reassessing remaining project tasks...]`);
        break;
      case 'complete':
        this.print(`\n${formatProgressBar(100)}`);
        this.print(`[Sleekdo] Project successfully completed and fully verified.`);
        break;
      case 'blocked':
        this.print(`  ! Blocked: ${event.message || 'Needs attention'}`);
        break;
    }
  }

  public renderHeader(): void {
    this.print(formatBoxHeader(this.agentName, this.projectName));
  }

  public renderTasksList(): void {
    const state = this.stateStore.getState();
    const tasks = Object.values(state.tasks);
    if (tasks.length === 0) {
      this.print('No tasks planned yet.');
      return;
    }

    this.print('Tasks');
    for (const t of tasks) {
      const sym = getTaskSymbol(t.status);
      this.print(`  ${sym} ${t.id} ${t.title}`);
    }
  }

  public renderStatus(): void {
    const state = this.stateStore.getState();
    const tasks = Object.values(state.tasks);
    const approved = tasks.filter((t) => t.status === 'APPROVED').length;
    const requirements = Object.values(state.requirements);
    const satisfied = requirements.filter((r) => r.status === 'satisfied').length;
    const percent = this.orchestrator.calculateProgressPercent();

    this.print(`\n=== Project Status ===`);
    this.print(`Status: ${state.status}`);
    this.print(`Revision: ${state.revision}`);
    this.print(`Tasks Approved: ${approved}/${tasks.length}`);
    this.print(`Requirements Satisfied: ${satisfied}/${requirements.length}`);
    this.print(`Progress: ${formatProgressBar(percent)}`);

    const blocked = tasks.filter((t) => t.status === 'BLOCKED');
    if (blocked.length > 0) {
      this.print(`Blocked Tasks (${blocked.length}):`);
      for (const b of blocked) {
        this.print(`  - ${b.id}: ${b.title}`);
      }
    }
  }

  public async executeCommand(line: string): Promise<boolean> {
    const trimmed = line.trim();
    if (!trimmed) return true;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const rest = parts.slice(1).join(' ');

    switch (cmd) {
      case 'exit':
      case 'quit':
        this.print('Exiting Sleekdo.');
        return false;

      case 'help':
        this.print('\nAvailable Sleekdo commands:');
        this.print('  build <objective>  Initialize and execute a build objective');
        this.print('  run                Execute or continue autonomous run to completion');
        this.print('  status             Display current status and requirement coverage');
        this.print('  tasks              Display current task list and statuses');
        this.print('  plan               Display active plan and requirements breakdown');
        this.print('  pause              Pause ongoing orchestrator execution');
        this.print('  resume             Resume paused execution');
        this.print('  review <taskId>    Display review verdict and evidence for a task');
        this.print('  retry <taskId>     Reset a rejected or blocked task to READY');
        this.print('  logs               Display recent audit event log entries');
        this.print('  clean              Run dead-code and dead-file analysis sweep');
        this.print('  verify             Run 13 criteria final system verification');
        this.print('  exit / quit        Exit interactive session\n');
        return true;

      case 'status':
        this.renderStatus();
        return true;

      case 'tasks':
        this.renderTasksList();
        return true;

      case 'plan': {
        const state = this.stateStore.getState();
        this.print(`\nPlan Version: ${state.planVersion}`);
        this.print(`Original Objective: ${state.originalRequest || 'None'}`);
        this.print(`Requirements (${Object.keys(state.requirements).length}):`);
        for (const req of Object.values(state.requirements)) {
          this.print(`  - [${req.id}] ${req.description} (${req.status})`);
        }
        this.print(`\nTask Breakdown:`);
        this.renderTasksList();
        return true;
      }

      case 'build': {
        if (!rest) {
          this.print('Usage: build <project objective>');
          return true;
        }
        await this.handleBuildRequest(rest);
        return true;
      }

      case 'run': {
        this.print('[Sleekdo] Running autonomous development cycle...');
        this.isRunning = true;
        try {
          const completed = await this.orchestrator.runToCompletion();
          if (completed) {
            this.print('[Sleekdo] Complete: Project is fully built and verified.');
          } else {
            this.print('[Sleekdo] Run paused or pending. Type "status" or "tasks" to inspect.');
          }
        } finally {
          this.isRunning = false;
        }
        return true;
      }

      case 'pause': {
        this.stateStore.updateState((draft) => {
          draft.isPaused = true;
        });
        this.eventStore.appendEvent(
          this.stateStore.getRevision(),
          'HUMAN_OVERRIDE',
          'USER',
          { action: 'pause' }
        );
        this.print('[Sleekdo] Project execution paused.');
        return true;
      }

      case 'resume': {
        this.stateStore.updateState((draft) => {
          draft.isPaused = false;
        });
        this.eventStore.appendEvent(
          this.stateStore.getRevision(),
          'HUMAN_OVERRIDE',
          'USER',
          { action: 'resume' }
        );
        this.print('[Sleekdo] Project execution resumed. Type "run" to continue.');
        return true;
      }

      case 'review': {
        const taskId = parts[1];
        if (!taskId) {
          this.print('Usage: review <taskId>');
          return true;
        }
        const state = this.stateStore.getState();
        const reviews = Object.values(state.reviews).filter((r) => r.taskId === taskId);
        if (reviews.length === 0) {
          this.print(`No review records found for task ${taskId}.`);
          return true;
        }
        const latest = reviews[reviews.length - 1];
        this.print(`\nReview ${latest.id} for ${taskId}:`);
        this.print(`Decision: ${latest.decision}`);
        this.print(`Summary: ${latest.summary}`);
        if (latest.blockingIssues.length > 0) {
          this.print(`Blocking Issues:`);
          for (const b of latest.blockingIssues) {
            this.print(`  - ${b.description}`);
            this.print(`    Fix: ${b.requiredFix}`);
          }
        }
        return true;
      }

      case 'retry': {
        const taskId = parts[1];
        if (!taskId) {
          this.print('Usage: retry <taskId>');
          return true;
        }
        const state = this.stateStore.getState();
        const task = state.tasks[taskId];
        if (!task) {
          this.print(`Task ${taskId} not found.`);
          return true;
        }
        this.stateStore.updateState((draft) => {
          const t = draft.tasks[taskId];
          if (t) {
            t.status = 'READY';
            t.updatedAt = Date.now();
          }
        });
        this.eventStore.appendEvent(
          this.stateStore.getRevision(),
          'HUMAN_OVERRIDE',
          'USER',
          { action: 'retry', taskId }
        );
        this.print(`[Sleekdo] Task ${taskId} reset to READY. Type "run" to execute.`);
        return true;
      }

      case 'logs': {
        const events = this.eventStore.getEvents().slice(-10);
        this.print(`\nRecent Events (${events.length}):`);
        for (const e of events) {
          const time = new Date(e.timestamp).toLocaleTimeString();
          this.print(`  [${time}] ${e.actor} -> ${e.type} ${e.taskId ? `(${e.taskId})` : ''}`);
        }
        return true;
      }

      case 'clean': {
        this.print('[Sleekdo] Running dead-code and dead-file analysis...');
        const findings = this.orchestrator.cleanupManager.runSweep();
        this.print(`Found ${findings.length} cleanup candidate(s).`);
        for (const f of findings) {
          this.print(`  - [${f.classification}] ${f.file} (${f.reason})`);
        }
        return true;
      }

      case 'verify': {
        this.print('[Sleekdo] Running final system verification...');
        const res = await this.orchestrator.finalVerifier.verifySystem({
          testCommand: this.orchestrator.testEngine ? undefined : undefined,
        });
        this.print(`Verification: ${res.isComplete ? 'PASSED' : 'INCOMPLETE'}`);
        return true;
      }

      default:
        // If not initialized and user enters text directly, treat as build request
        if (!this.stateStore.getState().originalRequest) {
          await this.handleBuildRequest(trimmed);
          return true;
        }
        this.print(`Unknown command: "${cmd}". Type "help" for a list of available commands.`);
        return true;
    }
  }

  private async handleBuildRequest(request: string): Promise<void> {
    this.print(`\nInitializing project with request: "${request}"`);
    await this.orchestrator.initialize(request);
    this.renderTasksList();
    this.print(`\nType "run" to start autonomous development or inspect with "status".`);
  }

  public async start(): Promise<void> {
    this.renderHeader();

    const state = this.stateStore.getState();
    this.rl = readline.createInterface({
      input: this.inStream,
      output: this.outStream,
      terminal: false,
    });

    // If project is not yet initialized, prompt for objective directly
    if (!state.originalRequest) {
      this.print('\nWhat do you want to build?\n');
      const answer = await new Promise<string>((resolve) => {
        this.rl?.question('> ', (ans) => resolve(ans));
      });
      if (answer && answer.trim()) {
        await this.handleBuildRequest(answer.trim());
      }
    } else {
      this.print(`\nLoaded active project: "${state.originalRequest}"`);
      this.renderTasksList();
    }

    // Start REPL loop
    await this.promptLoop();
  }

  private async promptLoop(): Promise<void> {
    const askQuestion = (promptText: string): Promise<string> => {
      return new Promise((resolve) => {
        if (!this.rl) {
          resolve('exit');
          return;
        }
        this.rl.question(promptText, (ans) => resolve(ans));
      });
    };

    while (true) {
      const line = await askQuestion('\nsleekdo> ');
      if (line === null || line === undefined) {
        break;
      }
      const continueLoop = await this.executeCommand(line);
      if (!continueLoop) {
        break;
      }
    }

    this.rl?.close();
  }
}

import * as readline from 'node:readline';
import { cursorTo, moveCursor } from 'node:readline';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Orchestrator, OrchestratorProgressEvent } from '../core/orchestrator.js';
import type { AgentAdapter } from '../adapters/agent-adapter.js';
import { StateStore } from '../storage/state-store.js';
import { EventStore } from '../storage/event-store.js';
import { Task, TaskStatus } from '../types/domain.js';
import { theme as style, glyphs } from './theme.js';
import { Spinner, getSpinner, resultLine, hookLine } from './spinner.js';
import { InputBox } from './input-box.js';
import { StreamFormatter } from './text-format.js';
import type { AgentEvent } from '../adapters/agent-adapter.js';

const execAsync = promisify(exec);

function safeParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

const VERSION = '1.0.0';

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

/* ─── ANSI styling (green accent theme) ─────────────────────────── */

/* ─── Formatting helpers ────────────────────────────────────────── */

export function formatBoxHeader(agentName: string, projectName: string, _width = 48): string {
  return [
    `${style.boldGreen('✻')} ${style.bold('Welcome to')} ${style.boldGreen('Sleekdo')} ${style.dimGreen('v' + VERSION)}`,
    '',
    `  ${style.dim('agent')}     ${style.white(agentName)}`,
    `  ${style.dim('project')}   ${style.white(projectName)}`,
    `  ${style.dim('input')}     ${style.dim('type anything to chat · /lockin to set the objective · /commands · !shell · ? hints')}`,
  ].join('\n');
}

export function formatProgressBar(percent: number, barWidth = 22): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * barWidth);
  const empty = barWidth - filled;
  const bar = style.green('█'.repeat(filled)) + style.dim('░'.repeat(empty));
  return `${bar} ${style.bold(String(clamped) + '%')}`;
}

export function getTaskSymbol(status: TaskStatus): { glyph: string; color: (s: string) => string } {
  switch (status) {
    case 'APPROVED':
      return { glyph: '✓', color: style.green };
    case 'IN_PROGRESS':
    case 'AWAITING_REVIEW':
      return { glyph: '❯', color: style.boldGreen };
    case 'READY':
    case 'PENDING':
      return { glyph: '☐', color: style.dim };
    case 'REJECTED':
    case 'REMEDIATION_REQUIRED':
    case 'BLOCKED':
    case 'DEFERRED':
      return { glyph: '✗', color: style.red };
    default:
      return { glyph: '☐', color: style.dim };
  }
}

/* ─── Session ────────────────────────────────────────────────────── */

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
  private rlClosed = false;
  private isRunning = false;
  private lastCtrlC = 0;
  private lineQueue: string[] = [];
  private lineResolver: ((v: string) => void) | null = null;
  private boxRedraw: string | null = null;
  private chatSession: Awaited<ReturnType<AgentAdapter['start']>> | null = null;
  private rawModeAvailable = false;
  private rawHistory: string[] = [];

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
        agentEventSink: (role, ev) => this.handleAgentEvent(role, ev),
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

  /* Claude Code-style status line: ✻ Verb… detail */
  private status(verb: string, detail?: string): void {
    const spinner = getSpinner(this.outStream);
    spinner.start(verb, detail);
  }

  /* Live agent streaming: show what A1/A2/A3 are actually doing.
     Tool calls print as dim lines; A1 narration streams live. The spinner
     yields its row while content is being printed. */
  private lastWasStreamedText = false;
  private streamFormatter: StreamFormatter | null = null;
  private streamIdleTimer: NodeJS.Timeout | null = null;

  /* While streaming, show a loader if the agent goes quiet — proof it's
     still running rather than hung. Cleared the instant new activity flows. */
  private armIdleLoader(role: 'A1' | 'A2' | 'A3'): void {
    this.clearIdleLoader();
    this.streamIdleTimer = setTimeout(() => {
      this.streamIdleTimer = null;
      // Flush any buffered partial line so nothing stays hidden, then load
      if (this.streamFormatter) {
        const tail = this.streamFormatter.flush();
        if (tail) this.outStream.write(style.dim(tail) + '\n');
        this.streamFormatter = null;
        this.lastWasStreamedText = false;
      }
      getSpinner(this.outStream).start('Working', `${role} still running`);
    }, 600);
  }

  private clearIdleLoader(): void {
    if (this.streamIdleTimer) {
      clearTimeout(this.streamIdleTimer);
      this.streamIdleTimer = null;
    }
  }

  private handleAgentEvent(role: 'A1' | 'A2' | 'A3', ev: AgentEvent): void {
    if (!(this.outStream as any).isTTY) return; // keep piped output clean
    const spinner = getSpinner(this.outStream);
    this.clearIdleLoader();

    if (ev.type === 'tool_call') {
      spinner.stop();
      this.lastWasStreamedText = false;
      const data = ev.data || {};
      const name = String(data.name || data.tool || 'tool');
      const args = typeof data.args === 'string' ? safeParse(data.args) : data.args || {};
      const target = String(
        (args as any).file_path || (args as any).path || (args as any).file || (args as any).command || (args as any).pattern || ''
      ).slice(0, 48);
      this.print(`  ${style.dim(glyphs.gear)} ${style.text(name)} ${style.dim(target)}`);
      this.armIdleLoader(role);
      return;
    }

    if (ev.type === 'tool_result') {
      this.armIdleLoader(role);
      return;
    }

    if (ev.type === 'error') {
      spinner.stop();
      this.lastWasStreamedText = false;
      this.print(`  ${style.error('✗ agent error:')} ${style.dim(String(ev.data?.message || 'unknown'))}`);
      return;
    }

    if (ev.type === 'message') {
      const delta = String(ev.data?.delta || ev.data?.text || '');
      if (!delta) return;
      if (role === 'A1') {
        // Stream the worker's narration live, formatted from markdown
        if (!this.lastWasStreamedText) {
          spinner.stop();
          this.streamFormatter = new StreamFormatter((this.outStream as any).columns);
        }
        this.lastWasStreamedText = true;
        const formatted = this.streamFormatter!.feed(delta);
        if (formatted) this.outStream.write(style.dim(formatted));
        this.armIdleLoader(role);
      } else {
        // A2/A3 narrate in JSON/plan text — show activity, not walls of JSON
        this.lastWasStreamedText = false;
      }
    }
  }


  private handleProgressEvent(event: OrchestratorProgressEvent): void {
    this.clearIdleLoader(); // orchestrator phase change takes over the spinner
    const spinner = getSpinner(this.outStream);
    switch (event.phase) {
      /* Ongoing work: animated spinner with elapsed time */
      case 'planning':
        spinner.start('Planning', 'decomposing objective into tasks');
        break;
      case 'task_start':
        spinner.update('Implementing', `${event.taskId} · ${event.taskTitle || ''}`);
        break;
      case 'task_implementing':
        break;
      case 'tests_running':
        spinner.update('Testing', event.taskId);
        break;
      case 'batch_reviewing':
        spinner.start('Reviewing', event.message || 'verifying all completed tasks');
        break;
      case 'reassessing':
        spinner.start('Reassessing', 'remaining project tasks');
        break;

      /* Terminal results: stop spinner, leave a result line */
      case 'plan_created':
        spinner.stop(resultLine(true, 'Initial plan created'));
        break;
      case 'plan_reviewed':
        spinner.stop(resultLine(true, 'Plan independently reviewed'));
        this.print('');
        this.renderTasksList();
        this.print('');
        this.print(hookLine(`Worker ${this.agentName} ${glyphs.clock} Reviewer A3 (end-of-run batch)`));
        break;
      case 'task_executed':
        spinner.stop(resultLine(true, `${event.taskId} executed ${style.dim(glyphs.clock + ' queued for final review')}`));
        this.print(`  ${formatProgressBar(event.progressPercent ?? this.orchestrator.calculateProgressPercent())}`);
        break;
      case 'task_approved': {
        const percent = event.progressPercent ?? this.orchestrator.calculateProgressPercent();
        spinner.stop(resultLine(true, `${event.taskId} approved`));
        this.print(`  ${formatProgressBar(percent)}`);
        break;
      }
      case 'task_rejected':
        spinner.stop(resultLine(false, `${event.taskId} rejected ${style.dim(glyphs.clock + ' ' + (event.message || 'criteria not met'))}`));
        break;
      case 'complete':
        spinner.stop();
        this.print(`\n  ${formatProgressBar(100)}`);
        this.print(`${style.accentBold(glyphs.star)} ${style.accent('Project completed and fully verified')}`);
        break;
      case 'paused':
        spinner.stop(`${style.warning(glyphs.bullet)} Run paused`);
        break;
      case 'blocked':
        spinner.stop(`${style.warning(glyphs.bullet)} ${style.warning('Blocked')} ${style.dim(glyphs.clock + ' ' + (event.message || 'needs attention'))}`);
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
      this.print(style.dim('No tasks planned yet.'));
      return;
    }

    this.print(style.bold('Tasks'));
    for (const t of tasks) {
      const { glyph, color } = getTaskSymbol(t.status);
      const title =
        t.status === 'APPROVED' ? style.dim(t.title) : style.white(t.title);
      this.print(`  ${color(glyph)} ${style.dim(t.id.padEnd(9))} ${title}`);
    }
  }

  public renderStatus(): void {
    const state = this.stateStore.getState();
    const tasks = Object.values(state.tasks);
    const approved = tasks.filter((t) => t.status === 'APPROVED').length;
    const requirements = Object.values(state.requirements);
    const satisfied = requirements.filter((r) => r.status === 'satisfied').length;
    const percent = this.orchestrator.calculateProgressPercent();

    this.print(`\n${style.boldGreen('✻ Status')}`);
    this.print(`  Status        ${style.white(state.status)}`);
    this.print(`  Revision      ${style.white(String(state.revision))}`);
    this.print(`  Tasks         ${style.green(`${approved}/${tasks.length}`)} approved`);
    this.print(`  Requirements  ${style.green(`${satisfied}/${requirements.length}`)} satisfied`);
    this.print(`  Progress      ${formatProgressBar(percent)}`);

    const blocked = tasks.filter((t) => t.status === 'BLOCKED');
    if (blocked.length > 0) {
      this.print(`\n${style.yellow(`Blocked (${blocked.length})`)}`);
      for (const b of blocked) {
        this.print(`  ${style.red('✗')} ${style.dim(b.id)} ${b.title}`);
      }
    }
  }

  /* Normal CLI conversation: user prompt goes to the agent with workspace
     tool access, response streams live. */
  private async sendAgentPrompt(text: string): Promise<void> {
    const adapter = this.orchestrator.agentAdapter;
    if (!adapter || typeof adapter.start !== 'function') {
      this.print(`${style.error('Agent unavailable.')} ${style.dim('Cannot send prompts in this mode.')}`);
      return;
    }

    this.print(style.dim(`› ${text}`));
    this.print(`\n${style.accentBold(glyphs.star)} ${style.accent('Responding')}…\n`);

    try {
      if (!this.chatSession || !(await adapter.isAlive(this.chatSession))) {
        this.chatSession = await adapter.start({
          workspaceDir: this.workspaceDir,
          role: 'A1',
          systemPrompt:
            'You are the interactive assistant embedded in the Sleekdo CLI. Answer questions, inspect the workspace with tools when asked, and help the user drive their project. Be concise.',
          tools: ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls'],
          ephemeralSession: false,
        });
      }

      let sawOutput = false;
      const eventPromise = (async () => {
        for await (const ev of adapter.events(this.chatSession!)) {
          if (ev.type === 'message') {
            const delta = String(ev.data.delta || ev.data.text || '');
            if (delta) {
              sawOutput = true;
              this.outStream.write(style.text(delta));
            }
          } else if (ev.type === 'tool_call') {
            this.outStream.write(style.dim(`\n  ${glyphs.gear} ${ev.data.name}…`));
          } else if (ev.type === 'tool_result') {
            this.outStream.write(style.dim(' done'));
          } else if (ev.type === 'turn_completed' && !sawOutput && ev.data.rawOutput) {
            sawOutput = true;
            this.outStream.write(style.text(String(ev.data.rawOutput)));
          }
        }
      })();

      await adapter.send(this.chatSession, text);
      while (!(await adapter.detectTurnCompletion(this.chatSession))) {
        await new Promise((r) => setTimeout(r, 80));
      }
      await eventPromise;
      this.outStream.write('\n');
    } catch (e: any) {
      this.print(`${style.error('Agent error:')} ${e.message || e}`);
    }
  }

  /* ! shell mode: run a command directly, like Claude Code */
  private async runShellCommand(command: string): Promise<void> {
    this.print(style.dim(`$ ${command}`));
    try {
      const { stdout, stderr } = await execAsync(command, { cwd: this.workspaceDir, maxBuffer: 1024 * 1024 });
      if (stdout.trim()) this.print(stdout.trimEnd());
      if (stderr.trim()) this.print(style.yellow(stderr.trimEnd()));
    } catch (e: any) {
      if (e.stdout && String(e.stdout).trim()) this.print(String(e.stdout).trimEnd());
      if (e.stderr && String(e.stderr).trim()) this.print(style.red(String(e.stderr).trimEnd()));
      if (typeof e.code === 'number') this.print(style.red(`exit ${e.code}`));
    }
  }

  public async executeCommand(line: string): Promise<boolean> {
    const trimmed = line.trim();
    if (!trimmed) return true;

    // /command aliases: /run behaves exactly like run
    if (trimmed.startsWith('/') && trimmed.length > 1 && !trimmed.startsWith('//')) {
      return this.executeCommand(trimmed.slice(1));
    }
    // ! shell mode
    if (trimmed.startsWith('!')) {
      const shellCmd = trimmed.slice(1).trim();
      if (shellCmd) await this.runShellCommand(shellCmd);
      return true;
    }
    // ? on empty-ish input toggles the shortcut help panel
    if (trimmed === '?') {
      this.print(style.dim('Shortcuts: /commands · /lockin <prompt> set objective · ! shell mode · ? help · anything else chats with the agent'));
      return true;
    }

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const rest = parts.slice(1).join(' ');

    switch (cmd) {
      case 'exit':
      case 'quit':
        this.print(style.dim('Exiting Sleekdo.'));
        return false;

      case 'help': {
        this.print(`\n${style.boldGreen('✻ Commands')} ${style.dim('· prefix with / also works')}`);
        const rows: Array<[string, string]> = [
          ['build <objective>', 'initialize and execute a build objective'],
          ['run', 'execute or continue autonomous run to completion'],
          ['status', 'current status and requirement coverage'],
          ['tasks', 'task list and statuses'],
          ['plan', 'active plan and requirements breakdown'],
          ['pause / resume', 'pause or resume execution'],
          ['review <taskId>', 'review verdict and evidence for a task'],
          ['retry <taskId>', 'reset a rejected or blocked task to READY'],
          ['logs', 'recent audit event log entries'],
          ['clean', 'dead-code and dead-file analysis sweep'],
          ['verify', 'final system verification'],
          ['exit / quit', 'exit interactive session'],
        ];
        for (const [name, desc] of rows) {
          this.print(`  ${style.green(name.padEnd(20))} ${style.dim(desc)}`);
        }
        this.print(`\n${style.boldGreen('✻ Input')} `);
        this.print(`  ${style.green('type anything')}         ${style.dim('chat with the agent about your project')}`);
        this.print(`  ${style.green('/lockin <prompt>')}       ${style.dim('add to / change the build objective (re-plans tasks)')}`);
        this.print(`  ${style.green('/<command>')}           ${style.dim('run a slash command, e.g. /tasks')}`);
        this.print(`  ${style.green('!<shell command>')}     ${style.dim('run a shell command directly')}`);
        this.print(`  ${style.green('↑ / ↓')}                 ${style.dim('recall input history')}`);
        this.print(`  ${style.green('?')}                    ${style.dim('show this hint')}`);
        this.print(`  ${style.green('Ctrl+C')}                ${style.dim('clear input · press twice to exit')}`);
        this.print('');
        return true;
      }

      case 'status':
        this.renderStatus();
        return true;

      case 'tasks':
        this.renderTasksList();
        return true;

      case 'plan': {
        const state = this.stateStore.getState();
        this.print(`\n${style.boldGreen('✻ Plan')} ${style.dim(`v${state.planVersion}`)}`);
        this.print(`  ${style.dim('Objective:')} ${style.white(state.originalRequest || 'None')}`);
        this.print(`  ${style.bold('Requirements')}`);
        for (const req of Object.values(state.requirements)) {
          const mark = req.status === 'satisfied' ? style.green('✓') : style.dim('☐');
          this.print(`    ${mark} ${style.dim(req.id)} ${req.status === 'satisfied' ? style.dim(req.description) : style.white(req.description)}`);
        }
        this.print(`\n  ${style.bold('Tasks')}`);
        this.renderTasksList();
        return true;
      }

      case 'lockin': {
        if (!rest) {
          this.print('Usage: lockin <what to add or change in the objective>');
          return true;
        }
        await this.handleBuildRequest(rest);
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
        this.isRunning = true;
        try {
          const state = this.stateStore.getState();
          if (Object.keys(state.tasks).length === 0 && state.originalRequest) {
            await this.handleBuildRequest(state.originalRequest);
          }
          const completed = await this.orchestrator.runToCompletion();
          if (completed) {
            this.print(`${style.boldGreen('✻')} ${style.green('Complete: project is fully built and verified.')}`);
          } else {
            this.print(style.dim('Run paused or pending. Type "status" or "tasks" to inspect.'));
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
        this.print(`${style.yellow('⏸')} Project execution paused.`);
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
        this.print(`${style.green('▶')} Project execution resumed. Type "run" to continue.`);
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
        const decisionColor =
          latest.decision === 'APPROVE' ? style.green : latest.decision === 'REJECT' ? style.red : style.yellow;
        this.print(`\n${style.boldGreen('✻ Review')} ${style.dim(`${latest.id} · ${taskId}`)}`);
        this.print(`  Decision  ${decisionColor(latest.decision)}`);
        this.print(`  Summary   ${style.white(latest.summary)}`);
        if (latest.blockingIssues.length > 0) {
          this.print(`  ${style.red('Blocking issues')}`);
          for (const b of latest.blockingIssues) {
            this.print(`    ${style.red('•')} ${b.description}`);
            this.print(`      ${style.dim(`Fix: ${b.requiredFix}`)}`);
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
        this.print(`${style.green('↻')} Task ${taskId} reset to READY. Type "run" to execute.`);
        return true;
      }

      case 'logs': {
        const events = this.eventStore.getEvents().slice(-10);
        this.print(`\n${style.boldGreen('✻ Recent events')} ${style.dim(`(${events.length})`)}`);
        for (const e of events) {
          const time = new Date(e.timestamp).toLocaleTimeString();
          this.print(`  ${style.dim(`[${time}]`)} ${style.green(e.actor)} → ${e.type} ${e.taskId ? style.dim(e.taskId) : ''}`);
        }
        return true;
      }

      case 'clean': {
        this.status('Sweeping', 'dead-code and dead-file analysis');
        const findings = this.orchestrator.cleanupManager.runSweep();
        getSpinner(this.outStream).stop();
        this.print(resultLine(true, `Found ${findings.length} cleanup candidate(s).`));
        for (const f of findings) {
          this.print(`  ${style.dim(glyphs.bullet)} [${f.classification}] ${f.file} ${style.dim(`(${f.reason})`)}`);
        }
        return true;
      }

      case 'verify': {
        this.status('Verifying', 'final system verification');
        const res = await this.orchestrator.finalVerifier.verifySystem({
          testCommand: this.orchestrator.testEngine ? undefined : undefined,
        });
        getSpinner(this.outStream).stop(
          res.isComplete
            ? resultLine(true, 'Verification PASSED')
            : `${style.warning(glyphs.bullet)} Verification INCOMPLETE`
        );
        return true;
      }

      default:
        // Fresh project: free-form text is the build objective.
        // Active project: normal CLI conversation with the agent.
        if (!this.stateStore.getState().originalRequest) {
          await this.handleBuildRequest(trimmed);
          return true;
        }
        await this.sendAgentPrompt(trimmed);
        return true;
    }
  }

  private async handleBuildRequest(request: string): Promise<void> {
    const state = this.stateStore.getState();
    const isUpdate = !!(state.originalRequest && Object.keys(state.tasks).length > 0);
    const spinner = getSpinner(this.outStream);
    if (isUpdate) {
      spinner.start('Refining objective');
      const replanned = await this.orchestrator.refineObjective(request);
      spinner.stop();
      this.renderTasksList();
      if (!replanned) {
        this.print(style.warning('Plan revision was not approved by the reviewer. Adjust the objective and try again.'));
      } else {
        this.print(style.dim('\nType "run" to execute the updated plan.'));
      }
      return;
    }
    spinner.start('Initializing', `"${request}"`);
    await this.orchestrator.initialize(request);
    spinner.stop(resultLine(true, 'Plan created'));
    this.renderTasksList();
    this.print(style.dim('\nType "run" to start autonomous development or inspect with "status".'));
  }

  public async start(): Promise<void> {
    this.renderHeader();

    const state = this.stateStore.getState();
    this.rawModeAvailable =
      (this.inStream as any).isTTY === true && typeof (this.inStream as any).setRawMode === 'function';

    if (!this.rawModeAvailable) {
      // Non-TTY (piped/automated input): readline fallback, no raw mode
      this.rl = readline.createInterface({
        input: this.inStream,
        output: this.outStream,
        terminal: false,
        historySize: 200,
        prompt: '',
      });
    } else {
      readline.emitKeypressEvents(this.inStream);
    }
    if (this.rl) {
      // readline emits 'close' when stdin ends (piped input, Ctrl+D)
      this.rl.on('close', () => {
        this.rlClosed = true;
        if (this.lineResolver) {
          const r = this.lineResolver;
          this.lineResolver = null;
          r('exit');
        }
      });
      // Collect every line as it arrives; typed-ahead lines are queued so
      // nothing is lost while the orchestrator is busy.
      this.rl.on('line', (l: string) => {
        if (this.lineResolver) {
          const r = this.lineResolver;
          this.lineResolver = null;
          r(l);
        } else {
          this.lineQueue.push(l);
        }
      });
    }

    // If project is not yet initialized or has no tasks, prompt for objective or resume planning
    const hasTasks = Object.keys(state.tasks).length > 0;
    if (!state.originalRequest || !hasTasks) {
      if (!state.originalRequest) {
        // Route through executeCommand so "help", "run", etc. work here too;
        // any other text falls through to the build-objective handler.
        const answer = await this.askInput();
        if (answer && answer.trim()) {
          await this.executeCommand(answer.trim());
        }
      } else {
        this.print(style.dim(`\nLoaded active project: "${state.originalRequest}"`));
        this.status('Planning', 'tasks for active project');
        await this.handleBuildRequest(state.originalRequest);
      }
    } else {
      this.print(style.dim(`\nLoaded active project: "${state.originalRequest}"`));
      this.renderTasksList();
    }

    // Start REPL loop
    await this.promptLoop();
  }

  /* readline's per-keystroke refresh emits \x1b[0J (clear to end of screen),
     which erases the box's bottom border below the input row. This wrapper
     re-draws the border after every clear so the box stays closed while
     typing. Inert when no box is on screen (boxRedraw === null). */
  private wrapOutput(target: NodeJS.WritableStream): NodeJS.WritableStream {
    const self = this;
    return new Proxy(target, {
      get(obj: any, prop: string | symbol) {
        if (prop === 'write') {
          return (chunk: any, ...rest: any[]) => {
            const result = obj.write(chunk, ...rest);
            if (typeof chunk === 'string' && chunk.includes('\x1b[0J') && self.boxRedraw) {
              // save cursor, step down one row, clear it, draw border, restore
              obj.write(`\x1b[s\x1b[1B\x1b[2K\r${self.boxRedraw}\x1b[u`);
            }
            return result;
          };
        }
        const value = obj[prop];
        return typeof value === 'function' ? value.bind(obj) : value;
      },
    }) as unknown as NodeJS.WritableStream;
  }

  /* Claude Code-style input box: fully closed while typing. The box is
     pre-rendered and the cursor is moved inside it, so the ❯ and your text
     sit between complete borders instead of an open-ended line. */
  private askInput(): Promise<string> {
    if (this.rawModeAvailable) {
      return this.readViaBox();
    }
    return this.readViaReadline();
  }

  /* Raw-mode box on TTYs: full control, always-closed box, horizontal scroll. */
  private async readViaBox(): Promise<string> {
    if (this.rawHistory.length === 0) {
      this.rawHistory = this.loadHistory();
    }
    const box = new InputBox({
      stdin: this.inStream,
      out: this.outStream,
      history: this.rawHistory,
      saveHistory: (line) => this.saveHistoryEntry(line),
      complete: (line) => {
        if (line.includes(' ')) return [];
        const names = ['build ', 'lockin ', 'run', 'status', 'tasks', 'plan', 'pause', 'resume', 'review ', 'retry ', 'logs', 'clean', 'verify', 'help', 'exit', 'quit'];
        return names.filter((c) => c.startsWith(line));
      },
      onDoubleCtrlC: () => {
        this.print(style.dim('Exiting Sleekdo.'));
        process.exit(0);
      },
    });
    const line = await box.read();
    if (line.trim()) this.rawHistory.push(line);
    this.print(this.statusLine());
    return line;
  }

  /* Readline fallback for non-TTY (piped/automated) input. */
  private readViaReadline(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.rl || this.rlClosed) {
        resolve('exit');
        return;
      }
      if (this.lineQueue.length > 0) {
        resolve(this.lineQueue.shift()!);
        return;
      }
      this.lineResolver = resolve;
      const width = this.boxWidth();
      this.print(style.dimGreen(`╭${'─'.repeat(width)}╮`));
      this.print(style.dimGreen(`│${' '.repeat(width)}│`));
      this.boxRedraw = style.dimGreen(`╰${'─'.repeat(width)}╯`);
      this.print(this.boxRedraw);
      // Step back up into the box: cursor is on the row after the bottom
      // border; move up one row and in past the left border.
      moveCursor(this.outStream, 0, -1);
      cursorTo(this.outStream, 2);
      this.rl.question(`${style.accentBold(glyphs.arrow)} `, (ans) => {
        this.boxRedraw = null;
        // readline dropped to the bottom-border row after Enter; step below it
        moveCursor(this.outStream, 0, 1);
        this.print(this.statusLine());
        resolve(ans);
      });
    });
  }

  /* Box spans the full usable terminal width, clamped to sane bounds.
     Long input wraps inside the box rows; both borders always match. */
  private boxWidth(): number {
    const cols = (this.outStream as any).columns || (process.stdout as any).columns || 80;
    return Math.max(24, Math.min(cols - 2, 160));
  }

  /* Claude Code-style bottom status line: model · cwd · project state */
  private statusLine(): string {
    let state = 'IDLE';
    try {
      state = this.stateStore.getState().status || 'IDLE';
    } catch {
      // state not ready
    }
    const cwd = this.workspaceDir.length > 40 ? '…' + this.workspaceDir.slice(-39) : this.workspaceDir;
    return style.dim(`${this.agentName} ${style.dim('·')} ${cwd} ${style.dim('·')} ${state}`);
  }

  /* Tab completion: slash commands + task ids for retry/review */
  private completer(line: string): [string[], string] {
    const commands = [
      'build ', 'lockin ', 'run', 'status', 'tasks', 'plan', 'pause', 'resume',
      'review ', 'retry ', 'logs', 'clean', 'verify', 'help', 'exit', 'quit',
    ].map((c) => '/' + c.trim()).concat(['!', '?']);
    const trimmed = line.trimStart();
    if (trimmed.startsWith('/') || trimmed.startsWith('!')) {
      const hits = commands.filter((c) => c.startsWith(trimmed));
      return [hits.length > 0 ? hits : commands, trimmed];
    }
    const parts = trimmed.split(/\s+/);
    const taskCmds = ['review', 'retry', '/review', '/retry'];
    if (parts.length === 2 && taskCmds.includes(parts[0])) {
      const ids = Object.keys(this.stateStore.getState().tasks).filter((id) =>
        id.startsWith(parts[1])
      );
      return [ids, parts[1]];
    }
    // First word: suggest command names even without a leading slash
    if (parts.length === 1 && !trimmed.startsWith('!') && !trimmed.startsWith('?')) {
      const names = ['build ', 'lockin ', 'run', 'status', 'tasks', 'plan', 'pause', 'resume', 'review ', 'retry ', 'logs', 'clean', 'verify', 'help', 'exit', 'quit'];
      const hits = names.filter((c) => c.trim().startsWith(trimmed));
      return [hits, trimmed];
    }
    return [[], line];
  }

  /* Command history persisted per project in .sleekdo/history */
  private historyPath(): string {
    return path.join(this.workspaceDir, '.sleekdo', 'history');
  }

  private loadHistory(): string[] {
    try {
      return fs
        .readFileSync(this.historyPath(), 'utf8')
        .split('\n')
        .reverse()
        .filter((l) => l.trim());
    } catch {
      return [];
    }
  }

  private saveHistoryEntry(line: string): void {
    try {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length > 2000) return;
      const existing = fs.existsSync(this.historyPath())
        ? fs.readFileSync(this.historyPath(), 'utf8').split('\n').filter(Boolean)
        : [];
      const deduped = existing.filter((l) => l !== trimmed);
      deduped.push(trimmed);
      fs.mkdirSync(path.dirname(this.historyPath()), { recursive: true });
      fs.writeFileSync(this.historyPath(), deduped.slice(-200).join('\n') + '\n');
    } catch {
      // history is best-effort
    }
  }

  private async promptLoop(): Promise<void> {
    let ctrlCPresses = 0;
    this.rl?.on('SIGINT', () => {
      const now = Date.now();
      if (now - this.lastCtrlC < 2000) {
        this.print(style.dim('\nExiting Sleekdo.'));
        process.exit(0);
      }
      this.lastCtrlC = now;
      this.print(style.dim('\nPress Ctrl+C again to exit.'));
      this.rl?.write('');
      void ctrlCPresses;
    });

    while (true) {
      const line = await this.askInput();
      if (line === null || line === undefined) {
        break;
      }
      if (line.trim()) this.saveHistoryEntry(line);
      const continueLoop = await this.executeCommand(line);
      if (!continueLoop) {
        break;
      }
    }

    this.rl?.close();
  }
}

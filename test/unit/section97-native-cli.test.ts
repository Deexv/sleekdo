import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Writable } from 'node:stream';
import {
  formatBoxHeader,
  formatProgressBar,
  getTaskSymbol,
  InteractiveCliSession,
} from '../../dist/cli/interactive-cli.js';
import { resolveProvider } from '../../dist/cli/cli.js';
import { MockAdapter } from '../../dist/adapters/mock-adapter.js';
import { PiAdapter } from '../../dist/adapters/pi-adapter.js';
import { GenericPTYAdapter } from '../../dist/adapters/generic-pty-adapter.js';
import type { SleekdoConfig } from '../../dist/config/config.js';
import { StateStore } from '../../dist/storage/state-store.js';

class StringWritable extends Writable {
  public output = '';
  _write(chunk: any, encoding: any, callback: any) {
    this.output += chunk.toString();
    callback();
  }
}

describe('Section 97: Sleekdo-native CLI and interactive interface', () => {
  let tmpDir: string;
  const dummyConfig: SleekdoConfig = {
    defaultAdapter: 'mock',
    maxConsecutiveRejections: 3,
    maxIterations: 10,
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sleekdo-sec97-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('resolveProvider flag and subcommand parsing (PRD Section 97)', () => {
    it('resolves --pi and pi subcommand to Pi provider', () => {
      const resFlag = resolveProvider('--pi', undefined, dummyConfig);
      assert.ok(resFlag);
      assert.strictEqual(resFlag.isInteractive, true);
      assert.strictEqual(resFlag.providerName, 'Pi');
      assert.ok(resFlag.adapter instanceof PiAdapter);

      const resSub = resolveProvider('pi', undefined, dummyConfig);
      assert.ok(resSub);
      assert.strictEqual(resSub.isInteractive, true);
      assert.strictEqual(resSub.providerName, 'Pi');
      assert.ok(resSub.adapter instanceof PiAdapter);
    });

    it('resolves --agy and agy subcommand to Antigravity (Agy) provider', () => {
      const resFlag = resolveProvider('--agy', undefined, dummyConfig);
      assert.ok(resFlag);
      assert.strictEqual(resFlag.isInteractive, true);
      assert.strictEqual(resFlag.providerName, 'Antigravity (Agy)');
      assert.ok(resFlag.adapter instanceof GenericPTYAdapter);

      const resSub = resolveProvider('agy', undefined, dummyConfig);
      assert.ok(resSub);
      assert.strictEqual(resSub.isInteractive, true);
      assert.strictEqual(resSub.providerName, 'Antigravity (Agy)');
    });

    it('resolves --claude and claude subcommand to Claude Code provider', () => {
      const resFlag = resolveProvider('--claude', undefined, dummyConfig);
      assert.ok(resFlag);
      assert.strictEqual(resFlag.isInteractive, true);
      assert.strictEqual(resFlag.providerName, 'Claude Code');
      assert.ok(resFlag.adapter instanceof GenericPTYAdapter);

      const resSub = resolveProvider('claude', undefined, dummyConfig);
      assert.ok(resSub);
      assert.strictEqual(resSub.isInteractive, true);
      assert.strictEqual(resSub.providerName, 'Claude Code');
    });

    it('resolves --provider flag with target agent', () => {
      const resPi = resolveProvider('--provider', 'pi', dummyConfig);
      assert.ok(resPi);
      assert.strictEqual(resPi.providerName, 'Pi');

      const resClaude = resolveProvider('--provider', 'claude', dummyConfig);
      assert.ok(resClaude);
      assert.strictEqual(resClaude.providerName, 'Claude Code');

      const resAgy = resolveProvider('--provider', 'agy', dummyConfig);
      assert.ok(resAgy);
      assert.strictEqual(resAgy.providerName, 'Antigravity (Agy)');

      const resMock = resolveProvider('--provider', 'mock', dummyConfig);
      assert.ok(resMock);
      assert.strictEqual(resMock.providerName, 'Mock');
    });

    it('resolves bare or --interactive invocation to default adapter', () => {
      const resBare = resolveProvider(undefined, undefined, dummyConfig);
      assert.ok(resBare);
      assert.strictEqual(resBare.isInteractive, true);
      assert.strictEqual(resBare.providerName, 'Mock');

      const resInter = resolveProvider('--interactive', undefined, dummyConfig);
      assert.ok(resInter);
      assert.strictEqual(resInter.isInteractive, true);
    });

    it('returns null for non-interactive batch subcommands', () => {
      assert.strictEqual(resolveProvider('run', undefined, dummyConfig), null);
      assert.strictEqual(resolveProvider('status', undefined, dummyConfig), null);
      assert.strictEqual(resolveProvider('init', undefined, dummyConfig), null);
      assert.strictEqual(resolveProvider('clean', undefined, dummyConfig), null);
      assert.strictEqual(resolveProvider('verify', undefined, dummyConfig), null);
    });
  });

  describe('UI components and box formatting', () => {
    it('renders box header containing SLEEKDO, Agent, and Project name', () => {
      const header = formatBoxHeader('Pi', 'my-project');
      assert.ok(header.includes('╭'));
      assert.ok(header.includes('╰'));
      assert.ok(header.includes('SLEEKDO'));
      assert.ok(header.includes('Agent: Pi'));
      assert.ok(header.includes('Project: my-project'));
    });

    it('renders progress bar with filled and unfilled blocks', () => {
      const bar0 = formatProgressBar(0, 10);
      assert.strictEqual(bar0, '[░░░░░░░░░░] 0%');

      const bar50 = formatProgressBar(50, 10);
      assert.strictEqual(bar50, '[█████░░░░░] 50%');

      const bar100 = formatProgressBar(100, 10);
      assert.strictEqual(bar100, '[██████████] 100%');
    });

    it('maps task statuses to appropriate terminal symbols', () => {
      assert.strictEqual(getTaskSymbol('APPROVED'), '✓');
      assert.strictEqual(getTaskSymbol('IN_PROGRESS'), '→');
      assert.strictEqual(getTaskSymbol('AWAITING_REVIEW'), '→');
      assert.strictEqual(getTaskSymbol('READY'), '○');
      assert.strictEqual(getTaskSymbol('PENDING'), '○');
      assert.strictEqual(getTaskSymbol('REJECTED'), '✗');
      assert.strictEqual(getTaskSymbol('BLOCKED'), '✗');
    });
  });

  describe('InteractiveCliSession command execution loop', () => {
    function setupMockAdapters(tmp: string) {
      const workerAdapter = new MockAdapter();
      const plannerAdapter = new MockAdapter();
      const reviewerAdapter = new MockAdapter();

      // Initial plan
      plannerAdapter.addHandler(async (_input, _session, emit) => {
        const plan = {
          requirements: [
            { id: 'req_001', description: 'Core system', verificationCriteria: ['system works'] },
          ],
          tasks: [
            {
              id: 'task_001',
              title: 'Project architecture',
              objective: 'Setup architecture',
              requirements: ['req_001'],
              acceptanceCriteria: ['Files created'],
              dependencies: [],
              type: 'task',
            },
          ],
        };
        emit({ type: 'message', timestamp: Date.now(), data: { text: JSON.stringify(plan) } });
      });

      // Plan review approval
      reviewerAdapter.addHandler(async (_input, _session, emit) => {
        emit({
          type: 'message',
          timestamp: Date.now(),
          data: { text: JSON.stringify({ approved: true, reason: 'Valid plan' }) },
        });
      });

      // Worker task execution
      workerAdapter.addHandler(async (_input, _session, emit) => {
        fs.writeFileSync(path.join(tmp, 'index.ts'), 'export const ready = true;\n');
        emit({ type: 'tool_call', timestamp: Date.now(), data: { name: 'write', args: { path: 'index.ts' } } });
        emit({ type: 'message', timestamp: Date.now(), data: { text: 'Setup index.ts' } });
      });

      // Task review approval
      reviewerAdapter.addHandler(async (_input, _session, emit) => {
        emit({
          type: 'message',
          timestamp: Date.now(),
          data: {
            text: JSON.stringify({
              decision: 'APPROVE',
              summary: 'Architecture setup verified',
              requirementCompliance: true,
              acceptanceCriteriaMet: true,
              implementationExists: true,
              testsPass: true,
              noRegressions: true,
              scopeControlled: true,
              noDeadCodeIntroduced: true,
              blockingIssues: [],
            }),
          },
        });
      });

      // Reassessment complete
      plannerAdapter.addHandler(async (_input, _session, emit) => {
        emit({
          type: 'message',
          timestamp: Date.now(),
          data: {
            text: JSON.stringify({
              newTasks: [],
              newlyDiscoveredRequirements: [],
              obsoleteTaskIds: [],
              isComplete: true,
              reason: 'All tasks completed and verified',
            }),
          },
        });
      });

      return { workerAdapter, plannerAdapter, reviewerAdapter };
    }

    it('executes help, status, plan, pause, resume, and exit commands', async () => {
      const out = new StringWritable();
      const { workerAdapter, plannerAdapter, reviewerAdapter } = setupMockAdapters(tmpDir);

      const session = new InteractiveCliSession({
        workspaceDir: tmpDir,
        agentName: 'MockAgent',
        workerAdapter,
        plannerAdapter,
        reviewerAdapter,
        output: out,
      });

      // 1. Help
      const contHelp = await session.executeCommand('help');
      assert.strictEqual(contHelp, true);
      assert.ok(out.output.includes('Available Sleekdo commands:'));
      assert.ok(out.output.includes('build <objective>'));

      // 2. Status when empty
      out.output = '';
      const contStatus = await session.executeCommand('status');
      assert.strictEqual(contStatus, true);
      assert.ok(out.output.includes('=== Project Status ==='));

      // 3. Build command initializes project
      out.output = '';
      const contBuild = await session.executeCommand('build Build inventory system');
      assert.strictEqual(contBuild, true);
      assert.ok(out.output.includes('Initializing project with request'));
      assert.ok(out.output.includes('Tasks'));

      // 4. Tasks list shows planned items
      out.output = '';
      const contTasks = await session.executeCommand('tasks');
      assert.strictEqual(contTasks, true);
      assert.ok(out.output.includes('Tasks'));
      assert.ok(out.output.includes('task_001'));

      // 5. Plan command
      out.output = '';
      const contPlan = await session.executeCommand('plan');
      assert.strictEqual(contPlan, true);
      assert.ok(out.output.includes('Plan Version: 1'));
      assert.ok(out.output.includes('Requirements'));

      // 6. Pause command
      out.output = '';
      const contPause = await session.executeCommand('pause');
      assert.strictEqual(contPause, true);
      assert.ok(out.output.includes('Project execution paused.'));

      // 7. Resume command
      out.output = '';
      const contResume = await session.executeCommand('resume');
      assert.strictEqual(contResume, true);
      assert.ok(out.output.includes('Project execution resumed.'));

      // 8. Run command runs orchestrator to completion
      out.output = '';
      const contRun = await session.executeCommand('run');
      assert.strictEqual(contRun, true);
      assert.ok(out.output.includes('[Sleekdo] Complete: Project is fully built and verified.'));

      // 9. Status after completion shows 100% progress
      out.output = '';
      await session.executeCommand('status');
      assert.ok(out.output.includes('100%'));

      // 10. Exit command returns false
      out.output = '';
      const contExit = await session.executeCommand('exit');
      assert.strictEqual(contExit, false);
      assert.ok(out.output.includes('Exiting Sleekdo.'));
    });

    it('supports task review inspection and retry commands', async () => {
      const out = new StringWritable();
      const { workerAdapter, plannerAdapter, reviewerAdapter } = setupMockAdapters(tmpDir);

      const session = new InteractiveCliSession({
        workspaceDir: tmpDir,
        agentName: 'MockAgent',
        workerAdapter,
        plannerAdapter,
        reviewerAdapter,
        output: out,
      });

      // Initialize project and run
      await session.executeCommand('build Create backend service');
      await session.executeCommand('run');

      // Inspect review for task_001
      out.output = '';
      await session.executeCommand('review task_001');
      assert.ok(out.output.includes('Review rev_'));
      assert.ok(out.output.includes('Decision: APPROVE'));

      // Test retry command on task_001
      out.output = '';
      await session.executeCommand('retry task_001');
      assert.ok(out.output.includes('Task task_001 reset to READY'));

      const stateStore = new StateStore(tmpDir);
      assert.strictEqual(stateStore.getTask('task_001')?.status, 'READY');

      // Test logs command
      out.output = '';
      await session.executeCommand('logs');
      assert.ok(out.output.includes('Recent Events'));
    });

    it('automatically initializes and plans when run is executed on an uncompleted project without tasks', async () => {
      const out = new StringWritable();
      const stateStore = new StateStore(tmpDir);

      // Pre-seed an uncompleted state where request exists but planning aborted
      stateStore.updateState((draft) => {
        draft.originalRequest = 'Build a game project';
        draft.status = 'PLAN_REVIEW';
        draft.tasks = {};
      });

      const { workerAdapter, plannerAdapter, reviewerAdapter } = setupMockAdapters(tmpDir);

      const session = new InteractiveCliSession({
        workspaceDir: tmpDir,
        agentName: 'MockAgent',
        workerAdapter,
        plannerAdapter,
        reviewerAdapter,
        output: out,
      });

      // Type run directly
      const contRun = await session.executeCommand('run');
      assert.strictEqual(contRun, true);

      // Verify that planning ran and project reached completion
      assert.ok(out.output.includes('Initializing project with request'));
      const finalState = new StateStore(tmpDir).getState();
      assert.strictEqual(finalState.status, 'COMPLETE');
      assert.ok(Object.keys(finalState.tasks).length > 0);
    });
  });
});

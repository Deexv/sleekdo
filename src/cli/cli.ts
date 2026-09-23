import { Orchestrator } from '../core/orchestrator.js';
import { PiAdapter } from '../adapters/pi-adapter.js';
import { MockAdapter } from '../adapters/mock-adapter.js';
import { GenericPTYAdapter } from '../adapters/generic-pty-adapter.js';
import type { AgentAdapter } from '../adapters/agent-adapter.js';
import { loadConfig, type SleekdoConfig } from '../config/config.js';
import { StateStore } from '../storage/state-store.js';
import { InteractiveCliSession } from './interactive-cli.js';

function createAdapter(type: 'pi' | 'mock' | 'generic', config: SleekdoConfig): AgentAdapter {
  if (type === 'mock') {
    return new MockAdapter();
  } else if (type === 'generic') {
    return new GenericPTYAdapter(config.genericCliCommand || 'claude', config.genericCliArgs || ['-p', '{prompt}']);
  } else {
    return new PiAdapter(config.piCliPath);
  }
}

export function resolveProvider(
  firstArg: string | undefined,
  secondArg: string | undefined,
  config: SleekdoConfig
): { isInteractive: boolean; providerName: string; adapter: AgentAdapter } | null {
  if (!firstArg || firstArg === '--interactive' || firstArg === 'interactive') {
    const norm = config.defaultAdapter;
    const adapter = createAdapter(norm, config);
    const name = norm === 'pi' ? 'Pi' : norm === 'generic' ? 'Generic CLI' : 'Mock';
    return { isInteractive: true, providerName: name, adapter };
  }

  const lower = firstArg.toLowerCase();
  if (lower === '--pi' || lower === 'pi') {
    return { isInteractive: true, providerName: 'Pi', adapter: new PiAdapter(config.piCliPath) };
  }
  if (lower === '--agy' || lower === 'agy') {
    return {
      isInteractive: true,
      providerName: 'Antigravity (Agy)',
      adapter: new GenericPTYAdapter('agy', ['-p', '{prompt}', '--dangerously-skip-permissions']),
    };
  }
  if (lower === '--claude' || lower === 'claude') {
    return {
      isInteractive: true,
      providerName: 'Claude Code',
      adapter: new GenericPTYAdapter('claude', ['-p', '{prompt}', '--dangerously-skip-permissions']),
    };
  }
  if (lower === '--provider' && secondArg) {
    const prov = secondArg.toLowerCase();
    if (prov === 'pi') {
      return { isInteractive: true, providerName: 'Pi', adapter: new PiAdapter(config.piCliPath) };
    }
    if (prov === 'agy') {
      return {
        isInteractive: true,
        providerName: 'Antigravity (Agy)',
        adapter: new GenericPTYAdapter('agy', ['-p', '{prompt}', '--dangerously-skip-permissions']),
      };
    }
    if (prov === 'claude') {
      return {
        isInteractive: true,
        providerName: 'Claude Code',
        adapter: new GenericPTYAdapter('claude', ['-p', '{prompt}', '--dangerously-skip-permissions']),
      };
    }
    if (prov === 'mock') {
      return { isInteractive: true, providerName: 'Mock', adapter: new MockAdapter() };
    }
    return {
      isInteractive: true,
      providerName: secondArg,
      adapter: new GenericPTYAdapter(secondArg, ['-p', '{prompt}']),
    };
  }

  return null;
}

export async function runCli(args: string[]): Promise<void> {
  const workspaceDir = process.cwd();
  const config = loadConfig(workspaceDir);

  // Check for Section 97 Sleekdo-native CLI interactive flags
  const providerResolution = resolveProvider(args[0], args[1], config);
  if (providerResolution && providerResolution.isInteractive) {
    const session = new InteractiveCliSession({
      workspaceDir,
      agentName: providerResolution.providerName,
      workerAdapter: providerResolution.adapter,
      plannerAdapter: config.plannerAdapter ? createAdapter(config.plannerAdapter, config) : providerResolution.adapter,
      reviewerAdapter: config.reviewerAdapter ? createAdapter(config.reviewerAdapter, config) : providerResolution.adapter,
      testCommand: config.testCommand,
      testArgs: config.testArgs,
      maxConsecutiveRejections: config.maxConsecutiveRejections,
    });
    await session.start();
    return;
  }

  const command = args[0] || 'status';
  const defaultAdapter = createAdapter(config.defaultAdapter, config);
  const workerAdapter = config.workerAdapter ? createAdapter(config.workerAdapter, config) : defaultAdapter;
  const plannerAdapter = config.plannerAdapter ? createAdapter(config.plannerAdapter, config) : defaultAdapter;
  const reviewerAdapter = config.reviewerAdapter ? createAdapter(config.reviewerAdapter, config) : defaultAdapter;

  const orchestrator = new Orchestrator({
    workspaceDir,
    workerAdapter,
    plannerAdapter,
    reviewerAdapter,
    maxConsecutiveRejections: config.maxConsecutiveRejections,
    testCommand: config.testCommand,
    testArgs: config.testArgs,
    maxIterations: config.maxIterations,
  });

  switch (command) {
    case 'init': {
      const request = args.slice(1).join(' ');
      if (!request) {
        console.error('Usage: sleekdo init <user request>');
        process.exit(1);
      }
      console.log(`[Sleekdo] Initializing project with request: "${request}"`);
      await orchestrator.initialize(request);
      console.log('[Sleekdo] Project plan created and approved.');
      break;
    }

    case 'run': {
      const request = args.slice(1).join(' ');
      if (request) {
        console.log(`[Sleekdo] Initializing with request: "${request}"`);
        await orchestrator.initialize(request);
      }
      console.log('[Sleekdo] Running orchestrator loop...');
      const completed = await orchestrator.runToCompletion();
      if (completed) {
        console.log('[Sleekdo] Project successfully completed and fully verified.');
      } else {
        console.log('[Sleekdo] Run paused or requires attention. Check status.');
      }
      break;
    }

    case 'status': {
      const stateStore = new StateStore(workspaceDir);
      const state = stateStore.getState();
      console.log('=== Sleekdo Status ===');
      console.log(`Project ID: ${state.projectId}`);
      console.log(`Status: ${state.status}`);
      console.log(`Revision: ${state.revision}`);
      console.log(`Active Task: ${state.currentTaskId || 'None'}`);
      console.log(`Tasks Total: ${Object.keys(state.tasks).length}`);

      const tasks = Object.values(state.tasks);
      const approved = tasks.filter((t) => t.status === 'APPROVED').length;
      console.log(`Tasks Approved: ${approved}/${tasks.length}`);
      console.log(`Requirements Satisfied: ${Object.values(state.requirements).filter((r) => r.status === 'satisfied').length}/${Object.keys(state.requirements).length}`);
      const blockedTasks = tasks.filter((t) => t.status === 'BLOCKED');
      console.log(`Blocking Work: ${blockedTasks.length} blocked task(s)`);
      for (const b of blockedTasks) {
        console.log(`  - [BLOCKED] ${b.id}: ${b.title}`);
      }
      console.log(`Active Investigations: ${Object.values(state.investigations).filter((i) => i.status === 'active').length}`);
      console.log(`Cleanup Findings: ${state.cleanupFindings.length}`);
      break;
    }

    case 'verify': {
      console.log('[Sleekdo] Running final system verification...');
      const verifier = orchestrator.finalVerifier;
      const res = await verifier.verifySystem({
        testCommand: config.testCommand,
        testArgs: config.testArgs,
      });
      console.log('Verification Complete:', res.isComplete ? 'PASSED' : 'INCOMPLETE');
      console.log('Checks:', JSON.stringify(res.checks, null, 2));
      break;
    }

    case 'clean': {
      console.log('[Sleekdo] Running dead-code and dead-file analysis...');
      const findings = orchestrator.cleanupManager.runSweep();
      console.log(`Found ${findings.length} cleanup candidate(s).`);
      for (const f of findings) {
        console.log(`- [${f.classification}] ${f.file} (${f.reason})`);
      }
      const tasks = orchestrator.cleanupManager.generateCleanupTasks();
      console.log(`Generated ${tasks.length} cleanup tasks.`);
      break;
    }

    case 'inspect': {
      const taskId = args[1];
      if (!taskId) {
        console.error('Usage: sleekdo inspect <taskId>');
        process.exit(1);
      }
      const stateStore = new StateStore(workspaceDir);
      const task = stateStore.getTask(taskId);
      if (!task) {
        console.error(`Task ${taskId} not found.`);
        process.exit(1);
      }
      console.log(JSON.stringify(task, null, 2));
      break;
    }

    case 'pause': {
      const stateStore = new StateStore(workspaceDir);
      stateStore.updateState((draft) => {
        draft.isPaused = true;
      });
      orchestrator.eventStore.appendEvent(
        stateStore.getRevision(),
        'HUMAN_OVERRIDE',
        'USER',
        { action: 'pause' }
      );
      console.log('[Sleekdo] Project execution paused by human override.');
      break;
    }

    case 'resume': {
      const stateStore = new StateStore(workspaceDir);
      stateStore.updateState((draft) => {
        draft.isPaused = false;
      });
      orchestrator.eventStore.appendEvent(
        stateStore.getRevision(),
        'HUMAN_OVERRIDE',
        'USER',
        { action: 'resume' }
      );
      console.log('[Sleekdo] Project execution resumed.');
      break;
    }

    case 'clarify': {
      const clarification = args.slice(1).join(' ');
      if (!clarification) {
        console.error('Usage: sleekdo clarify <clarification message>');
        process.exit(1);
      }
      const stateStore = new StateStore(workspaceDir);
      orchestrator.eventStore.appendEvent(
        stateStore.getRevision(),
        'HUMAN_OVERRIDE',
        'USER',
        { action: 'clarification', message: clarification }
      );
      console.log(`[Sleekdo] User clarification recorded: "${clarification}"`);
      break;
    }

    case 'replan': {
      const reason = args.slice(1).join(' ') || 'User requested replanning';
      console.log(`[Sleekdo] Requesting replan: ${reason}`);
      const success = await orchestrator.handleRequirementChange(reason);
      if (success) {
        console.log('[Sleekdo] Re-planning complete. Revised plan approved by A3.');
      } else {
        console.log('[Sleekdo] Revised plan was rejected by A3. Check event logs.');
      }
      break;
    }

    case 'override': {
      const taskId = args[1];
      const action = args[2]?.toLowerCase();
      if (!taskId || !['approve', 'reject', 'unblock'].includes(action)) {
        console.error('Usage: sleekdo override <taskId> <approve|reject|unblock>');
        process.exit(1);
      }
      const stateStore = new StateStore(workspaceDir);
      stateStore.updateState((draft) => {
        const task = draft.tasks[taskId];
        if (!task) {
          console.error(`Task ${taskId} not found.`);
          process.exit(1);
        }
        if (action === 'approve') task.status = 'APPROVED';
        else if (action === 'reject') task.status = 'REJECTED';
        else if (action === 'unblock') task.status = 'READY';
        task.updatedAt = Date.now();
      });
      orchestrator.eventStore.appendEvent(
        stateStore.getRevision(),
        'HUMAN_OVERRIDE',
        'USER',
        { taskId, action }
      );
      console.log(`[Sleekdo] Task ${taskId} status overridden to ${action.toUpperCase()} by user.`);
      break;
    }

    default:
      console.log('Usage: sleekdo [--pi|--agy|--claude|pi|agy|claude|init|run|status|verify|clean|inspect|pause|resume|clarify|replan|override]');
  }
}

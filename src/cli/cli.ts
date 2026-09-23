import { Orchestrator } from '../core/orchestrator.js';
import { PiAdapter } from '../adapters/pi-adapter.js';
import { MockAdapter } from '../adapters/mock-adapter.js';
import { loadConfig } from '../config/config.js';
import { StateStore } from '../storage/state-store.js';

export async function runCli(args: string[]): Promise<void> {
  const command = args[0] || 'status';
  const workspaceDir = process.cwd();
  const config = loadConfig(workspaceDir);

  const adapter = config.defaultAdapter === 'mock'
    ? new MockAdapter()
    : new PiAdapter(config.piCliPath);

  const orchestrator = new Orchestrator({
    workspaceDir,
    workerAdapter: adapter,
    plannerAdapter: adapter,
    reviewerAdapter: adapter,
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

    default:
      console.log('Usage: sleekdo [init|run|status|verify|clean|inspect]');
  }
}

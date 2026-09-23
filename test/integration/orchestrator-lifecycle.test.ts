import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Orchestrator } from '../../dist/core/orchestrator.js';
import { MockAdapter } from '../../dist/adapters/mock-adapter.js';

test('Orchestrator: complete lifecycle with recursive planning, A1/A2/A3, and final verification', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sleekdo-orchestrator-test-'));
  try {
    const workerAdapter = new MockAdapter();
    const plannerAdapter = new MockAdapter();
    const reviewerAdapter = new MockAdapter();

    // 1. Initial planning: A2 returns 1 task
    plannerAdapter.addHandler(async (_input, _session, emit) => {
      const plan = {
        requirements: [
          { id: 'req_001', description: 'Core math utility', verificationCriteria: ['add function works'] },
        ],
        tasks: [
          {
            id: 'task_001',
            title: 'Implement add function',
            objective: 'Create add.ts with export function add(a, b)',
            requirements: ['req_001'],
            acceptanceCriteria: ['add(1, 2) === 3', 'Tests exist and pass'],
            dependencies: [],
            type: 'task',
          },
        ],
      };
      emit({ type: 'message', timestamp: Date.now(), data: { text: JSON.stringify(plan) } });
    });

    // 2. Plan review: A3 approves initial plan
    reviewerAdapter.addHandler(async (_input, _session, emit) => {
      emit({ type: 'message', timestamp: Date.now(), data: { text: JSON.stringify({ approved: true, reason: 'Valid plan' }) } });
    });

    // 3. A1 executes task_001: writes add.ts
    workerAdapter.addHandler(async (_input, _session, emit) => {
      fs.writeFileSync(path.join(tmpDir, 'add.ts'), 'export function add(a: number, b: number): number { return a + b; }\n');
      emit({
        type: 'tool_call',
        timestamp: Date.now(),
        data: { name: 'write', args: { path: 'add.ts' } },
      });
      emit({
        type: 'message',
        timestamp: Date.now(),
        data: { text: 'Implemented add function in add.ts' },
      });
    });

    // 4. A3 reviews task_001: approves
    reviewerAdapter.addHandler(async (_input, _session, emit) => {
      const review = {
        decision: 'APPROVE',
        summary: 'add.ts implemented cleanly and verified',
        requirementCompliance: true,
        acceptanceCriteriaMet: true,
        implementationExists: true,
        testsPass: true,
        noRegressions: true,
        scopeControlled: true,
        noDeadCodeIntroduced: true,
        blockingIssues: [],
      };
      emit({ type: 'message', timestamp: Date.now(), data: { text: JSON.stringify(review) } });
    });

    // 5. A2 recursive reassessment: discovers newly required task_002 (subtract function)
    plannerAdapter.addHandler(async (_input, _session, emit) => {
      const reassessment = {
        remainingRequirements: [],
        newlyDiscoveredRequirements: [
          { id: 'req_002', description: 'Subtract function', verificationCriteria: ['sub function works'] },
        ],
        newTasks: [
          {
            id: 'task_002',
            title: 'Implement subtract function',
            objective: 'Create sub.ts',
            requirements: ['req_002'],
            acceptanceCriteria: ['sub(5, 3) === 2'],
            dependencies: [],
            type: 'task',
          },
        ],
        obsoleteTaskIds: [],
        defects: [],
        isComplete: false,
        reason: 'Discovered subtract requirement needed to complete project',
      };
      emit({ type: 'message', timestamp: Date.now(), data: { text: JSON.stringify(reassessment) } });
    });

    // 6. A1 executes task_002: writes sub.ts
    workerAdapter.addHandler(async (_input, _session, emit) => {
      fs.writeFileSync(path.join(tmpDir, 'sub.ts'), 'export function sub(a: number, b: number): number { return a - b; }\n');
      emit({
        type: 'message',
        timestamp: Date.now(),
        data: { text: 'Implemented subtract function in sub.ts' },
      });
    });

    // 7. A3 reviews task_002: approves
    reviewerAdapter.addHandler(async (_input, _session, emit) => {
      const review = {
        decision: 'APPROVE',
        summary: 'sub.ts implemented and verified',
        requirementCompliance: true,
        acceptanceCriteriaMet: true,
        implementationExists: true,
        testsPass: true,
        noRegressions: true,
        scopeControlled: true,
        noDeadCodeIntroduced: true,
        blockingIssues: [],
      };
      emit({ type: 'message', timestamp: Date.now(), data: { text: JSON.stringify(review) } });
    });

    // 8. A2 final reassessment: all work completed
    plannerAdapter.addHandler(async (_input, _session, emit) => {
      const reassessment = {
        remainingRequirements: [],
        newlyDiscoveredRequirements: [],
        newTasks: [],
        obsoleteTaskIds: [],
        defects: [],
        isComplete: true,
        reason: 'All math utilities implemented and verified',
      };
      emit({ type: 'message', timestamp: Date.now(), data: { text: JSON.stringify(reassessment) } });
    });

    const orchestrator = new Orchestrator({
      workspaceDir: tmpDir,
      workerAdapter,
      plannerAdapter,
      reviewerAdapter,
    });

    await orchestrator.initialize('Build complete math utility library');
    assert.equal(orchestrator.stateStore.getState().status, 'EXECUTING');

    const completed = await orchestrator.runToCompletion();
    assert.equal(completed, true);

    const finalState = orchestrator.stateStore.getState();
    assert.equal(finalState.status, 'COMPLETE');
    assert.equal(finalState.tasks['task_001'].status, 'APPROVED');
    assert.equal(finalState.tasks['task_002'].status, 'APPROVED');
    assert.equal(finalState.requirements['req_001'].status, 'satisfied');
    assert.equal(finalState.requirements['req_002'].status, 'satisfied');

    // Verify files actually exist on disk
    assert.ok(fs.existsSync(path.join(tmpDir, 'add.ts')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'sub.ts')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Orchestrator: requirement changes mid-development triggers impact analysis, plan versioning, and A3 re-verification (PRD Sections 78 & 79)', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sleekdo-replan-test-'));
  try {
    const workerAdapter = new MockAdapter();
    const plannerAdapter = new MockAdapter();
    const reviewerAdapter = new MockAdapter();

    // 1. Initial plan: A2 returns 1 task
    plannerAdapter.addHandler(async (_input, _session, emit) => {
      const plan = {
        requirements: [{ id: 'req_001', description: 'Basic add', verificationCriteria: ['add works'] }],
        tasks: [
          {
            id: 'task_001',
            title: 'Implement add',
            objective: 'Create add.ts',
            requirements: ['req_001'],
            acceptanceCriteria: ['add(1, 2) === 3'],
            dependencies: [],
            type: 'task',
          },
        ],
      };
      emit({ type: 'message', timestamp: Date.now(), data: { text: JSON.stringify(plan) } });
    });

    // 2. Initial plan review: A3 approves
    reviewerAdapter.addHandler(async (_input, _session, emit) => {
      emit({ type: 'message', timestamp: Date.now(), data: { text: JSON.stringify({ approved: true, reason: 'Valid' }) } });
    });

    const orchestrator = new Orchestrator({
      workspaceDir: tmpDir,
      workerAdapter,
      plannerAdapter,
      reviewerAdapter,
    });

    await orchestrator.initialize('Build math library');
    assert.equal(orchestrator.stateStore.getState().planVersion, 1);

    // Mid-flight user requirement change:
    // A2 reassessment handler for revised plan
    plannerAdapter.addHandler(async (_input, _session, emit) => {
      const reassessment = {
        remainingRequirements: [],
        newlyDiscoveredRequirements: [
          { id: 'req_002', description: 'Advanced multiply', verificationCriteria: ['multiply works'] },
        ],
        newTasks: [
          {
            id: 'task_002',
            title: 'Implement multiply',
            objective: 'Create mul.ts',
            requirements: ['req_002'],
            acceptanceCriteria: ['mul(2, 3) === 6'],
            dependencies: [],
            type: 'task',
          },
        ],
        obsoleteTaskIds: ['task_001'],
        defects: [],
        isComplete: false,
        reason: 'User requested multiply instead of add',
      };
      emit({ type: 'message', timestamp: Date.now(), data: { text: JSON.stringify(reassessment) } });
    });

    // A3 plan review handler for revised plan
    reviewerAdapter.addHandler(async (_input, _session, emit) => {
      emit({ type: 'message', timestamp: Date.now(), data: { text: JSON.stringify({ approved: true, reason: 'Revised plan viable' }) } });
    });

    const replanSuccess = await orchestrator.handleRequirementChange('Pivot to multiply utility');
    assert.equal(replanSuccess, true);

    const updatedState = orchestrator.stateStore.getState();
    assert.equal(updatedState.originalRequest, 'Pivot to multiply utility');
    assert.equal(updatedState.planVersion, 2);
    assert.equal(updatedState.tasks['task_001'].status, 'REJECTED'); // Obsolete task marked
    assert.ok(updatedState.tasks['task_002'], 'New task added');
    assert.equal(updatedState.tasks['task_002'].status, 'READY');
    assert.ok(updatedState.requirements['req_002'], 'New requirement added');
    assert.equal(updatedState.planHistory.length, 2);
    assert.equal(updatedState.planHistory[1].version, 2);

    // Verify versioned plan artifact was saved on disk
    const planArtifact = orchestrator.artifactStore.getPlan(2);
    assert.ok(planArtifact, 'plan_v2.json artifact must be persisted');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

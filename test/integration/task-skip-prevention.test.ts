import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Orchestrator } from '../../dist/core/orchestrator.js';
import { MockAdapter } from '../../dist/adapters/mock-adapter.js';
import { TaskStateMachine } from '../../dist/core/state-machine.js';

test('Orchestrator: prevents task skipping and enforces dependency gates', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sleekdo-skip-test-'));
  try {
    const workerAdapter = new MockAdapter();
    const plannerAdapter = new MockAdapter();
    const reviewerAdapter = new MockAdapter();

    plannerAdapter.addHandler(async (_i, _s, emit) => {
      emit({
        type: 'message',
        timestamp: Date.now(),
        data: {
          text: JSON.stringify({
            requirements: [{ id: 'req_1', description: 'Step by step', verificationCriteria: ['Done'] }],
            tasks: [
              {
                id: 'task_001',
                title: 'Step 1',
                objective: 'Step 1',
                requirements: ['req_1'],
                acceptanceCriteria: ['Step 1 done'],
                dependencies: [],
                type: 'task',
              },
              {
                id: 'task_002',
                title: 'Step 2 (depends on Step 1)',
                objective: 'Step 2',
                requirements: ['req_1'],
                acceptanceCriteria: ['Step 2 done'],
                dependencies: ['task_001'], // Depends on task_001!
                type: 'task',
              },
            ],
          }),
        },
      });
    });

    reviewerAdapter.addHandler(async (_i, _s, emit) => {
      emit({ type: 'message', timestamp: Date.now(), data: { text: JSON.stringify({ approved: true, reason: 'ok' }) } });
    });

    const orchestrator = new Orchestrator({
      workspaceDir: tmpDir,
      workerAdapter,
      plannerAdapter,
      reviewerAdapter,
    });

    await orchestrator.initialize('Sequential tasks');
    const state = orchestrator.stateStore.getState();

    // Invariant check: task_002 must be PENDING because task_001 is not approved
    assert.equal(state.tasks['task_001'].status, 'READY');
    assert.equal(state.tasks['task_002'].status, 'PENDING');

    // Attempting to advance task_002 illegally must throw DependencyNotMetError
    assert.throws(() => {
      TaskStateMachine.transition(state.tasks['task_002'], 'IN_PROGRESS', state.tasks);
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Orchestrator: repeated rejection escalates to active investigation', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sleekdo-escalation-test-'));
  try {
    const workerAdapter = new MockAdapter();
    const plannerAdapter = new MockAdapter();
    const reviewerAdapter = new MockAdapter();

    plannerAdapter.addHandler(async (_i, _s, emit) => {
      emit({
        type: 'message',
        timestamp: Date.now(),
        data: {
          text: JSON.stringify({
            requirements: [{ id: 'req_1', description: 'Flaky task', verificationCriteria: ['Never passes'] }],
            tasks: [
              {
                id: 'task_failing',
                title: 'Failing task',
                objective: 'Fails repeatedly',
                requirements: ['req_1'],
                acceptanceCriteria: ['Passes'],
                dependencies: [],
                type: 'task',
              },
            ],
          }),
        },
      });
    });

    reviewerAdapter.addHandler(async (_i, _s, emit) => {
      emit({ type: 'message', timestamp: Date.now(), data: { text: JSON.stringify({ approved: true, reason: 'ok' }) } });
    });

    // Rejection repeated 3 times
    const rejectionResponse = JSON.stringify({
      decision: 'REJECT',
      summary: 'Persistent defect',
      requirementCompliance: false,
      acceptanceCriteriaMet: false,
      implementationExists: true,
      testsPass: false,
      noRegressions: true,
      scopeControlled: true,
      noDeadCodeIntroduced: true,
      blockingIssues: [
        {
          description: 'Cannot satisfy condition',
          evidence: 'test.ts',
          affectedRequirement: 'req_1',
          requiredFix: 'Fix it',
          verification: 'Test',
        },
      ],
    });

    reviewerAdapter.addHandler(async (_i, _s, emit) => emit({ type: 'message', timestamp: Date.now(), data: { text: rejectionResponse } }));
    reviewerAdapter.addHandler(async (_i, _s, emit) => emit({ type: 'message', timestamp: Date.now(), data: { text: rejectionResponse } }));
    reviewerAdapter.addHandler(async (_i, _s, emit) => emit({ type: 'message', timestamp: Date.now(), data: { text: rejectionResponse } }));

    const orchestrator = new Orchestrator({
      workspaceDir: tmpDir,
      workerAdapter,
      plannerAdapter,
      reviewerAdapter,
      maxConsecutiveRejections: 3,
    });

    await orchestrator.initialize('Escalation test');
    await orchestrator.runToCompletion();

    // Verify investigation was launched
    const investigations = orchestrator.investigationSystem.getActiveInvestigations();
    assert.ok(investigations.length > 0, 'Active investigation should be launched upon reaching max consecutive rejections');
    assert.equal(investigations[0].taskId, 'task_failing');
    assert.ok(investigations[0].hypotheses.length >= 3);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

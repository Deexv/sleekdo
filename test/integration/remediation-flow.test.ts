import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Orchestrator } from '../../dist/core/orchestrator.js';
import { MockAdapter } from '../../dist/adapters/mock-adapter.js';

test('Orchestrator: rejection, remediation requirements, and eventual approval', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sleekdo-remediation-test-'));
  try {
    const workerAdapter = new MockAdapter();
    const plannerAdapter = new MockAdapter();
    const reviewerAdapter = new MockAdapter();

    // 1. Initial plan
    plannerAdapter.addHandler(async (_i, _s, emit) => {
      emit({
        type: 'message',
        timestamp: Date.now(),
        data: {
          text: JSON.stringify({
            requirements: [{ id: 'req_1', description: 'Validate auth', verificationCriteria: ['Rejects invalid'] }],
            tasks: [
              {
                id: 'task_001',
                title: 'Implement auth token validation',
                objective: 'Reject expired tokens',
                requirements: ['req_1'],
                acceptanceCriteria: ['Expired tokens return false'],
                dependencies: [],
                type: 'task',
              },
            ],
          }),
        },
      });
    });

    // 2. Plan review approved
    reviewerAdapter.addHandler(async (_i, _s, emit) => {
      emit({ type: 'message', timestamp: Date.now(), data: { text: JSON.stringify({ approved: true, reason: 'ok' }) } });
    });

    // 3. Worker initial buggy implementation
    workerAdapter.addHandler(async (_i, _s, emit) => {
      fs.writeFileSync(path.join(tmpDir, 'auth.ts'), 'export function isValid(exp: number) { return true; }\n');
      emit({ type: 'message', timestamp: Date.now(), data: { text: 'Implemented token check' } });
    });

    // 4. Reviewer REJECTS with concrete evidence
    reviewerAdapter.addHandler(async (_i, _s, emit) => {
      emit({
        type: 'message',
        timestamp: Date.now(),
        data: {
          text: JSON.stringify({
            decision: 'REJECT',
            summary: 'Expired tokens are accepted unconditionally',
            requirementCompliance: false,
            acceptanceCriteriaMet: false,
            implementationExists: true,
            testsPass: false,
            noRegressions: true,
            scopeControlled: true,
            noDeadCodeIntroduced: true,
            blockingIssues: [
              {
                description: 'isValid always returns true',
                evidence: 'auth.ts:1',
                affectedRequirement: 'req_1',
                requiredFix: 'Check exp > Date.now()',
                verification: 'Verify isValid returns false when exp is past',
              },
            ],
          }),
        },
      });
    });

    // 5. Worker receives remediation and fixes bug
    workerAdapter.addHandler(async (input, _s, emit) => {
      // Verify worker prompt received remediation requirements!
      assert.ok(input.includes('REMEDIATION REQUIREMENTS'), 'Worker prompt must contain remediation requirements');
      assert.ok(input.includes('isValid always returns true'), 'Worker prompt must mention the defect');

      fs.writeFileSync(path.join(tmpDir, 'auth.ts'), 'export function isValid(exp: number) { return exp > Date.now(); }\n');
      emit({ type: 'message', timestamp: Date.now(), data: { text: 'Fixed token expiry check' } });
    });

    // 6. Reviewer APPROVES fixed implementation
    reviewerAdapter.addHandler(async (_i, _s, emit) => {
      emit({
        type: 'message',
        timestamp: Date.now(),
        data: {
          text: JSON.stringify({
            decision: 'APPROVE',
            summary: 'Token validation now correctly checks expiration timestamp',
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

    // 7. Planner reassessment: complete
    plannerAdapter.addHandler(async (_i, _s, emit) => {
      emit({
        type: 'message',
        timestamp: Date.now(),
        data: {
          text: JSON.stringify({
            remainingRequirements: [],
            newlyDiscoveredRequirements: [],
            newTasks: [],
            obsoleteTaskIds: [],
            defects: [],
            isComplete: true,
            reason: 'Done',
          }),
        },
      });
    });

    const orchestrator = new Orchestrator({
      workspaceDir: tmpDir,
      workerAdapter,
      plannerAdapter,
      reviewerAdapter,
    });

    await orchestrator.initialize('Fix auth');
    const done = await orchestrator.runToCompletion();

    assert.equal(done, true);
    const task = orchestrator.stateStore.getTask('task_001');
    assert.equal(task?.status, 'APPROVED');
    assert.equal(task?.rejectionHistory?.length, 1);
    assert.equal(task?.rejectionHistory?.[0].problem, 'isValid always returns true');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

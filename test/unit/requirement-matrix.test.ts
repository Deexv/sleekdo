import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { StateStore } from '../../dist/storage/state-store.js';
import { RequirementMatrix } from '../../dist/core/requirement-matrix.js';

test('RequirementMatrix: tracks coverage, linked tasks, and orphaned requirements', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sleekdo-req-test-'));
  try {
    const stateStore = new StateStore(tmpDir);
    const matrix = new RequirementMatrix(stateStore);

    // Register requirements
    matrix.registerRequirement({
      id: 'req_001',
      description: 'Users can authenticate',
      source: 'user_request',
      taskIds: [],
      verificationCriteria: ['Auth endpoint returns 200 on valid credentials'],
    });

    matrix.registerRequirement({
      id: 'req_002',
      description: 'Users can logout',
      source: 'user_request',
      taskIds: [],
      verificationCriteria: ['Session terminated'],
    });

    let cov = matrix.evaluateCoverage();
    assert.equal(cov.total, 2);
    assert.equal(cov.orphaned.length, 2);
    assert.equal(cov.allSatisfied, false);

    // Add tasks to state and link
    stateStore.updateState((draft) => {
      draft.tasks['task_auth'] = {
        id: 'task_auth',
        parentId: null,
        type: 'task',
        title: 'Auth',
        objective: 'Objective',
        requirements: ['req_001'],
        acceptanceCriteria: ['Validates'],
        dependencies: [],
        status: 'APPROVED',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      draft.tasks['task_logout'] = {
        id: 'task_logout',
        parentId: null,
        type: 'task',
        title: 'Logout',
        objective: 'Objective',
        requirements: ['req_002'],
        acceptanceCriteria: ['Logs out'],
        dependencies: [],
        status: 'IN_PROGRESS',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    });

    matrix.linkTaskToRequirement('req_001', 'task_auth');
    matrix.linkTaskToRequirement('req_002', 'task_logout');

    cov = matrix.evaluateCoverage();
    assert.equal(cov.orphaned.length, 0);
    assert.equal(cov.satisfied, 1);
    assert.equal(cov.inProgress, 1);
    assert.equal(cov.allSatisfied, false);

    // Complete second task
    stateStore.updateState((draft) => {
      draft.tasks['task_logout'].status = 'APPROVED';
    });
    matrix.updateRequirementStatus('req_002', 'satisfied');

    cov = matrix.evaluateCoverage();
    assert.equal(cov.satisfied, 2);
    assert.equal(cov.allSatisfied, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

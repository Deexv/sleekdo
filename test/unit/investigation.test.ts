import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { StateStore } from '../../dist/storage/state-store.js';
import { InvestigationSystem } from '../../dist/core/investigation-system.js';

test('InvestigationSystem: binary-search debugging hypothesis elimination and mechanism confirmation', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sleekdo-inv-test-'));
  try {
    const stateStore = new StateStore(tmpDir);
    const system = new InvestigationSystem(stateStore);

    // Create investigation
    const inv = system.createInvestigation(
      'task_031',
      {
        expected: 'Request succeeds with 200',
        actual: 'Request throws 500 error',
        scenario: 'User logs in with expired token',
      },
      ['Database connection error', 'Token expiry validation bypass', 'Middleware crash']
    );

    assert.equal(inv.status, 'active');
    assert.equal(inv.hypotheses.length, 3);
    assert.equal(inv.hypotheses[0].status, 'untested');

    // Eliminate H1 via diagnostic evidence
    system.recordDiagnosticStep(inv.id, 'H1', 'eliminated', 'Database health check passes');
    let state = stateStore.getInvestigation(inv.id);
    assert.equal(state?.hypotheses[0].status, 'eliminated');

    // Eliminate H3
    system.recordDiagnosticStep(inv.id, 'H3', 'eliminated', 'Middleware logs show clean pass');
    state = stateStore.getInvestigation(inv.id);
    assert.equal(state?.hypotheses[2].status, 'eliminated');

    // Confirm surviving mechanism H2
    system.recordDiagnosticStep(inv.id, 'H2', 'surviving', 'Line 51 accepts exp < now');
    system.confirmMechanism(
      inv.id,
      'Expired tokens are accepted without timestamp comparison in verifyToken()',
      ['src/auth/token.ts:51', 'unit test failure on expired token'],
      {
        description: 'Add timestamp check in verifyToken',
        smallestScopeFiles: ['src/auth/token.ts'],
        regressionTestPlan: 'Add expired token regression test',
      }
    );

    state = stateStore.getInvestigation(inv.id);
    assert.equal(state?.status, 'confirmed');
    assert.ok(state?.confirmedMechanism);
    assert.equal(state?.fixPlan?.smallestScopeFiles[0], 'src/auth/token.ts');

    // Resolve
    system.resolveInvestigation(inv.id);
    state = stateStore.getInvestigation(inv.id);
    assert.equal(state?.status, 'resolved');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

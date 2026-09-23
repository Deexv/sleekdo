import test from 'node:test';
import assert from 'node:assert/strict';
import { SchemaValidator } from '../../dist/validation/schemas.js';

test('SchemaValidator: validates initial plan and catches missing criteria', () => {
  const validPlan = {
    requirements: [{ id: 'req_1', description: 'Desc', verificationCriteria: ['C1'] }],
    tasks: [
      {
        id: 't1',
        title: 'Task 1',
        objective: 'Obj',
        requirements: ['req_1'],
        acceptanceCriteria: ['Pass test'],
        dependencies: [],
      },
    ],
  };

  const resValid = SchemaValidator.validateInitialPlan(validPlan);
  assert.equal(resValid.valid, true);

  const invalidPlan = {
    requirements: [],
    tasks: [
      {
        id: 't1',
        title: 'Task 1',
        objective: 'Obj',
        requirements: [],
        acceptanceCriteria: [], // Missing criteria!
        dependencies: [],
      },
    ],
  };

  const resInvalid = SchemaValidator.validateInitialPlan(invalidPlan);
  assert.equal(resInvalid.valid, false);
  assert.ok(resInvalid.errors.some((e) => e.includes('acceptanceCriteria')));
});

test('SchemaValidator: validates review decisions and mandates concrete evidence on rejection', () => {
  const validApprove = {
    decision: 'APPROVE',
    summary: 'Looks great and all tests pass',
    requirementCompliance: true,
    acceptanceCriteriaMet: true,
    implementationExists: true,
    testsPass: true,
    noRegressions: true,
    scopeControlled: true,
    noDeadCodeIntroduced: true,
    blockingIssues: [],
  };

  const resApprove = SchemaValidator.validateReview(validApprove);
  assert.equal(resApprove.valid, true);

  // Vague rejection without blocking issues/evidence is invalid per PRD Section 24
  const vagueReject = {
    decision: 'REJECT',
    summary: 'The code is not good',
    requirementCompliance: false,
    acceptanceCriteriaMet: false,
    implementationExists: true,
    testsPass: false,
    noRegressions: true,
    scopeControlled: true,
    noDeadCodeIntroduced: true,
    blockingIssues: [], // empty blocking issues!
  };

  const resVague = SchemaValidator.validateReview(vagueReject);
  assert.equal(resVague.valid, false);
  assert.ok(resVague.errors.some((e) => e.includes('blocking issue with concrete evidence')));

  // Concrete rejection
  const concreteReject = {
    ...vagueReject,
    blockingIssues: [
      {
        description: 'Expired tokens accepted',
        evidence: 'src/auth/token.ts:51',
        affectedRequirement: 'req_001',
        requiredFix: 'Reject expired tokens',
        verification: 'Add and pass expired-token test',
      },
    ],
  };

  const resConcrete = SchemaValidator.validateReview(concreteReject);
  assert.equal(resConcrete.valid, true);
});

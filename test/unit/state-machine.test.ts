import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskStateMachine, InvalidStateTransitionError, DependencyNotMetError } from '../../dist/core/state-machine.js';
import type { Task, TaskId } from '../../dist/types/domain.js';

function makeTask(id: TaskId, status: Task['status'], dependencies: TaskId[] = []): Task {
  return {
    id,
    parentId: null,
    type: 'task',
    title: `Task ${id}`,
    objective: 'Test objective',
    requirements: ['req_1'],
    acceptanceCriteria: ['Criteria 1'],
    dependencies,
    status,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

test('TaskStateMachine: allows valid transitions: PENDING -> READY -> IN_PROGRESS -> AWAITING_REVIEW -> APPROVED', () => {
  const tasks: Record<TaskId, Task> = {};
  const task = makeTask('t1', 'PENDING');
  tasks['t1'] = task;

  TaskStateMachine.transition(task, 'READY', tasks);
  assert.equal(task.status, 'READY');

  TaskStateMachine.transition(task, 'IN_PROGRESS', tasks);
  assert.equal(task.status, 'IN_PROGRESS');

  TaskStateMachine.transition(task, 'AWAITING_REVIEW', tasks);
  assert.equal(task.status, 'AWAITING_REVIEW');

  TaskStateMachine.transition(task, 'APPROVED', tasks);
  assert.equal(task.status, 'APPROVED');
  assert.ok(task.approvedAt);
});

test('TaskStateMachine: rejected flow: AWAITING_REVIEW -> REJECTED -> REMEDIATION_REQUIRED -> IN_PROGRESS', () => {
  const tasks: Record<TaskId, Task> = {};
  const task = makeTask('t1', 'AWAITING_REVIEW');
  tasks['t1'] = task;

  TaskStateMachine.transition(task, 'REJECTED', tasks);
  assert.equal(task.status, 'REJECTED');

  TaskStateMachine.transition(task, 'REMEDIATION_REQUIRED', tasks);
  assert.equal(task.status, 'REMEDIATION_REQUIRED');

  TaskStateMachine.transition(task, 'IN_PROGRESS', tasks);
  assert.equal(task.status, 'IN_PROGRESS');
});

test('TaskStateMachine: prohibits illegal transitions and task skips', () => {
  const tasks: Record<TaskId, Task> = {};
  const task = makeTask('t1', 'PENDING');
  tasks['t1'] = task;

  // Cannot jump from PENDING directly to APPROVED
  assert.throws(() => {
    TaskStateMachine.transition(task, 'APPROVED', tasks);
  }, InvalidStateTransitionError);

  // Cannot jump from IN_PROGRESS directly to APPROVED (must pass review)
  task.status = 'IN_PROGRESS';
  assert.throws(() => {
    TaskStateMachine.transition(task, 'APPROVED', tasks);
  }, InvalidStateTransitionError);

  // APPROVED is terminal
  task.status = 'APPROVED';
  assert.throws(() => {
    TaskStateMachine.transition(task, 'IN_PROGRESS', tasks);
  }, InvalidStateTransitionError);
});

test('TaskStateMachine: enforces unsatisfied dependencies block READY / IN_PROGRESS', () => {
  const tasks: Record<TaskId, Task> = {};
  const dep = makeTask('dep1', 'IN_PROGRESS');
  const task = makeTask('t1', 'PENDING', ['dep1']);
  tasks['dep1'] = dep;
  tasks['t1'] = task;

  assert.throws(() => {
    TaskStateMachine.transition(task, 'READY', tasks);
  }, DependencyNotMetError);

  // Approve dependency, now should succeed
  dep.status = 'APPROVED';
  TaskStateMachine.transition(task, 'READY', tasks);
  assert.equal(task.status, 'READY');
});

test('TaskStateMachine: parent task cannot be APPROVED until all subtasks are APPROVED', () => {
  const tasks: Record<TaskId, Task> = {};
  const sub1 = makeTask('sub1', 'APPROVED');
  const sub2 = makeTask('sub2', 'IN_PROGRESS');
  const parent = makeTask('parent', 'AWAITING_REVIEW');
  parent.subtaskIds = ['sub1', 'sub2'];

  tasks['sub1'] = sub1;
  tasks['sub2'] = sub2;
  tasks['parent'] = parent;

  assert.throws(() => {
    TaskStateMachine.transition(parent, 'APPROVED', tasks);
  }, InvalidStateTransitionError);

  sub2.status = 'APPROVED';
  TaskStateMachine.transition(parent, 'APPROVED', tasks);
  assert.equal(parent.status, 'APPROVED');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { StateStore } from '../../dist/storage/state-store.js';
import { EventStore } from '../../dist/storage/event-store.js';
import { WorkspaceLock } from '../../dist/core/workspace-lock.js';
import { SnapshotEngine } from '../../dist/evidence/snapshot-engine.js';
import { FilesystemEngine } from '../../dist/evidence/filesystem-engine.js';
import { GitEngine } from '../../dist/evidence/git-engine.js';
import { CrashRecovery } from '../../dist/core/crash-recovery.js';

test('CrashRecovery: recovers interrupted IN_PROGRESS task to READY and heals stale lock', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sleekdo-crash-test-'));
  try {
    const stateStore = new StateStore(tmpDir);
    const eventStore = new EventStore(tmpDir);
    const lock = new WorkspaceLock(tmpDir);
    const fsEngine = new FilesystemEngine(tmpDir);
    const gitEngine = new GitEngine(tmpDir);
    const snapshotEngine = new SnapshotEngine(fsEngine, gitEngine);

    // Setup active task in IN_PROGRESS
    stateStore.updateState((draft) => {
      draft.currentTaskId = 'task_100';
      draft.tasks['task_100'] = {
        id: 'task_100',
        parentId: null,
        type: 'task',
        title: 'Task interrupted by crash',
        objective: 'Objective',
        requirements: ['req_1'],
        acceptanceCriteria: ['Criteria'],
        dependencies: [],
        status: 'IN_PROGRESS',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    });

    // Simulate stale lock from crash
    lock.acquire('A1', 'Crashed during work');

    const recovery = new CrashRecovery(stateStore, eventStore, lock, snapshotEngine);
    const report = recovery.recover();

    assert.equal(report.recovered, true);
    assert.equal(report.activeTaskId, 'task_100');
    assert.equal(report.previousTaskStatus, 'IN_PROGRESS');
    assert.equal(report.unlockedWorkspace, true);

    // Verify task state was safely converted to READY (not assumed completed)
    const task = stateStore.getTask('task_100');
    assert.ok(task);
    assert.equal(task.status, 'READY');
    assert.equal(lock.isLocked(), false);

    // Verify recovery event was recorded in append-only log
    const events = eventStore.getEvents({ type: 'CRASH_RECOVERED' });
    assert.equal(events.length, 1);
    assert.equal(events[0].taskId, 'task_100');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

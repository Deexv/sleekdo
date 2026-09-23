import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { WorkspaceLock } from '../../dist/core/workspace-lock.js';

test('WorkspaceLock: acquires and releases lease cleanly', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sleekdo-lock-test-'));
  try {
    const lock = new WorkspaceLock(tmpDir);
    assert.equal(lock.isLocked(), false);

    const acquired = lock.acquire('A3', 'Review freeze');
    assert.equal(acquired, true);
    assert.equal(lock.isLocked(), true);

    const info = lock.getLockInfo();
    assert.ok(info);
    assert.equal(info.lockedBy, 'A3');
    assert.equal(info.pid, process.pid);

    // Second lock attempt with same PID/owner succeeds (idempotent)
    assert.equal(lock.acquire('A3', 'Same review'), true);

    lock.unlock();
    assert.equal(lock.isLocked(), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('WorkspaceLock: self-heals stale locks from dead PIDs', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sleekdo-stale-lock-test-'));
  try {
    const lock = new WorkspaceLock(tmpDir);
    const lockFilePath = path.join(tmpDir, '.sleekdo', 'locks', 'workspace.lock');
    fs.mkdirSync(path.dirname(lockFilePath), { recursive: true });

    // Write a lock with a PID that definitely does not exist (e.g. 999999)
    const deadLock = {
      locked: true,
      lockedBy: 'A1',
      lockedAt: Date.now() - 100000,
      pid: 999999,
      reason: 'Crashed worker',
    };
    fs.writeFileSync(lockFilePath, JSON.stringify(deadLock));

    // isLocked should detect dead process, self-heal, and return false
    assert.equal(lock.isLocked(), false);
    assert.equal(fs.existsSync(lockFilePath), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

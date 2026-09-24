import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  HashlineEngine,
  computeSnapshotTag,
  parseHashlinePatch,
  normalizeContent,
} from '../../dist/tools/hashline/index.js';

describe('Hashline Subsystem (Sections 15, 16, 17, 41)', () => {
  let tmpDir: string;
  let engine: HashlineEngine;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sleekdo-hashline-test-'));
    engine = new HashlineEngine(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('computes stable 4-hex snapshot tags and normalizes content', () => {
    const content = 'function hello() {\n  return "world";\n}\n';
    const tag1 = computeSnapshotTag(content);
    const tag2 = computeSnapshotTag(content.replace(/\n/g, '\r\n')); // CRLF equivalence
    assert.strictEqual(tag1.length, 4);
    assert.strictEqual(tag1, tag2);
  });

  it('applies a single-file hashline replace patch successfully', async () => {
    const filePath = path.join(tmpDir, 'sample.ts');
    const initialContent = 'line 1\nline 2\nline 3\nline 4\n';
    await fs.writeFile(filePath, initialContent, 'utf8');

    const tag = computeSnapshotTag(initialContent);
    const patch = `*** Begin Patch
[sample.ts#${tag}]
PUT 2.=3:
+replaced line 2
+replaced line 3
*** End Patch`;

    const result = await engine.applyPatch(patch);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.atomicityPreserved, true);

    const updated = await fs.readFile(filePath, 'utf8');
    assert.strictEqual(updated, 'line 1\nreplaced line 2\nreplaced line 3\nline 4\n');
  });

  it('rejects stale edits when file has diverged (Section 16 & 41)', async () => {
    const filePath = path.join(tmpDir, 'stale.ts');
    const initialContent = 'const a = 1;\nconst b = 2;\n';
    await fs.writeFile(filePath, initialContent, 'utf8');

    const originalTag = computeSnapshotTag(initialContent);

    // Concurrently / independently modify the file
    await fs.writeFile(filePath, 'const a = 100;\nconst b = 2;\n', 'utf8');

    // Attempt to apply patch with originalTag
    const patch = `*** Begin Patch
[stale.ts#${originalTag}]
PUT 2.=2:
+const b = 200;
*** End Patch`;

    const result = await engine.applyPatch(patch);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.staleDetected, true);
    assert.ok(result.error?.includes('Stale anchor detected'));

    // Verify file content was not corrupted
    const content = await fs.readFile(filePath, 'utf8');
    assert.strictEqual(content, 'const a = 100;\nconst b = 2;\n');
  });

  it('preserves multi-section atomicity: all or nothing (Section 16)', async () => {
    const file1 = path.join(tmpDir, 'file1.txt');
    const file2 = path.join(tmpDir, 'file2.txt');

    await fs.writeFile(file1, 'valid file 1\n', 'utf8');
    await fs.writeFile(file2, 'valid file 2\n', 'utf8');

    const tag1 = computeSnapshotTag('valid file 1\n');
    const wrongTag = 'dead'; // intentionally stale / invalid tag for file 2

    const multiPatch = `*** Begin Patch
[file1.txt#${tag1}]
PUT 1.=1:
+modified file 1
[file2.txt#${wrongTag}]
PUT 1.=1:
+modified file 2
*** End Patch`;

    const result = await engine.applyPatch(multiPatch);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.atomicityPreserved, true);

    // Verify file 1 was NOT modified even though section 1 was valid!
    const c1 = await fs.readFile(file1, 'utf8');
    assert.strictEqual(c1, 'valid file 1\n');

    const c2 = await fs.readFile(file2, 'utf8');
    assert.strictEqual(c2, 'valid file 2\n');
  });

  it('supports insert before, insert after, and append operations', async () => {
    const file = path.join(tmpDir, 'ops.txt');
    await fs.writeFile(file, 'first\nsecond\n', 'utf8');

    const tag = computeSnapshotTag('first\nsecond\n');
    const patch = `*** Begin Patch
[ops.txt#${tag}]
PUT <1:
+header
PUT >1:
+inserted between
PUT >$:
+footer
*** End Patch`;

    const result = await engine.applyPatch(patch);
    assert.strictEqual(result.success, true);

    const updated = await fs.readFile(file, 'utf8');
    assert.strictEqual(updated, 'header\nfirst\ninserted between\nsecond\nfooter\n');
  });

  it('handles CRLF line endings and UTF-8 BOM cleanly (Section 41)', async () => {
    const file = path.join(tmpDir, 'crlf.txt');
    const crlfContent = '\ufeffalpha\r\nbeta\r\n'; // BOM + CRLF
    await fs.writeFile(file, crlfContent, 'utf8');

    const tag = computeSnapshotTag(crlfContent);
    const patch = `*** Begin Patch
[crlf.txt#${tag}]
PUT 2.=2:
+gamma
*** End Patch`;

    const result = await engine.applyPatch(patch);
    assert.strictEqual(result.success, true);

    const updated = await fs.readFile(file, 'utf8');
    assert.strictEqual(updated, '\ufeffalpha\r\ngamma\r\n');
  });
});

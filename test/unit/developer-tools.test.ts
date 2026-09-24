import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { globFiles, grepSearch, structuredRead, parseAstSymbols } from '../../dist/tools/search/index.js';
import { PersistentProcessManager } from '../../dist/tools/process/process-manager.js';
import { ContentAddressedBlobStore } from '../../dist/storage/blob-store.js';

describe('Developer Tooling Subsystem (Sections 18, 19, 21)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sleekdo-devtool-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('globFiles finds files matching pattern while respecting default ignores', async () => {
    await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });

    await fs.writeFile(path.join(tmpDir, 'src', 'main.ts'), 'export const x = 1;');
    await fs.writeFile(path.join(tmpDir, 'src', 'util.js'), 'export const y = 2;');
    await fs.writeFile(path.join(tmpDir, 'node_modules', 'pkg', 'ignored.ts'), 'secret');

    const tsFiles = await globFiles(tmpDir, '*.ts');
    assert.strictEqual(tsFiles.length, 1);
    assert.strictEqual(tsFiles[0].path.replace(/\\/g, '/'), 'src/main.ts');
  });

  it('grepSearch finds matches with line numbers and context lines', async () => {
    const file = path.join(tmpDir, 'sample.txt');
    const content = ['alpha', 'TARGET_MATCH', 'beta', 'gamma'].join('\n');
    await fs.writeFile(file, content, 'utf8');

    const result = await grepSearch(tmpDir, 'TARGET_MATCH', { contextLines: 1 });
    assert.strictEqual(result.totalMatches, 1);
    assert.strictEqual(result.matches[0].lineNumber, 2);
    assert.deepStrictEqual(result.matches[0].contextBefore, ['alpha']);
    assert.deepStrictEqual(result.matches[0].contextAfter, ['beta']);
  });

  it('structuredRead slices line ranges and extracts outlines', async () => {
    const file = path.join(tmpDir, 'code.ts');
    const content = [
      '// header',
      'export function alpha() { return 1; }',
      'const mid = 2;',
      'export class Beta {}',
    ].join('\n');
    await fs.writeFile(file, content, 'utf8');

    // Slice range L2 to L3
    const sliced = await structuredRead(file, { startLine: 2, endLine: 3 });
    assert.strictEqual(sliced.startLine, 2);
    assert.strictEqual(sliced.endLine, 3);
    assert.strictEqual(sliced.content, 'export function alpha() { return 1; }\nconst mid = 2;');

    // Outline mode
    const outline = await structuredRead(file, { outlineMode: true });
    assert.strictEqual(outline.outline?.length, 2);
    assert.strictEqual(outline.outline[0].text, 'export function alpha() { return 1; }');
    assert.strictEqual(outline.outline[1].text, 'export class Beta {}');
  });

  it('parseAstSymbols accurately extracts functions and classes using TypeScript AST', async () => {
    const file = path.join(tmpDir, 'example.ts');
    const content = `
export interface Config { timeout: number; }
export class OrchestratorService {
  start(): void {}
}
export function initializeSystem(): boolean { return true; }
`;
    await fs.writeFile(file, content, 'utf8');

    const symbols = await parseAstSymbols(file);
    const names = symbols.map((s) => `${s.kind}:${s.name}`);
    assert.ok(names.includes('interface:Config'));
    assert.ok(names.includes('class:OrchestratorService'));
    assert.ok(names.includes('function:initializeSystem'));
  });

  it('PersistentProcessManager manages long-running processes and captures stdout', async () => {
    const procManager = new PersistentProcessManager();
    const cmd = process.execPath;
    const args = ['-e', 'console.log("SLEEKDO_PROC_TEST")'];

    const desc = procManager.spawnProcess('test-proc-1', cmd, args);
    assert.strictEqual(desc.id, 'test-proc-1');
    assert.strictEqual(desc.status, 'running');

    // Wait briefly for process completion
    await new Promise((r) => setTimeout(r, 500));

    const status = procManager.getStatus('test-proc-1');
    assert.ok(status);
    const output = procManager.getOutput('test-proc-1');
    assert.ok(output.includes('SLEEKDO_PROC_TEST'));
  });

  it('ContentAddressedBlobStore deduplicates data and externalizes large payloads (Section 21)', async () => {
    const blobStore = new ContentAddressedBlobStore(tmpDir);

    const smallText = 'Hello Sleekdo';
    const smallResult = await blobStore.externalizeIfLarge(smallText, 50);
    assert.strictEqual(smallResult, smallText); // not externalized

    const largeText = 'X'.repeat(5000);
    const largeResult = await blobStore.externalizeIfLarge(largeText, 100);
    assert.strictEqual(typeof largeResult, 'object');
    assert.ok('_blobRef' in (largeResult as any));

    const retrieved = await blobStore.getText((largeResult as any)._blobRef);
    assert.strictEqual(retrieved, largeText);
  });
});

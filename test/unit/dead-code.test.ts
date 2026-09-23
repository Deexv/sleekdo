import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FilesystemEngine } from '../../dist/evidence/filesystem-engine.js';
import { DeadFileAnalyzer } from '../../dist/analysis/dead-file-analyzer.js';
import { DeadCodeAnalyzer } from '../../dist/analysis/dead-code-analyzer.js';

test('DeadFileAnalyzer: detects CONFIRMED_DEAD vs DYNAMICALLY_REFERENCED files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sleekdo-dead-test-'));
  try {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });

    // File 1: Used module
    fs.writeFileSync(path.join(tmpDir, 'src', 'used.ts'), 'export const used = 42;');

    // File 2: Main entry point importing used.ts
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), "import { used } from './used.js'; console.log(used);");

    // File 3: Obsolete unreferenced file
    fs.writeFileSync(path.join(tmpDir, 'src', 'obsolete.ts'), 'export const dead = true;');

    // File 4: Dynamic reference in config
    fs.writeFileSync(path.join(tmpDir, 'src', 'plugin.ts'), 'export const pluginName = "my-plugin";');
    fs.writeFileSync(path.join(tmpDir, 'src', 'config.ts'), 'export const config = { plugins: ["plugin"] };');

    const fsEngine = new FilesystemEngine(tmpDir);
    const analyzer = new DeadFileAnalyzer(tmpDir, fsEngine);
    const results = analyzer.analyze();

    const obsoleteResult = results.find((r) => r.file.includes('obsolete.ts'));
    assert.ok(obsoleteResult, 'obsolete.ts should be detected as dead');
    assert.equal(obsoleteResult.classification, 'CONFIRMED_DEAD');

    const pluginResult = results.find((r) => r.file.includes('plugin.ts'));
    assert.ok(pluginResult, 'plugin.ts should be flagged');
    assert.equal(pluginResult.classification, 'DYNAMICALLY_REFERENCED');

    const usedResult = results.find((r) => r.file.includes('used.ts'));
    assert.equal(usedResult, undefined, 'used.ts must not be flagged');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

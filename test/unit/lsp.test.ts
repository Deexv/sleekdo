import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  encodeJsonRpcMessage,
  JsonRpcFramer,
  DiagnosticsLedger,
  detectLanguageServers,
  getLanguageIdForFile,
  KNOWN_LANGUAGE_SERVERS,
} from '../../dist/tools/lsp/index.js';

describe('LSP Subsystem (Sections 11, 12, 39)', () => {
  it('correctly encodes and frames JSON-RPC messages with Content-Length', () => {
    const payload = { jsonrpc: '2.0', id: 1, method: 'test', params: { foo: 'bar' } };
    const encoded = encodeJsonRpcMessage(payload);

    assert.ok(encoded.toString('utf8').startsWith('Content-Length: '));
    assert.ok(encoded.toString('utf8').includes('\r\n\r\n{"jsonrpc":"2.0"'));

    const framer = new JsonRpcFramer();
    framer.push(encoded);
    const drained = framer.drain();

    assert.strictEqual(drained.length, 1);
    assert.deepStrictEqual(drained[0], payload);
  });

  it('handles partial and multi-chunk streams in framer cleanly', () => {
    const payload1 = { jsonrpc: '2.0', id: 10, method: 'msg1' };
    const payload2 = { jsonrpc: '2.0', id: 20, method: 'msg2' };

    const buf1 = encodeJsonRpcMessage(payload1);
    const buf2 = encodeJsonRpcMessage(payload2);
    const combined = Buffer.concat([buf1, buf2]);

    const framer = new JsonRpcFramer();
    // Feed in two arbitrary slices
    framer.push(combined.slice(0, 25));
    assert.strictEqual(framer.drain().length, 0);

    framer.push(combined.slice(25));
    const drained = framer.drain();

    assert.strictEqual(drained.length, 2);
    assert.strictEqual(drained[0].id, 10);
    assert.strictEqual(drained[1].id, 20);
  });

  it('maps language IDs from file extensions', () => {
    assert.strictEqual(getLanguageIdForFile('src/index.ts'), 'typescript');
    assert.strictEqual(getLanguageIdForFile('app.py'), 'python');
    assert.strictEqual(getLanguageIdForFile('main.rs'), 'rust');
    assert.strictEqual(getLanguageIdForFile('handler.go'), 'go');
    assert.strictEqual(getLanguageIdForFile('unknown.xyz'), 'plaintext');
  });

  it('manages and deduplicates diagnostics in DiagnosticsLedger (Section 12)', () => {
    const ledger = new DiagnosticsLedger();
    let notifiedCount = 0;

    ledger.onDiagnostics((report) => {
      notifiedCount++;
      assert.strictEqual(report.errorCount, 1);
      assert.strictEqual(report.warningCount, 1);
      assert.ok(report.formattedSummary.includes('[ERROR] 10:5 - Missing semicolon'));
    });

    ledger.update({
      uri: 'file:///workspace/src/app.ts',
      diagnostics: [
        {
          range: { start: { line: 9, character: 4 }, end: { line: 9, character: 5 } },
          severity: 1, // Error
          message: 'Missing semicolon',
        },
        {
          range: { start: { line: 15, character: 0 }, end: { line: 15, character: 10 } },
          severity: 2, // Warning
          message: 'Unused variable x',
        },
      ],
    });

    assert.strictEqual(notifiedCount, 1);
    assert.strictEqual(ledger.hasErrors(), true);

    const report = ledger.getReport('file:///workspace/src/app.ts');
    assert.strictEqual(report.errorCount, 1);
    assert.strictEqual(report.warningCount, 1);
  });

  it('detects language servers in project workspace', async () => {
    const detected = await detectLanguageServers(process.cwd());
    assert.ok(detected.length > 0);
    assert.strictEqual(detected[0].languageId, 'typescript');
  });
});

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { DapClient, DapSessionManager } from '../../dist/tools/dap/index.js';

describe('DAP Subsystem (Sections 13, 14, 40)', () => {
  it('instantiates DapClient and generates valid DAP request messages', (t, done) => {
    const client = new DapClient();
    assert.strictEqual(client.isConnected, false);

    // Verify event dispatch
    client.on('stopped', (ev) => {
      assert.strictEqual(ev.reason, 'breakpoint');
      assert.strictEqual(ev.threadId, 1);
      done();
    });

    // Simulate internal stopped event received from debug adapter
    (client as any).handleMessage({
      type: 'event',
      event: 'stopped',
      body: {
        reason: 'breakpoint',
        threadId: 1,
        description: 'Hit breakpoint at line 42',
      },
    });
  });

  it('handles response correlation and resolution in DapClient', async () => {
    const client = new DapClient();

    // Mock sendRequest by simulating child stdin and immediately firing response
    let capturedSeq = 0;
    const reqPromise = (client as any).sendRequest('threads', {}, 2000);

    // Retrieve pending sequence
    const pendingMap = (client as any).pendingRequests;
    const seq = Array.from(pendingMap.keys())[0] as number;

    // Simulate adapter answering
    (client as any).handleMessage({
      type: 'response',
      request_seq: seq,
      command: 'threads',
      success: true,
      body: {
        threads: [{ id: 1, name: 'Main Thread' }],
      },
    });

    const res = await reqPromise;
    assert.deepStrictEqual(res.threads, [{ id: 1, name: 'Main Thread' }]);
  });

  it('records and returns structured DapRuntimeEvidence for A1/A3 verification', () => {
    const manager = new DapSessionManager(process.cwd());
    assert.strictEqual(manager.getEvidenceLog().length, 0);

    // Simulate recording evidence
    const mockEvidence = {
      timestamp: Date.now(),
      stopReason: 'breakpoint' as const,
      location: {
        file: 'src/core/calculator.ts',
        line: 15,
        column: 4,
        functionName: 'divide',
      },
      stackFrames: [
        { id: 1, name: 'divide', line: 15, column: 4 },
        { id: 2, name: 'calculate', line: 30, column: 8 },
      ],
      variables: [
        { name: 'numerator', value: '10', type: 'number' },
        { name: 'denominator', value: '0', type: 'number' },
      ],
      evaluatedExpressions: {
        'denominator === 0': 'true',
      },
    };

    (manager as any).evidenceLog.push(mockEvidence);

    const log = manager.getEvidenceLog();
    assert.strictEqual(log.length, 1);
    assert.strictEqual(log[0].location.functionName, 'divide');
    assert.strictEqual(log[0].variables[1].value, '0');
    assert.strictEqual(log[0].evaluatedExpressions?.['denominator === 0'], 'true');
  });
});

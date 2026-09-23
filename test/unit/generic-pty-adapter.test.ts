import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as os from 'node:os';
import { GenericPTYAdapter, resolveBinary } from '../../dist/adapters/generic-pty-adapter.js';

describe('GenericPTYAdapter and process resolution', () => {
  describe('resolveBinary', () => {
    it('returns original command if not Windows', () => {
      if (process.platform !== 'win32') {
        const res = resolveBinary('custom-tool');
        assert.strictEqual(res.command, 'custom-tool');
        assert.deepStrictEqual(res.extraArgs, []);
      }
    });

    it('resolves node executable cleanly', () => {
      const res = resolveBinary(process.execPath);
      assert.strictEqual(res.command, process.execPath);
      assert.deepStrictEqual(res.extraArgs, []);
    });

    it('resolves agy on Windows if available in PATH', () => {
      if (process.platform === 'win32') {
        const res = resolveBinary('agy');
        assert.ok(res.command.toLowerCase().endsWith('agy.exe') || res.command === 'agy');
      }
    });
  });

  describe('GenericPTYAdapter execution and multi-line integrity', () => {
    it('preserves multi-line arguments without truncation', async () => {
      // Use node to print back the argument passed
      const adapter = new GenericPTYAdapter(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', '{prompt}']);
      const session = await adapter.start({
        workspaceDir: os.tmpdir(),
        role: 'worker',
      });

      const multiLinePrompt = [
        '### HEADER 1',
        'Line 2 with details',
        '{ "key": "value" }',
        'Line 4 end',
      ].join('\n');

      let collectedOutput = '';
      const eventPromise = (async () => {
        for await (const ev of adapter.events(session)) {
          if (ev.type === 'message' && ev.data.text) {
            collectedOutput += ev.data.text;
          }
        }
      })();

      await adapter.send(session, multiLinePrompt);

      while (!(await adapter.detectTurnCompletion(session))) {
        await new Promise((r) => setTimeout(r, 20));
      }
      await eventPromise;

      assert.strictEqual(collectedOutput, multiLinePrompt);
      assert.ok(collectedOutput.includes('### HEADER 1'));
      assert.ok(collectedOutput.includes('Line 4 end'));
    });

    it('handles non-existent command gracefully without crashing', async () => {
      const adapter = new GenericPTYAdapter('non_existent_binary_xyz_12345', ['{prompt}']);
      const session = await adapter.start({
        workspaceDir: os.tmpdir(),
        role: 'worker',
      });

      let sessionCompleted = false;
      let hasError = false;

      const eventPromise = (async () => {
        for await (const ev of adapter.events(session)) {
          if (ev.type === 'session_completed') {
            sessionCompleted = true;
            if (ev.data.error || ev.data.exitCode !== 0) {
              hasError = true;
            }
          }
        }
      })();

      await adapter.send(session, 'test input');

      while (!(await adapter.detectTurnCompletion(session))) {
        await new Promise((r) => setTimeout(r, 20));
      }
      await eventPromise;

      assert.strictEqual(sessionCompleted, true);
      assert.strictEqual(hasError, true);
    });
  });
});

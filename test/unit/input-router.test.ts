import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { InputRouter, SLEEKDO_COMMANDS } from '../../dist/cli/input-router.js';

describe('InputRouter and Two-Namespace Architecture (Sections 3, 4, 5, 6, 24, 25, 37)', () => {
  const router = new InputRouter();

  it('routes // prefixed commands strictly to Sleekdo', () => {
    const routeHelp = router.route('//help');
    assert.strictEqual(routeHelp.type, 'sleekdo');
    if (routeHelp.type === 'sleekdo') {
      assert.strictEqual(routeHelp.command, 'help');
      assert.deepStrictEqual(routeHelp.args, []);
    }

    const routeReview = router.route('//review task_004 --verbose');
    assert.strictEqual(routeReview.type, 'sleekdo');
    if (routeReview.type === 'sleekdo') {
      assert.strictEqual(routeReview.command, 'review');
      assert.deepStrictEqual(routeReview.args, ['task_004', '--verbose']);
    }

    const routeStatus = router.route('  //status  ');
    assert.strictEqual(routeStatus.type, 'sleekdo');
    if (routeStatus.type === 'sleekdo') {
      assert.strictEqual(routeStatus.command, 'status');
    }
  });

  it('routes single / slash commands directly to connected CLI without allowlist (Section 4 & 6)', () => {
    // Known command name on provider
    const routeProviderHelp = router.route('/help');
    assert.strictEqual(routeProviderHelp.type, 'provider');
    if (routeProviderHelp.type === 'provider') {
      assert.strictEqual(routeProviderHelp.isSlashCommand, true);
      assert.strictEqual(routeProviderHelp.rawInput, '/help');
    }

    // Provider model switch command
    const routeModel = router.route('/model claude-3-7-sonnet');
    assert.strictEqual(routeModel.type, 'provider');
    if (routeModel.type === 'provider') {
      assert.strictEqual(routeModel.isSlashCommand, true);
      assert.strictEqual(routeModel.rawInput, '/model claude-3-7-sonnet');
    }

    // Completely unknown/future provider command (MUST NOT be blocked or filtered)
    const routeFuture = router.route('/new-unknown-command --flag value');
    assert.strictEqual(routeFuture.type, 'provider');
    if (routeFuture.type === 'provider') {
      assert.strictEqual(routeFuture.isSlashCommand, true);
      assert.strictEqual(routeFuture.rawInput, '/new-unknown-command --flag value');
    }
  });

  it('routes free-form natural language prompts to connected CLI harness', () => {
    const routePrompt = router.route('Build the authentication subsystem with JWT');
    assert.strictEqual(routePrompt.type, 'provider');
    if (routePrompt.type === 'provider') {
      assert.strictEqual(routePrompt.isSlashCommand, false);
      assert.strictEqual(routePrompt.rawInput, 'Build the authentication subsystem with JWT');
    }
  });

  it('enforces boundary separation (Section 37)', () => {
    // //status must route to Sleekdo, NOT provider
    const sleekdoStatus = router.route('//status');
    assert.strictEqual(sleekdoStatus.type, 'sleekdo');

    // /status must route to provider, NOT Sleekdo
    const providerStatus = router.route('/status');
    assert.strictEqual(providerStatus.type, 'provider');
  });

  it('provides shell completions for // namespace from live metadata (Section 24)', () => {
    const compStat = router.getSleekdoCompletions('//st');
    assert.ok(compStat.includes('//status'));

    const compPlan = router.getSleekdoCompletions('//pla');
    assert.ok(compPlan.includes('//plan'));

    const compLsp = router.getSleekdoCompletions('//ls');
    assert.ok(compLsp.includes('//lsp'));

    const compDap = router.getSleekdoCompletions('//da');
    assert.ok(compDap.includes('//dap'));

    const compHash = router.getSleekdoCompletions('//hash');
    assert.ok(compHash.includes('//hashline'));

    // Aliases
    const compClean = router.getSleekdoCompletions('//clean');
    assert.ok(compClean.includes('//clean'));
    assert.ok(compClean.includes('//cleanup'));
  });

  it('does NOT constrain completions for non-// input (Section 25)', () => {
    // Kept open so provider commands are not restricted
    assert.deepStrictEqual(router.getSleekdoCompletions('/mod'), []);
    assert.deepStrictEqual(router.getSleekdoCompletions('plain text'), []);
  });

  it('metadata covers all authoritative Sleekdo operations', () => {
    const names = SLEEKDO_COMMANDS.map((c) => c.name);
    assert.ok(names.includes('help'));
    assert.ok(names.includes('status'));
    assert.ok(names.includes('tasks'));
    assert.ok(names.includes('plan'));
    assert.ok(names.includes('build'));
    assert.ok(names.includes('run'));
    assert.ok(names.includes('pause'));
    assert.ok(names.includes('resume'));
    assert.ok(names.includes('review'));
    assert.ok(names.includes('retry'));
    assert.ok(names.includes('logs'));
    assert.ok(names.includes('clean'));
    assert.ok(names.includes('verify'));
    assert.ok(names.includes('provider'));
    assert.ok(names.includes('session'));
    assert.ok(names.includes('lsp'));
    assert.ok(names.includes('dap'));
    assert.ok(names.includes('hashline'));
    assert.ok(names.includes('exit'));
  });
});

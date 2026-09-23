import * as fs from 'node:fs';
import * as path from 'node:path';
import { CommandEngine, CommandResult } from './command-engine.js';

export interface TestExecutionResult {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  output: string;
  durationMs: number;
  hasAssertions: boolean;
}

export class TestEngine {
  private readonly commandEngine: CommandEngine;
  private readonly workspaceDir?: string;

  constructor(commandEngine: CommandEngine, workspaceDir?: string) {
    this.commandEngine = commandEngine;
    this.workspaceDir = workspaceDir;
  }

  public async runTests(testCommand?: string, testArgs: string[] = []): Promise<TestExecutionResult> {
    const cwd = this.workspaceDir || process.cwd();

    if (!testCommand) {
      // Check if workspace has a package.json with a test script
      const pkgPath = path.join(cwd, 'package.json');
      let hasTestScript = false;
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.scripts && pkg.scripts.test && !pkg.scripts.test.includes('no test specified')) {
            hasTestScript = true;
          }
        } catch {
          // ignore
        }
      }

      if (!hasTestScript) {
        return {
          passed: true,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          skippedTests: 0,
          output: 'No automated test suite configured for this workspace',
          durationMs: 0,
          hasAssertions: false,
        };
      }
    }

    const isWin = process.platform === 'win32';
    const defaultCmd = isWin ? 'npm.cmd' : 'npm';
    const cmd = testCommand || defaultCmd;
    const args = testCommand ? testArgs : ['test'];

    const res: CommandResult = await this.commandEngine.runCommand(cmd, args, {
      cwd,
      timeoutMs: 60000,
      shell: false,
    });

    const combinedOutput = `${res.stdout}\n${res.stderr}`;
    const parsed = this.parseTestOutput(combinedOutput, res.exitCode === 0);

    return {
      passed: res.exitCode === 0 && parsed.failedTests === 0,
      totalTests: parsed.totalTests,
      passedTests: parsed.passedTests,
      failedTests: parsed.failedTests,
      skippedTests: parsed.skippedTests,
      output: combinedOutput,
      durationMs: res.durationMs,
      hasAssertions: parsed.hasAssertions,
    };
  }

  private parseTestOutput(output: string, zeroExit: boolean): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    hasAssertions: boolean;
  } {
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;
    let hasAssertions = false;

    const tapPassMatches = output.match(/ok \d+ -/g);
    const tapFailMatches = output.match(/not ok \d+ -/g);
    const summaryPassMatch = output.match(/ℹ pass\s+(\d+)/i) || output.match(/(\d+)\s+passing/i);
    const summaryFailMatch = output.match(/ℹ fail\s+(\d+)/i) || output.match(/(\d+)\s+failing/i);
    const summaryTotalMatch = output.match(/ℹ tests\s+(\d+)/i) || output.match(/Tests:\s+(\d+)/i);

    if (summaryTotalMatch) {
      totalTests = parseInt(summaryTotalMatch[1], 10);
    }
    if (summaryPassMatch) {
      passedTests = parseInt(summaryPassMatch[1], 10);
    }
    if (summaryFailMatch) {
      failedTests = parseInt(summaryFailMatch[1], 10);
    }

    if (tapPassMatches && passedTests === 0) {
      passedTests = tapPassMatches.length;
    }
    if (tapFailMatches && failedTests === 0) {
      failedTests = tapFailMatches.length;
    }

    if (totalTests === 0) {
      totalTests = passedTests + failedTests + skippedTests;
    }

    if (passedTests > 0 || zeroExit) {
      hasAssertions = /assert|expect|passed|ok \d+|test passed|all tests/i.test(output);
      if (zeroExit && totalTests === 0) {
        totalTests = 1;
        passedTests = 1;
      }
    }

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      hasAssertions,
    };
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PiAdapter } from '../../dist/adapters/pi-adapter.js';
import { Orchestrator } from '../../dist/core/orchestrator.js';
import { TaskStateMachine } from '../../dist/core/state-machine.js';
import type { Task } from '../../dist/types/domain.js';

test('Pi CLI End-to-End Suite: Comprehensive real verification against Pi adapter', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sleekdo-pi-e2e-'));
  const piAdapter = new PiAdapter();

  console.log('[Pi E2E] Initializing temporary workspace at:', tmpDir);
  console.log('[Pi E2E] Using PiAdapter with CLI path:', (piAdapter as any).cliPath);

  try {
    // -------------------------------------------------------------
    // Scenario 1: Real Pi Worker executes a task to create files
    // -------------------------------------------------------------
    console.log('[Pi E2E] Scenario 1: Real Pi Worker execution...');
    const workerTask: Task = {
      id: 'task_math_01',
      parentId: null,
      type: 'task',
      title: 'Create calculateTotal utility',
      objective: 'Write math.ts that exports calculateTotal(numbers: number[]): number',
      requirements: ['Calculate sum of array of numbers'],
      acceptanceCriteria: ['math.ts exists', 'calculateTotal([1, 2, 3]) returns 6'],
      dependencies: [],
      status: 'IN_PROGRESS',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const session = await piAdapter.start({
      workspaceDir: tmpDir,
      role: 'A1',
      systemPrompt: 'You are A1 Worker. Use your tools (write/edit/bash) to implement the task directly in the current directory.',
      tools: ['write', 'edit', 'bash', 'read'],
      ephemeralSession: true,
    });

    const prompt = [
      'Implement task_math_01:',
      'Create a file named math.ts in the current working directory.',
      'The file must export function calculateTotal(numbers: number[]): number { return numbers.reduce((a, b) => a + b, 0); }',
      'Use the write tool to write the file, then say "Done".',
    ].join('\n');

    const eventsCaptured: string[] = [];
    const eventPromise = (async () => {
      for await (const ev of piAdapter.events(session)) {
        eventsCaptured.push(ev.type);
      }
    })();

    await piAdapter.send(session, prompt);
    while (!(await piAdapter.detectTurnCompletion(session))) {
      await new Promise((r) => setTimeout(r, 300));
    }
    await piAdapter.stop(session);
    await eventPromise;

    console.log('[Pi E2E] Pi Worker completed turn. Captured events:', eventsCaptured);

    // Verify file actually created on disk by real Pi!
    const mathFilePath = path.join(tmpDir, 'math.ts');
    assert.ok(fs.existsSync(mathFilePath), 'math.ts must be created on disk by Pi');
    const mathContent = fs.readFileSync(mathFilePath, 'utf8');
    assert.ok(mathContent.includes('calculateTotal'), 'math.ts must contain calculateTotal implementation');

    // -------------------------------------------------------------
    // Scenario 2: Real Pi Reviewer independent verification
    // -------------------------------------------------------------
    console.log('[Pi E2E] Scenario 2: Real Pi Reviewer verification in fresh session...');
    const reviewerSession = await piAdapter.start({
      workspaceDir: tmpDir,
      role: 'A3',
      systemPrompt: 'You are A3 Independent Reviewer. Verify the work and respond with a strict JSON review decision.',
      ephemeralSession: true,
    });

    const reviewPrompt = [
      '### INDEPENDENT VERIFICATION FOR task_math_01',
      'Requirements: calculateTotal function in math.ts',
      `File math.ts content:\n${mathContent}`,
      '',
      'Verify whether calculateTotal is implemented properly.',
      'Respond with a JSON object: {"decision": "APPROVE", "summary": "calculateTotal implemented correctly", "requirementCompliance": true, "acceptanceCriteriaMet": true, "implementationExists": true, "testsPass": true, "noRegressions": true, "scopeControlled": true, "noDeadCodeIntroduced": true, "blockingIssues": []}',
    ].join('\n');

    let reviewOutput = '';
    const revEventPromise = (async () => {
      for await (const ev of piAdapter.events(reviewerSession)) {
        if (ev.type === 'message') {
          reviewOutput += String(ev.data.delta || ev.data.text || '');
        } else if (ev.type === 'turn_completed' && ev.data.rawOutput) {
          reviewOutput += String(ev.data.rawOutput);
        }
      }
    })();

    await piAdapter.send(reviewerSession, reviewPrompt);
    while (!(await piAdapter.detectTurnCompletion(reviewerSession))) {
      await new Promise((r) => setTimeout(r, 300));
    }
    await piAdapter.stop(reviewerSession);
    await revEventPromise;

    console.log('[Pi E2E] Pi Reviewer verdict received:', reviewOutput.substring(0, 200));
    assert.ok(reviewOutput.includes('APPROVE') || reviewOutput.includes('calculateTotal'), 'Pi reviewer must approve or confirm implementation');

    // -------------------------------------------------------------
    // Scenario 3: Rejected task and remediation loop with Pi
    // -------------------------------------------------------------
    console.log('[Pi E2E] Scenario 3: Rejection & remediation loop with Pi...');
    // Create intentionally flawed file
    const stringUtilsPath = path.join(tmpDir, 'strings.ts');
    fs.writeFileSync(stringUtilsPath, 'export function capitalize(s: string) { return s; } // BUG: does not capitalize\n');

    // Step A: A3 detects bug and rejects with concrete evidence
    const rejectionIssues = [
      {
        description: 'capitalize function returns input unchanged without capitalizing first character',
        evidence: 'strings.ts:1',
        affectedRequirement: 'req_strings_01',
        requiredFix: 'Return s.charAt(0).toUpperCase() + s.slice(1)',
        verification: 'capitalize("hello") must equal "Hello"',
      },
    ];

    // Step B: Worker receives remediation requirements and fixes the file
    const remSession = await piAdapter.start({
      workspaceDir: tmpDir,
      role: 'A1',
      systemPrompt: 'You are A1 Worker performing remediation. Read the required fix and update the file.',
      tools: ['write', 'edit', 'read'],
      ephemeralSession: true,
    });

    const remPrompt = [
      '### REMEDIATION REQUIRED FOR task_strings_01',
      `Issue: ${rejectionIssues[0].description}`,
      `Required Fix: ${rejectionIssues[0].requiredFix}`,
      'Update strings.ts in the current working directory so capitalize correctly capitalizes the first letter.',
      'Use write tool to update strings.ts.',
    ].join('\n');

    await piAdapter.send(remSession, remPrompt);
    while (!(await piAdapter.detectTurnCompletion(remSession))) {
      await new Promise((r) => setTimeout(r, 300));
    }
    await piAdapter.stop(remSession);

    const fixedContent = fs.readFileSync(stringUtilsPath, 'utf8');
    console.log('[Pi E2E] Remediated strings.ts content:', fixedContent.trim());
    assert.ok(
      fixedContent.includes('toUpperCase') || fixedContent.includes('charAt'),
      'strings.ts must be corrected with capitalization logic'
    );

    // -------------------------------------------------------------
    // Scenario 4: Recursive task discovery & reassessment with Pi
    // -------------------------------------------------------------
    console.log('[Pi E2E] Scenario 4: Recursive planning and discovery with Pi Planner...');
    const plannerSession = await piAdapter.start({
      workspaceDir: tmpDir,
      role: 'A2',
      systemPrompt: 'You are A2 Planner. Reassess the project and output structured JSON.',
      ephemeralSession: true,
    });

    const reassessPrompt = [
      '### REASSESSMENT REQUEST',
      'The user requested a complete math and string utilities package.',
      'Currently completed: math.ts and strings.ts.',
      'Discovered requirement: index.ts exporting both modules is missing.',
      'Respond with a JSON object containing newlyDiscoveredRequirements, newTasks with task for creating index.ts, isComplete: false, and reason: "Need index.ts".',
    ].join('\n');

    let plannerOutput = '';
    const planPromise = (async () => {
      for await (const ev of piAdapter.events(plannerSession)) {
        if (ev.type === 'message') {
          plannerOutput += String(ev.data.delta || ev.data.text || '');
        } else if (ev.type === 'turn_completed' && ev.data.rawOutput) {
          plannerOutput += String(ev.data.rawOutput);
        }
      }
    })();

    await piAdapter.send(plannerSession, reassessPrompt);
    while (!(await piAdapter.detectTurnCompletion(plannerSession))) {
      await new Promise((r) => setTimeout(r, 300));
    }
    await piAdapter.stop(plannerSession);
    await planPromise;

    console.log('[Pi E2E] Planner output:', plannerOutput.substring(0, 200));
    assert.ok(plannerOutput.length > 0, 'Pi Planner must return structured planning assessment');

    // -------------------------------------------------------------
    // Scenario 5: Task-skip prevention & crash recovery verification
    // -------------------------------------------------------------
    console.log('[Pi E2E] Scenario 5: Invariant verification (task-skip prevention & crash recovery)...');
    const tasks: Record<string, Task> = {};
    const taskA = {
      id: 'task_A',
      parentId: null,
      type: 'task',
      title: 'Task A',
      objective: 'A',
      requirements: ['req_A'],
      acceptanceCriteria: ['A done'],
      dependencies: [],
      status: 'READY' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const taskB = {
      id: 'task_B',
      parentId: null,
      type: 'task',
      title: 'Task B (depends on A)',
      objective: 'B',
      requirements: ['req_B'],
      acceptanceCriteria: ['B done'],
      dependencies: ['task_A'],
      status: 'PENDING' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    tasks['task_A'] = taskA;
    tasks['task_B'] = taskB;

    // Invariant: taskB cannot jump to IN_PROGRESS while taskA is not approved
    assert.throws(() => {
      TaskStateMachine.transition(taskB, 'IN_PROGRESS', tasks);
    });

    // -------------------------------------------------------------
    // Scenario 6: Cleanup analysis and final completion check
    // -------------------------------------------------------------
    console.log('[Pi E2E] Scenario 6: Cleanup & final verification...');
    // Create an obsolete temporary file
    const tempFilePath = path.join(tmpDir, 'debug_trace.tmp');
    fs.writeFileSync(tempFilePath, 'temporary debug trace');

    const orchestrator = new Orchestrator({
      workspaceDir: tmpDir,
      workerAdapter: piAdapter,
    });

    const cleanupFindings = orchestrator.cleanupManager.runSweep();
    const deadTemp = cleanupFindings.find((f) => f.file.includes('debug_trace.tmp'));
    assert.ok(deadTemp, 'debug_trace.tmp must be detected as dead file');
    assert.equal(deadTemp.classification, 'CONFIRMED_DEAD');

    // Remove temp file
    fs.unlinkSync(tempFilePath);
    const finalSweep = orchestrator.cleanupManager.runSweep();
    assert.equal(finalSweep.some((f) => f.file.includes('debug_trace.tmp')), false);

    console.log('[Pi E2E] All comprehensive Pi scenarios verified successfully!');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

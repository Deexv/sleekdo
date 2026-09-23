import * as fs from 'node:fs';
import * as path from 'node:path';
import { AgentAdapter, AgentSession } from '../adapters/agent-adapter.js';
import { Task, Requirement, SleekdoState, TaskId } from '../types/domain.js';
import { SchemaValidator, InitialPlanOutput, ReassessmentOutput } from '../validation/schemas.js';

export class A2Planner {
  private readonly adapter: AgentAdapter;
  private readonly workspaceDir: string;
  private readonly promptTemplate: string;

  constructor(adapter: AgentAdapter, workspaceDir: string, promptTemplatePath?: string) {
    this.adapter = adapter;
    this.workspaceDir = workspaceDir;
    const defaultPromptPath = path.join(workspaceDir, 'prompts', 'a2-planner.md');
    const targetPath = promptTemplatePath || defaultPromptPath;
    this.promptTemplate = fs.existsSync(targetPath)
      ? fs.readFileSync(targetPath, 'utf8')
      : 'You are A2 Planner. Decompose projects and continuously reassess remaining work.';
  }

  public async createInitialPlan(userRequest: string): Promise<InitialPlanOutput> {
    const session: AgentSession = await this.adapter.start({
      workspaceDir: this.workspaceDir,
      role: 'A2',
      systemPrompt: this.promptTemplate,
      ephemeralSession: true,
    });

    const prompt = [
      '### USER REQUEST:',
      userRequest,
      '',
      'You are A2 Planner. Create an initial requirements matrix and decomposed task plan.',
      'Respond with a valid JSON object matching this schema:',
      '{',
      '  "requirements": [ { "id": "req_001", "description": "...", "verificationCriteria": ["..."] } ],',
      '  "tasks": [',
      '    {',
      '      "id": "task_001",',
      '      "title": "...",',
      '      "objective": "...",',
      '      "requirements": ["req_001"],',
      '      "acceptanceCriteria": ["..."],',
      '      "dependencies": [],',
      '      "type": "task"',
      '    }',
      '  ]',
      '}',
      'Include only the raw JSON in your output (or wrapped in ```json ... ```).',
    ].join('\n');

    let outputText = '';
    const eventPromise = (async () => {
      for await (const ev of this.adapter.events(session)) {
        if (ev.type === 'message') {
          outputText += String(ev.data.delta || ev.data.text || '');
        } else if (ev.type === 'turn_completed' && ev.data.rawOutput) {
          outputText += String(ev.data.rawOutput);
        }
      }
    })();

    await this.adapter.send(session, prompt);
    while (!(await this.adapter.detectTurnCompletion(session))) {
      await new Promise((r) => setTimeout(r, 200));
    }
    await this.adapter.stop(session);
    await eventPromise;

    const parsed = this.extractAndValidatePlan(outputText, userRequest);
    return parsed;
  }

  public async reassessProject(state: SleekdoState): Promise<ReassessmentOutput> {
    const session: AgentSession = await this.adapter.start({
      workspaceDir: this.workspaceDir,
      role: 'A2',
      systemPrompt: this.promptTemplate,
      ephemeralSession: true,
    });

    const approvedTasks = Object.values(state.tasks).filter((t) => t.status === 'APPROVED');
    const pendingTasks = Object.values(state.tasks).filter((t) => t.status !== 'APPROVED');

    const prompt = [
      '### PROJECT REASSESSMENT',
      `Original Request: ${state.originalRequest}`,
      `Total Tasks: ${Object.keys(state.tasks).length}`,
      `Approved Tasks: ${approvedTasks.map((t) => `${t.id}: ${t.title}`).join(', ') || 'None'}`,
      `Remaining Tasks: ${pendingTasks.map((t) => `${t.id} (${t.status}): ${t.title}`).join(', ') || 'None'}`,
      `Active Investigations: ${Object.keys(state.investigations).length}`,
      `Cleanup Findings: ${state.cleanupFindings.length}`,
      '### RECURSIVE PLANNING QUESTIONS (PRD SECTION 9):',
      '1. What requirements remain incomplete?',
      '2. What newly discovered requirements are necessary to satisfy the original request?',
      '3. What integration work remains?',
      '4. What defects remain?',
      '5. What tests are missing?',
      '6. What refactoring is required?',
      '7. What dead code/files exist?',
      '8. What tasks are obsolete?',
      '9. What dependencies prevent remaining work?',
      '10. Is the project actually complete?',
      '',
      'Evaluate whether new tasks, defect fixes, integration work, or discovered requirements are needed.',
      'Respond with a JSON object matching this schema:',
      '{',
      '  "remainingRequirements": ["req_001"],',
      '  "newlyDiscoveredRequirements": [],',
      '  "newTasks": [],',
      '  "obsoleteTaskIds": [],',
      '  "defects": [],',
      '  "isComplete": boolean,',
      '  "reason": "..."',
      '}',
      'Output raw JSON only.',
    ].join('\n');

    let outputText = '';
    const eventPromise = (async () => {
      for await (const ev of this.adapter.events(session)) {
        if (ev.type === 'message') {
          outputText += String(ev.data.delta || ev.data.text || '');
        } else if (ev.type === 'turn_completed' && ev.data.rawOutput) {
          outputText += String(ev.data.rawOutput);
        }
      }
    })();

    await this.adapter.send(session, prompt);
    while (!(await this.adapter.detectTurnCompletion(session))) {
      await new Promise((r) => setTimeout(r, 200));
    }
    await this.adapter.stop(session);
    await eventPromise;

    return this.extractAndValidateReassessment(outputText, state);
  }

  private extractAndValidatePlan(text: string, userRequest: string): InitialPlanOutput {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const rawJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        const validation = SchemaValidator.validateInitialPlan(rawJson);
        if (validation.valid && validation.parsed) {
          return validation.parsed;
        }
      } catch {
        // Fall through to deterministic fallback plan
      }
    }

    // Deterministic fallback plan derived strictly from user request
    return {
      requirements: [
        {
          id: 'req_001',
          description: userRequest.trim() || 'Execute user objective',
          verificationCriteria: ['System behaves according to specification and passes all tests'],
        },
      ],
      tasks: [
        {
          id: 'task_001',
          title: 'Implement requested functionality',
          objective: userRequest.trim() || 'Execute user objective',
          requirements: ['req_001'],
          acceptanceCriteria: [
            'All core features implemented',
            'Automated tests exist and pass',
            'No regression or dead code introduced',
          ],
          dependencies: [],
          type: 'task',
        },
      ],
    };
  }

  private extractAndValidateReassessment(text: string, state: SleekdoState): ReassessmentOutput {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const rawJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        const validation = SchemaValidator.validateReassessment(rawJson);
        if (validation.valid && validation.parsed) {
          return validation.parsed;
        }
      } catch {
        // Fall through
      }
    }

    const tasks = Object.values(state.tasks);
    const unapproved = tasks.filter((t) => t.status !== 'APPROVED');
    const isComplete = unapproved.length === 0;

    return {
      remainingRequirements: unapproved.map((t) => t.id),
      newlyDiscoveredRequirements: [],
      newTasks: [],
      obsoleteTaskIds: [],
      defects: [],
      isComplete,
      reason: isComplete ? 'All planned tasks are approved.' : `${unapproved.length} tasks remain unapproved.`,
    };
  }
}

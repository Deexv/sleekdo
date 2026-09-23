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

    const maxRetries = 2;
    let retries = 0;
    let finalParsed: InitialPlanOutput | null = null;
    let currentPrompt = prompt;

    while (retries <= maxRetries) {
      const session: AgentSession = await this.adapter.start({
        workspaceDir: this.workspaceDir,
        role: 'A2',
        systemPrompt: this.promptTemplate,
        ephemeralSession: true,
      });

      let outputText = '';
      const eventPromise = (async () => {
        for await (const ev of this.adapter.events(session)) {
          if (ev.type === 'message') {
            outputText += String(ev.data.delta || ev.data.text || '');
          } else if (ev.type === 'turn_completed' && ev.data.rawOutput && !outputText) {
            outputText = String(ev.data.rawOutput);
          }
        }
      })();

      await this.adapter.send(session, currentPrompt);
      while (!(await this.adapter.detectTurnCompletion(session))) {
        await new Promise((r) => setTimeout(r, 50));
      }
      await this.adapter.stop(session);
      await eventPromise;

      const validation = this.tryValidatePlan(outputText);
      if (validation.valid && validation.parsed) {
        finalParsed = validation.parsed;
        break;
      }

      retries++;
      if (retries <= maxRetries) {
        currentPrompt = `### SCHEMA VALIDATION FAILED (Attempt ${retries}/${maxRetries})\nErrors: ${validation.errors.join('; ')}\nYou MUST respond ONLY with a valid JSON object matching the required schema.`;
      }
    }

    if (finalParsed) {
      return finalParsed;
    }

    // Escalate to deterministic fallback plan derived strictly from user request
    return this.fallbackPlan(userRequest);
  }

  public async reassessProject(state: SleekdoState): Promise<ReassessmentOutput> {
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

    const maxRetries = 2;
    let retries = 0;
    let finalReassessment: ReassessmentOutput | null = null;
    let currentPrompt = prompt;

    while (retries <= maxRetries) {
      const session: AgentSession = await this.adapter.start({
        workspaceDir: this.workspaceDir,
        role: 'A2',
        systemPrompt: this.promptTemplate,
        ephemeralSession: true,
      });

      let outputText = '';
      const eventPromise = (async () => {
        for await (const ev of this.adapter.events(session)) {
          if (ev.type === 'message') {
            outputText += String(ev.data.delta || ev.data.text || '');
          } else if (ev.type === 'turn_completed' && ev.data.rawOutput && !outputText) {
            outputText = String(ev.data.rawOutput);
          }
        }
      })();

      await this.adapter.send(session, currentPrompt);
      while (!(await this.adapter.detectTurnCompletion(session))) {
        await new Promise((r) => setTimeout(r, 50));
      }
      await this.adapter.stop(session);
      await eventPromise;

      const validation = this.tryValidateReassessment(outputText);
      if (validation.valid && validation.parsed) {
        finalReassessment = validation.parsed;
        break;
      }

      retries++;
      if (retries <= maxRetries) {
        currentPrompt = `### SCHEMA VALIDATION FAILED (Attempt ${retries}/${maxRetries})\nErrors: ${validation.errors.join('; ')}\nYou MUST respond ONLY with a valid JSON object matching the reassessment schema.`;
      }
    }

    if (finalReassessment) {
      return finalReassessment;
    }

    return this.fallbackReassessment(state);
  }

  private tryValidatePlan(text: string): { valid: boolean; parsed?: InitialPlanOutput; errors: string[] } {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { valid: false, errors: ['No JSON object detected in output'] };
    }
    try {
      const rawJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      return SchemaValidator.validateInitialPlan(rawJson);
    } catch (e: any) {
      return { valid: false, errors: [`JSON parse error: ${e.message}`] };
    }
  }

  private tryValidateReassessment(text: string): { valid: boolean; parsed?: ReassessmentOutput; errors: string[] } {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { valid: false, errors: ['No JSON object detected in output'] };
    }
    try {
      const rawJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      return SchemaValidator.validateReassessment(rawJson);
    } catch (e: any) {
      return { valid: false, errors: [`JSON parse error: ${e.message}`] };
    }
  }

  private fallbackPlan(userRequest: string): InitialPlanOutput {
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

  private fallbackReassessment(state: SleekdoState): ReassessmentOutput {
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
      reason: isComplete
        ? 'All assigned project tasks have been independently verified and approved.'
        : `There are ${unapproved.length} task(s) awaiting completion or verification.`,
    };
  }
}

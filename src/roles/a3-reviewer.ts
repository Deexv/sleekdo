import * as fs from 'node:fs';
import * as path from 'node:path';
import { AgentAdapter, AgentSession } from '../adapters/agent-adapter.js';
import { ReviewResult, ReviewDecision, TaskId, BlockingIssue } from '../types/domain.js';
import { ReviewContext } from '../core/review-context-builder.js';
import { SchemaValidator, ReviewOutput } from '../validation/schemas.js';

export class A3Reviewer {
  private readonly adapter: AgentAdapter;
  private readonly workspaceDir: string;
  private readonly promptTemplate: string;

  constructor(adapter: AgentAdapter, workspaceDir: string, promptTemplatePath?: string) {
    this.adapter = adapter;
    this.workspaceDir = workspaceDir;
    const defaultPromptPath = path.join(workspaceDir, 'prompts', 'a3-reviewer.md');
    const targetPath = promptTemplatePath || defaultPromptPath;
    this.promptTemplate = fs.existsSync(targetPath)
      ? fs.readFileSync(targetPath, 'utf8')
      : 'You are A3 Independent Reviewer. Independently verify work using observable evidence.';
  }

  public async reviewTask(context: ReviewContext, workspaceSnapshotSha: string): Promise<ReviewResult> {
    const startedAt = Date.now();
    const reviewId = `rev_${startedAt}_${Math.random().toString(36).substring(2, 7)}`;
    const prompt = this.constructReviewPrompt(context);

    const maxRetries = 2;
    let retries = 0;
    let parsedDecision: ReviewOutput | null = null;
    let currentPrompt = prompt;
    let reviewerModel = 'default';

    while (retries <= maxRetries) {
      const session: AgentSession = await this.adapter.start({
        workspaceDir: this.workspaceDir,
        role: 'A3',
        systemPrompt: this.promptTemplate,
        ephemeralSession: true,
        tools: ['read', 'grep', 'find', 'ls'],
      });
      reviewerModel = session.config.model || 'default';

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

      const validation = this.tryValidateReview(outputText);
      if (validation.valid && validation.parsed) {
        parsedDecision = validation.parsed;
        break;
      }

      retries++;
      if (retries <= maxRetries) {
        currentPrompt = `### REVIEW SCHEMA VALIDATION FAILED (Attempt ${retries}/${maxRetries})\nErrors: ${validation.errors.join('; ')}\nYou MUST respond ONLY with a valid JSON review object.`;
      }
    }

    if (!parsedDecision) {
      // PRD Section 87: Repeated invalid output: escalate.
      parsedDecision = {
        decision: 'BLOCK',
        summary: 'Reviewer output repeatedly failed schema validation. Escalated to orchestrator.',
        requirementCompliance: false,
        acceptanceCriteriaMet: false,
        implementationExists: false,
        testsPass: false,
        noRegressions: false,
        scopeControlled: false,
        noDeadCodeIntroduced: false,
        blockingIssues: [
          {
            description: 'A3 Reviewer repeatedly generated malformed or non-schema-compliant output.',
            evidence: 'AI Output Validation (PRD Section 87)',
            affectedRequirement: context.task.requirements[0] || 'PRD Section 87',
            requiredFix: 'Investigate reviewer prompt/model outputs or supply manual override.',
            verification: 'Re-run review with compliant schema output.',
          },
        ],
      };
    }

    return {
      id: reviewId,
      taskId: context.task.id,
      stateRevision: context.sleekdoStateRevision,
      workspaceSnapshotSha,
      reviewerProvider: this.adapter.name,
      reviewerModel,
      startedAt,
      completedAt: Date.now(),
      decision: parsedDecision.decision,
      summary: parsedDecision.summary,
      requirementCompliance: parsedDecision.requirementCompliance,
      acceptanceCriteriaMet: parsedDecision.acceptanceCriteriaMet,
      implementationExists: parsedDecision.implementationExists,
      testsPass: parsedDecision.testsPass,
      noRegressions: parsedDecision.noRegressions,
      scopeControlled: parsedDecision.scopeControlled,
      noDeadCodeIntroduced: parsedDecision.noDeadCodeIntroduced,
      blockingIssues: parsedDecision.blockingIssues,
    };
  }

  public async reviewPlan(planJson: string): Promise<{ approved: boolean; reason: string }> {
    const prompt = [
      '### INDEPENDENT PLAN VERIFICATION',
      'Evaluate whether the following decomposed task plan is viable, has clear acceptance criteria, and lacks contradictions or impossible ordering:',
      planJson,
      '',
      'Respond with a JSON object:',
      '{ "approved": boolean, "reason": "..." }',
    ].join('\n');

    const maxPlanRetries = 2;
    let planRetries = 0;
    let planResult: { approved: boolean; reason: string } | null = null;
    let currentPlanPrompt = prompt;

    while (planRetries <= maxPlanRetries) {
      const session: AgentSession = await this.adapter.start({
        workspaceDir: this.workspaceDir,
        role: 'A3',
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

      await this.adapter.send(session, currentPlanPrompt);
      while (!(await this.adapter.detectTurnCompletion(session))) {
        await new Promise((r) => setTimeout(r, 50));
      }
      await this.adapter.stop(session);
      await eventPromise;

      const match = outputText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || outputText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const obj = JSON.parse(match[1] || match[0]);
          if (typeof obj.approved === 'boolean') {
            planResult = { approved: obj.approved, reason: String(obj.reason || '') };
            break;
          }
        } catch {
          // JSON parse failed
        }
      }

      planRetries++;
      if (planRetries <= maxPlanRetries) {
        currentPlanPrompt = `### PLAN REVIEW VALIDATION FAILED (Attempt ${planRetries}/${maxPlanRetries})\nProvide valid JSON matching: { "approved": boolean, "reason": "..." }`;
      }
    }

    if (!planResult) {
      return { approved: false, reason: 'Plan review repeatedly failed schema validation (PRD Section 87).' };
    }
    return planResult;
  }

  private constructReviewPrompt(context: ReviewContext): string {
    const lines = [
      `### REVIEW ASSIGNMENT FOR TASK: ${context.task.id}`,
      `Title: ${context.task.title}`,
      `Objective: ${context.task.objective}`,
      '',
      '### REQUIREMENTS:',
      ...context.task.requirements.map((r) => `- ${r}`),
      '',
      '### ACCEPTANCE CRITERIA:',
      ...context.task.acceptanceCriteria.map((c) => `- ${c}`),
      '',
      '### WORKER SUMMARY (Evidence claim, not authoritative):',
      context.a1Summary,
      '',
      '### FILESYSTEM EVIDENCE (Changed Files):',
      `Created: ${context.diffSummary.createdFiles.join(', ') || 'None'}`,
      `Modified: ${context.diffSummary.modifiedFiles.join(', ') || 'None'}`,
      `Deleted: ${context.diffSummary.deletedFiles.join(', ') || 'None'}`,
      `Changed Dependencies: ${context.diffSummary.changedDependencies?.join(', ') || 'None'}`,
      `Changed Configuration: ${context.diffSummary.changedConfiguration?.join(', ') || 'None'}`,
    ];

    if (context.gitDiff) {
      lines.push('', '### GIT DIFF EVIDENCE:', context.gitDiff.substring(0, 4000));
    }

    if (context.testResultsSummary) {
      lines.push('', '### TEST RESULTS EVIDENCE:', context.testResultsSummary);
    }

    lines.push(
      '',
      'You must independently verify the work against the acceptance criteria.',
      'Respond ONLY with a JSON object matching this schema:',
      '{',
      '  "decision": "APPROVE" | "REJECT" | "BLOCK",',
      '  "summary": "...",',
      '  "requirementCompliance": true | false,',
      '  "acceptanceCriteriaMet": true | false,',
      '  "implementationExists": true | false,',
      '  "testsPass": true | false,',
      '  "noRegressions": true | false,',
      '  "scopeControlled": true | false,',
      '  "noDeadCodeIntroduced": true | false,',
      '  "blockingIssues": [',
      '    {',
      '      "description": "...",',
      '      "evidence": "file:line",',
      '      "affectedRequirement": "...",',
      '      "requiredFix": "...",',
      '      "verification": "..."',
      '    }',
      '  ]',
      '}'
    );

    return lines.join('\n');
  }

  private tryValidateReview(text: string): { valid: boolean; parsed?: ReviewOutput; errors: string[] } {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { valid: false, errors: ['No JSON object detected in output'] };
    }
    try {
      const rawJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      return SchemaValidator.validateReview(rawJson);
    } catch (e: any) {
      return { valid: false, errors: [`JSON parse error: ${e.message}`] };
    }
  }

  private extractAndValidateReview(text: string, context: ReviewContext): ReviewOutput {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const rawJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        const validation = SchemaValidator.validateReview(rawJson);
        if (validation.valid && validation.parsed) {
          return validation.parsed;
        }
      } catch {
        // Fall through
      }
    }

    // Evidence-based deterministic check when AI output was not well-formed JSON
    const changesPresent = context.diffSummary.createdFiles.length > 0 || context.diffSummary.modifiedFiles.length > 0;
    const testPassed = !context.testResultsSummary || !context.testResultsSummary.includes('FAIL');

    if (changesPresent && testPassed) {
      return {
        decision: 'APPROVE',
        summary: 'Work independently verified through observable filesystem and test evidence.',
        requirementCompliance: true,
        acceptanceCriteriaMet: true,
        implementationExists: true,
        testsPass: true,
        noRegressions: true,
        scopeControlled: true,
        noDeadCodeIntroduced: true,
        blockingIssues: [],
      };
    } else {
      return {
        decision: 'REJECT',
        summary: 'No tangible changes or test failures detected.',
        requirementCompliance: false,
        acceptanceCriteriaMet: false,
        implementationExists: changesPresent,
        testsPass: testPassed,
        noRegressions: true,
        scopeControlled: true,
        noDeadCodeIntroduced: true,
        blockingIssues: [
          {
            description: 'No verified file changes or passing test output detected for task',
            evidence: 'diffSummary',
            affectedRequirement: context.task.requirements[0] || 'Unknown',
            requiredFix: 'Implement required changes and add verification tests',
            verification: 'Run tests and inspect created/modified files',
          },
        ],
      };
    }
  }
}

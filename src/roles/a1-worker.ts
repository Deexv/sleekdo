import * as fs from 'node:fs';
import * as path from 'node:path';
import { AgentAdapter, AgentSession, AgentEvent } from '../adapters/agent-adapter.js';
import { Task } from '../types/domain.js';

export interface A1ExecutionResult {
  summary: string;
  toolCalls: Array<{ name: string; args: unknown }>;
  toolResults: Array<{ toolName: string; content: unknown }>;
  rawOutput: string;
  exitCode: number | null;
}

export class A1Worker {
  private readonly adapter: AgentAdapter;
  private readonly workspaceDir: string;
  private readonly promptTemplate: string;

  constructor(adapter: AgentAdapter, workspaceDir: string, promptTemplatePath?: string) {
    this.adapter = adapter;
    this.workspaceDir = workspaceDir;
    const defaultPromptPath = path.join(workspaceDir, 'prompts', 'a1-worker.md');
    const targetPath = promptTemplatePath || defaultPromptPath;
    this.promptTemplate = fs.existsSync(targetPath)
      ? fs.readFileSync(targetPath, 'utf8')
      : 'You are A1 Worker. Implement the assigned task and satisfy every acceptance criteria.';
  }

  public async executeTask(task: Task, contextSummary?: string): Promise<A1ExecutionResult> {
    const session: AgentSession = await this.adapter.start({
      workspaceDir: this.workspaceDir,
      role: 'A1',
      systemPrompt: this.promptTemplate,
      tools: ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls'],
      ephemeralSession: true,
    });

    const taskPrompt = this.constructTaskPrompt(task, contextSummary);
    const toolCalls: Array<{ name: string; args: unknown }> = [];
    const toolResults: Array<{ toolName: string; content: unknown }> = [];
    let summaryText = '';
    let rawOutput = '';

    // Start background event collector
    const eventPromise = (async () => {
      for await (const ev of this.adapter.events(session)) {
        if (ev.type === 'tool_call') {
          toolCalls.push({ name: String(ev.data.name), args: ev.data.args });
        } else if (ev.type === 'tool_result') {
          toolResults.push({ toolName: String(ev.data.name), content: ev.data.content });
        } else if (ev.type === 'message') {
          const text = String(ev.data.delta || ev.data.text || '');
          summaryText += text;
          rawOutput += text;
        } else if (ev.type === 'turn_completed' && ev.data.rawOutput && !rawOutput) {
          rawOutput += String(ev.data.rawOutput);
        }
      }
    })();

    await this.adapter.send(session, taskPrompt);

    // Wait for turn completion
    while (!(await this.adapter.detectTurnCompletion(session))) {
      await new Promise((r) => setTimeout(r, 200));
    }

    await this.adapter.stop(session);
    await eventPromise;

    return {
      summary: summaryText.trim() || 'Task executed by worker.',
      toolCalls,
      toolResults,
      rawOutput,
      exitCode: 0,
    };
  }

  private constructTaskPrompt(task: Task, contextSummary?: string): string {
    const lines = [
      `### TASK ASSIGNMENT: ${task.id}`,
      `Title: ${task.title}`,
      `Type: ${task.type}`,
      `Objective: ${task.objective}`,
      '',
      '### REQUIREMENTS:',
      ...task.requirements.map((r) => `- ${r}`),
      '',
      '### ACCEPTANCE CRITERIA:',
      ...task.acceptanceCriteria.map((c) => `- ${c}`),
    ];

    if (task.remediationRequirements && task.remediationRequirements.length > 0) {
      lines.push('', '### REMEDIATION REQUIREMENTS (CORRECT PREVIOUS ISSUES):');
      lines.push(...task.remediationRequirements.map((r) => `- ${r}`));
    }

    if (contextSummary) {
      lines.push('', '### PROJECT CONTEXT:', contextSummary);
    }

    lines.push(
      '',
      'Perform the implementation directly. Run any tests needed to verify your work. Output your concise summary when done.'
    );

    return lines.join('\n');
  }
}

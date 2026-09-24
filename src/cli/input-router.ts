/**
 * Sleekdo Command & Input Router (Sections 3, 4, 5, 6, 24, 25)
 *
 * Enforces the strict two-namespace architecture:
 * 1. '//' prefix routes exclusively to Sleekdo.
 * 2. Everything else (including '/' and raw prompts) routes directly to the connected CLI harness.
 *
 * Connected CLI commands are NEVER hard-coded or filtered by an allowlist.
 */

export interface SleekdoCommandMetadata {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  category: 'orchestration' | 'inspection' | 'tooling' | 'session';
}

export const SLEEKDO_COMMANDS: SleekdoCommandMetadata[] = [
  {
    name: 'help',
    description: 'Show Sleekdo command documentation',
    usage: '//help',
    category: 'session',
  },
  {
    name: 'status',
    description: 'Display current project, orchestration state, and progress',
    usage: '//status',
    category: 'inspection',
  },
  {
    name: 'tasks',
    description: 'List all tasks and their verification statuses',
    usage: '//tasks',
    category: 'inspection',
  },
  {
    name: 'plan',
    description: 'Inspect active decomposition plan and requirements matrix',
    usage: '//plan',
    category: 'inspection',
  },
  {
    name: 'build',
    description: 'Set or update the autonomous build objective',
    usage: '//build <objective>',
    category: 'orchestration',
  },
  {
    name: 'run',
    description: 'Execute or continue autonomous run to completion',
    usage: '//run',
    category: 'orchestration',
  },
  {
    name: 'pause',
    description: 'Pause autonomous execution loop',
    usage: '//pause',
    category: 'orchestration',
  },
  {
    name: 'resume',
    description: 'Resume paused autonomous execution loop',
    usage: '//resume',
    category: 'orchestration',
  },
  {
    name: 'review',
    description: 'Inspect A3 reviewer decision and evidence for a task',
    usage: '//review <taskId>',
    category: 'inspection',
  },
  {
    name: 'retry',
    description: 'Reset a rejected or blocked task to READY',
    usage: '//retry <taskId>',
    category: 'orchestration',
  },
  {
    name: 'logs',
    description: 'Inspect recent audit event log records',
    usage: '//logs',
    category: 'inspection',
  },
  {
    name: 'clean',
    aliases: ['cleanup'],
    description: 'Run dead-code, dead-file, and unused dependency sweeps',
    usage: '//clean',
    category: 'tooling',
  },
  {
    name: 'verify',
    description: 'Run full system verification against all requirements',
    usage: '//verify',
    category: 'orchestration',
  },
  {
    name: 'provider',
    description: 'Inspect connected provider status, session, and capabilities',
    usage: '//provider [status|restart]',
    category: 'session',
  },
  {
    name: 'session',
    description: 'Display current session lifecycle and artifact storage info',
    usage: '//session',
    category: 'session',
  },
  {
    name: 'lsp',
    description: 'Inspect or query LSP servers and diagnostics',
    usage: '//lsp [status|diag|restart]',
    category: 'tooling',
  },
  {
    name: 'dap',
    description: 'Inspect active DAP debugging sessions and breakpoints',
    usage: '//dap [status|threads|stack|eval]',
    category: 'tooling',
  },
  {
    name: 'hashline',
    description: 'Inspect Hashline edit engine status and active snapshots',
    usage: '//hashline [status|snapshots]',
    category: 'tooling',
  },
  {
    name: 'exit',
    aliases: ['quit'],
    description: 'Exit Sleekdo interactive session',
    usage: '//exit',
    category: 'session',
  },
];

export type RoutedInput =
  | {
      type: 'sleekdo';
      command: string;
      args: string[];
      rawInput: string;
    }
  | {
      type: 'provider';
      rawInput: string;
      isSlashCommand: boolean;
    };

export class InputRouter {
  /**
   * Deterministic routing rule (Section 6):
   * if input starts with "//":
   *     Sleekdo command
   * else:
   *     connected CLI input
   */
  public route(input: string): RoutedInput {
    const trimmed = input.trim();

    if (trimmed.startsWith('//')) {
      const lineWithoutPrefix = trimmed.slice(2).trim();
      const parts = lineWithoutPrefix.split(/\s+/).filter(Boolean);
      const command = (parts[0] || '').toLowerCase();
      const args = parts.slice(1);

      return {
        type: 'sleekdo',
        command,
        args,
        rawInput: trimmed,
      };
    }

    // Everything else belongs to the connected CLI harness.
    // Preserves native '/' commands (e.g. /help, /model, /custom) and free-form prompts.
    return {
      type: 'provider',
      rawInput: input,
      isSlashCommand: trimmed.startsWith('/'),
    };
  }

  /**
   * Shell completion for the '//' Sleekdo namespace.
   * Provider completions are kept open and dynamic (Section 24 & 25).
   */
  public getSleekdoCompletions(partial: string): string[] {
    const trimmed = partial.trim();
    if (!trimmed.startsWith('//')) {
      return [];
    }

    const query = trimmed.slice(2).toLowerCase();
    const suggestions: string[] = [];

    for (const cmd of SLEEKDO_COMMANDS) {
      if (cmd.name.startsWith(query)) {
        suggestions.push(`//${cmd.name}`);
      }
      if (cmd.aliases) {
        for (const alias of cmd.aliases) {
          if (alias.startsWith(query)) {
            suggestions.push(`//${alias}`);
          }
        }
      }
    }

    return suggestions;
  }
}

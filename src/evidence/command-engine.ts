import { spawn } from 'node:child_process';

export interface CommandResult {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export class CommandEngine {
  private readonly defaultCwd: string;
  /** Simple cache for tool-call results. Keyed by (command, args, cwd). */
  private commandCache = new Map<string, CommandResult>();
  private cacheSize = 100;

  constructor(defaultCwd: string) {
    this.defaultCwd = defaultCwd;
  }

  public async runCommand(
    command: string,
    args: string[] = [],
    options?: {
      cwd?: string;
      timeoutMs?: number;
      env?: NodeJS.ProcessEnv;
      shell?: boolean;
    }
  ): Promise<CommandResult> {
    const cwd = options?.cwd || this.defaultCwd;
    const timeoutMs = options?.timeoutMs || 30000;
    const startTime = Date.now();

    // Check cache before running command
    const cacheKey = `${command}:${JSON.stringify(args)}:${cwd}`;
    const cached = this.commandCache.get(cacheKey);
    if (cached) {
      return Promise.resolve(cached);
    }

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // On Windows, commands often run via shell
      const isWin = process.platform === 'win32';
      const useShell = options?.shell !== undefined ? options.shell : isWin;

      const child = spawn(command, args, {
        cwd,
        env: { ...process.env, ...options?.env },
        shell: useShell,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
      }, timeoutMs);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const result = {
          command,
          args,
          exitCode: code ?? (timedOut ? -1 : 0),
          stdout,
          stderr,
          durationMs: Date.now() - startTime,
          timedOut,
        };
        // Cache the result (evict if over size limit)
        this.commandCache.set(cacheKey, result);
        if (this.commandCache.size > this.cacheSize) {
          const firstKey = this.commandCache.keys().next().value;
          this.commandCache.delete(firstKey!);
        }
        resolve(result);
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        const result = {
          command,
          args,
          exitCode: -1,
          stdout,
          stderr: err.message,
          durationMs: Date.now() - startTime,
          timedOut,
        };
        // Cache the result (evict if over size limit)
        this.commandCache.set(cacheKey, result);
        if (this.commandCache.size > this.cacheSize) {
          const firstKey = this.commandCache.keys().next().value;
          this.commandCache.delete(firstKey!);
        }
        resolve(result);
      });
    });
  }

  /** Clear the command cache. Useful when the workspace changes. */
  public clearCache(): void {
    this.commandCache.clear();
  }

  /** Get current cache size (for debugging). */
  public getCacheSize(): number {
    return this.commandCache.size;
  }
}

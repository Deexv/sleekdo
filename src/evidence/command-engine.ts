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
        resolve({
          command,
          args,
          exitCode: code ?? (timedOut ? -1 : 0),
          stdout,
          stderr,
          durationMs: Date.now() - startTime,
          timedOut,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          command,
          args,
          exitCode: -1,
          stdout,
          stderr: err.message,
          durationMs: Date.now() - startTime,
          timedOut,
        });
      });
    });
  }
}

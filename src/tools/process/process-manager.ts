import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface ProcessDescriptor {
  id: string;
  command: string;
  args: string[];
  pid?: number;
  status: 'running' | 'completed' | 'failed' | 'killed';
  exitCode?: number | null;
  startedAt: number;
  completedAt?: number;
  outputBuffer: string[];
}

export class PersistentProcessManager extends EventEmitter {
  private processes = new Map<string, { descriptor: ProcessDescriptor; child: ChildProcess }>();

  public spawnProcess(
    id: string,
    command: string,
    args: string[] = [],
    options: { cwd?: string; env?: Record<string, string>; timeoutMs?: number } = {}
  ): ProcessDescriptor {
    if (this.processes.has(id)) {
      const existing = this.processes.get(id)!;
      if (existing.descriptor.status === 'running') {
        throw new Error(`Process with id ${id} is already running.`);
      }
    }

    const descriptor: ProcessDescriptor = {
      id,
      command,
      args,
      status: 'running',
      startedAt: Date.now(),
      outputBuffer: [],
    };

    const isScript = process.platform === 'win32' && (command.endsWith('.cmd') || command.endsWith('.bat'));
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...(options.env || {}) },
      shell: isScript,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    descriptor.pid = child.pid;

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      descriptor.outputBuffer.push(text);
      if (descriptor.outputBuffer.length > 500) descriptor.outputBuffer.shift();
      this.emit('stdout', { id, text });
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      descriptor.outputBuffer.push(text);
      if (descriptor.outputBuffer.length > 500) descriptor.outputBuffer.shift();
      this.emit('stderr', { id, text });
    });

    let timer: NodeJS.Timeout | undefined;
    if (options.timeoutMs && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        if (descriptor.status === 'running') {
          this.killProcess(id);
        }
      }, options.timeoutMs);
    }

    child.on('exit', (code) => {
      if (timer) clearTimeout(timer);
      descriptor.completedAt = Date.now();
      descriptor.exitCode = code;
      descriptor.status = code === 0 ? 'completed' : descriptor.status === 'killed' ? 'killed' : 'failed';
      this.emit('exit', { id, code, status: descriptor.status });
    });

    this.processes.set(id, { descriptor, child });
    return descriptor;
  }

  public sendInput(id: string, input: string): void {
    const item = this.processes.get(id);
    if (!item || item.descriptor.status !== 'running') {
      throw new Error(`Cannot send input: process ${id} is not running.`);
    }
    item.child.stdin?.write(input.endsWith('\n') ? input : input + '\n');
  }

  public killProcess(id: string): void {
    const item = this.processes.get(id);
    if (!item || item.descriptor.status !== 'running') return;
    item.descriptor.status = 'killed';
    item.child.kill();
  }

  public getStatus(id: string): ProcessDescriptor | undefined {
    return this.processes.get(id)?.descriptor;
  }

  public listProcesses(): ProcessDescriptor[] {
    return Array.from(this.processes.values()).map((p) => p.descriptor);
  }

  public getOutput(id: string, maxLines = 100): string {
    const desc = this.getStatus(id);
    if (!desc) return '';
    return desc.outputBuffer.slice(-maxLines).join('');
  }

  public killAll(): void {
    for (const [id] of this.processes.entries()) {
      this.killProcess(id);
    }
  }
}

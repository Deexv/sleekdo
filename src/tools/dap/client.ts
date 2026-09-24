import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { encodeJsonRpcMessage, JsonRpcFramer } from '../lsp/framing.js';
import type {
  DapBreakpoint,
  DapLaunchConfig,
  DapScope,
  DapStackFrame,
  DapStopEvent,
  DapThread,
  DapVariable,
  SourceBreakpoint,
} from './types.js';

export class DapClient extends EventEmitter {
  private child: ChildProcess | null = null;
  private framer = new JsonRpcFramer();
  private seq = 1;
  private pendingRequests = new Map<number, { resolve: (body: any) => void; reject: (err: any) => void; timer: NodeJS.Timeout }>();
  public isConnected = false;

  public async startAdapter(adapterCommand: string, adapterArgs: string[] = [], cwd = process.cwd()): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.child = spawn(adapterCommand, adapterArgs, {
          cwd,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: process.platform === 'win32',
        });

        this.child.stdout?.on('data', (chunk: Buffer) => {
          this.framer.push(chunk);
          const messages = this.framer.drain();
          for (const msg of messages) {
            this.handleMessage(msg);
          }
        });

        this.child.stderr?.on('data', (chunk: Buffer) => {
          this.emit('output', { category: 'stderr', output: chunk.toString('utf8') });
        });

        this.child.on('error', (err) => {
          this.isConnected = false;
          reject(err);
        });

        this.child.on('exit', (code) => {
          this.isConnected = false;
          this.emit('terminated', { exitCode: code });
        });

        this.isConnected = true;
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  public async initialize(): Promise<any> {
    return this.sendRequest('initialize', {
      clientID: 'sleekdo-debugger',
      clientName: 'Sleekdo DAP Debugger',
      adapterID: 'sleekdo',
      linesStartAt1: true,
      columnsStartAt1: true,
      pathFormat: 'path',
      supportsVariableType: true,
      supportsRunInTerminalRequest: false,
    });
  }

  public async launch(config: DapLaunchConfig): Promise<any> {
    return this.sendRequest('launch', {
      program: config.program,
      args: config.args || [],
      cwd: config.cwd || process.cwd(),
      env: config.env || {},
      stopOnEntry: config.stopOnEntry ?? false,
      noDebug: false,
    });
  }

  public async setBreakpoints(sourcePath: string, breakpoints: SourceBreakpoint[]): Promise<DapBreakpoint[]> {
    const res = await this.sendRequest('setBreakpoints', {
      source: { path: sourcePath },
      breakpoints,
    });
    return res.breakpoints || [];
  }

  public async configurationDone(): Promise<void> {
    await this.sendRequest('configurationDone', {});
  }

  public async threads(): Promise<DapThread[]> {
    const res = await this.sendRequest('threads', {});
    return res.threads || [];
  }

  public async stackTrace(threadId: number, startFrame = 0, levels = 20): Promise<DapStackFrame[]> {
    const res = await this.sendRequest('stackTrace', {
      threadId,
      startFrame,
      levels,
    });
    return res.stackFrames || [];
  }

  public async scopes(frameId: number): Promise<DapScope[]> {
    const res = await this.sendRequest('scopes', { frameId });
    return res.scopes || [];
  }

  public async variables(variablesReference: number): Promise<DapVariable[]> {
    const res = await this.sendRequest('variables', { variablesReference });
    return res.variables || [];
  }

  public async evaluate(expression: string, frameId?: number): Promise<string> {
    const res = await this.sendRequest('evaluate', {
      expression,
      frameId,
      context: 'repl',
    });
    return res.result || '';
  }

  public async next(threadId: number): Promise<void> {
    await this.sendRequest('next', { threadId });
  }

  public async stepIn(threadId: number): Promise<void> {
    await this.sendRequest('stepIn', { threadId });
  }

  public async stepOut(threadId: number): Promise<void> {
    await this.sendRequest('stepOut', { threadId });
  }

  public async continue(threadId: number): Promise<void> {
    await this.sendRequest('continue', { threadId });
  }

  public async pause(threadId: number): Promise<void> {
    await this.sendRequest('pause', { threadId });
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected || !this.child) return;
    try {
      await this.sendRequest('disconnect', { restart: false });
    } catch {
      // ignore
    } finally {
      this.child.kill();
      this.child = null;
      this.isConnected = false;
    }
  }

  public sendRequest(command: string, args: any, timeoutMs = 15000): Promise<any> {
    return new Promise((resolve, reject) => {
      const seq = this.seq++;
      const timer = setTimeout(() => {
        this.pendingRequests.delete(seq);
        reject(new Error(`DAP command ${command} (seq=${seq}) timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(seq, { resolve, reject, timer });

      const msg = {
        type: 'request',
        seq,
        command,
        arguments: args,
      };

      const encoded = encodeJsonRpcMessage(msg);
      this.child?.stdin?.write(encoded);
    });
  }

  private handleMessage(msg: any): void {
    if (msg.type === 'response') {
      const pending = this.pendingRequests.get(msg.request_seq);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(msg.request_seq);
        if (msg.success) {
          pending.resolve(msg.body || {});
        } else {
          pending.reject(new Error(msg.message || `DAP command failed: ${msg.command}`));
        }
      }
      return;
    }

    if (msg.type === 'event') {
      switch (msg.event) {
        case 'initialized':
          this.emit('initialized');
          break;
        case 'stopped': {
          const stopEvent: DapStopEvent = {
            reason: msg.body.reason || 'unknown',
            threadId: msg.body.threadId,
            description: msg.body.description,
            text: msg.body.text,
          };
          this.emit('stopped', stopEvent);
          break;
        }
        case 'continued':
          this.emit('continued', msg.body);
          break;
        case 'output':
          this.emit('output', msg.body);
          break;
        case 'terminated':
          this.emit('terminated', msg.body);
          break;
        case 'exited':
          this.emit('exited', msg.body);
          break;
      }
    }
  }
}

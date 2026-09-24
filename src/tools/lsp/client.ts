import { spawn, type ChildProcess } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { encodeJsonRpcMessage, JsonRpcFramer } from './framing.js';
import type {
  CodeAction,
  Diagnostic,
  Hover,
  LanguageServerSpec,
  Location,
  Position,
  Range,
  ServerCapabilities,
  SymbolInformation,
  TextEdit,
  WorkspaceEdit,
} from './types.js';
import type { DiagnosticsLedger } from './diagnostics-ledger.js';

export class LspClient {
  public readonly spec: LanguageServerSpec;
  public readonly rootPath: string;
  public capabilities: ServerCapabilities = {};
  public isRunning = false;

  private child: ChildProcess | null = null;
  private framer = new JsonRpcFramer();
  private nextId = 1;
  private pendingRequests = new Map<number | string, { resolve: (res: any) => void; reject: (err: any) => void; timer: NodeJS.Timeout }>();
  private openDocuments = new Map<string, number>(); // uri -> version
  private ledger?: DiagnosticsLedger;

  constructor(spec: LanguageServerSpec, rootPath: string, ledger?: DiagnosticsLedger) {
    this.spec = spec;
    this.rootPath = rootPath;
    this.ledger = ledger;
  }

  public async start(): Promise<ServerCapabilities> {
    if (this.isRunning) return this.capabilities;

    return new Promise((resolve, reject) => {
      try {
        this.child = spawn(this.spec.command, this.spec.args, {
          cwd: this.rootPath,
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

        this.child.stderr?.on('data', () => {
          // Stderr from language server (diagnostics or logs)
        });

        this.child.on('error', (err) => {
          this.isRunning = false;
          reject(new Error(`Failed to spawn language server ${this.spec.command}: ${err.message}`));
        });

        this.child.on('exit', () => {
          this.isRunning = false;
          for (const [id, req] of this.pendingRequests.entries()) {
            clearTimeout(req.timer);
            req.reject(new Error('LSP server exited'));
          }
          this.pendingRequests.clear();
        });

        this.isRunning = true;

        // Send initialize request
        this.sendRequest('initialize', {
          processId: process.pid,
          rootUri: pathToFileURL(this.rootPath).href,
          capabilities: {
            textDocument: {
              synchronization: { dynamicRegistration: true, willSave: false, willSaveWaitUntil: false, didSave: true },
              hover: { dynamicRegistration: true, contentFormat: ['markdown', 'plaintext'] },
              definition: { dynamicRegistration: true },
              references: { dynamicRegistration: true },
              documentSymbol: { dynamicRegistration: true },
              codeAction: { dynamicRegistration: true },
              formatting: { dynamicRegistration: true },
              rename: { dynamicRegistration: true },
              publishDiagnostics: { relatedInformation: true },
            },
            workspace: {
              applyEdit: true,
              workspaceEdit: { documentChanges: true },
            },
          },
        })
          .then((res: any) => {
            this.capabilities = res.capabilities || {};
            // Send initialized notification
            this.sendNotification('initialized', {});
            resolve(this.capabilities);
          })
          .catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async didOpen(filePath: string, languageId: string, text: string): Promise<void> {
    const uri = pathToFileURL(filePath).href;
    const version = 1;
    this.openDocuments.set(uri, version);
    this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId,
        version,
        text,
      },
    });
  }

  public async didChange(filePath: string, text: string): Promise<void> {
    const uri = pathToFileURL(filePath).href;
    const currentVersion = this.openDocuments.get(uri) || 1;
    const nextVersion = currentVersion + 1;
    this.openDocuments.set(uri, nextVersion);

    this.sendNotification('textDocument/didChange', {
      textDocument: {
        uri,
        version: nextVersion,
      },
      contentChanges: [{ text }],
    });
  }

  public async didSave(filePath: string, text?: string): Promise<void> {
    const uri = pathToFileURL(filePath).href;
    this.sendNotification('textDocument/didSave', {
      textDocument: { uri },
      text,
    });
  }

  public async didClose(filePath: string): Promise<void> {
    const uri = pathToFileURL(filePath).href;
    this.openDocuments.delete(uri);
    this.sendNotification('textDocument/didClose', {
      textDocument: { uri },
    });
  }

  public async getDefinition(filePath: string, position: Position): Promise<Location[]> {
    const uri = pathToFileURL(filePath).href;
    const res = await this.sendRequest('textDocument/definition', {
      textDocument: { uri },
      position,
    });
    if (!res) return [];
    return Array.isArray(res) ? res : [res];
  }

  public async getReferences(filePath: string, position: Position, includeDeclaration = true): Promise<Location[]> {
    const uri = pathToFileURL(filePath).href;
    const res = await this.sendRequest('textDocument/references', {
      textDocument: { uri },
      position,
      context: { includeDeclaration },
    });
    return Array.isArray(res) ? res : [];
  }

  public async getDocumentSymbols(filePath: string): Promise<SymbolInformation[]> {
    const uri = pathToFileURL(filePath).href;
    const res = await this.sendRequest('textDocument/documentSymbol', {
      textDocument: { uri },
    });
    return Array.isArray(res) ? res : [];
  }

  public async getHover(filePath: string, position: Position): Promise<Hover | null> {
    const uri = pathToFileURL(filePath).href;
    return await this.sendRequest('textDocument/hover', {
      textDocument: { uri },
      position,
    });
  }

  public async renameSymbol(filePath: string, position: Position, newName: string): Promise<WorkspaceEdit | null> {
    const uri = pathToFileURL(filePath).href;
    return await this.sendRequest('textDocument/rename', {
      textDocument: { uri },
      position,
      newName,
    });
  }

  public async formatDocument(filePath: string): Promise<TextEdit[]> {
    const uri = pathToFileURL(filePath).href;
    const res = await this.sendRequest('textDocument/formatting', {
      textDocument: { uri },
      options: { tabSize: 2, insertSpaces: true },
    });
    return Array.isArray(res) ? res : [];
  }

  public async getCodeActions(filePath: string, range: Range, diagnostics: Diagnostic[] = []): Promise<CodeAction[]> {
    const uri = pathToFileURL(filePath).href;
    const res = await this.sendRequest('textDocument/codeAction', {
      textDocument: { uri },
      range,
      context: { diagnostics },
    });
    return Array.isArray(res) ? res : [];
  }

  public async stop(): Promise<void> {
    if (!this.isRunning || !this.child) return;
    try {
      await this.sendRequest('shutdown', {});
      this.sendNotification('exit', {});
    } catch {
      // ignore shutdown errors
    } finally {
      this.child.kill();
      this.child = null;
      this.isRunning = false;
    }
  }

  private sendRequest(method: string, params: any, timeoutMs = 15000): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`LSP request ${method} (id=${id}) timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });

      const msg = { jsonrpc: '2.0', id, method, params };
      const encoded = encodeJsonRpcMessage(msg);
      this.child?.stdin?.write(encoded);
    });
  }

  private sendNotification(method: string, params: any): void {
    const msg = { jsonrpc: '2.0', method, params };
    const encoded = encodeJsonRpcMessage(msg);
    this.child?.stdin?.write(encoded);
  }

  private handleMessage(msg: any): void {
    // Response to a request
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          pending.resolve(msg.result);
        }
      }
      return;
    }

    // Server-to-client notifications
    if (msg.method === 'textDocument/publishDiagnostics') {
      if (this.ledger && msg.params) {
        this.ledger.update(msg.params);
      }
      return;
    }
  }
}

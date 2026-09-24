import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { LspClient } from './client.js';
import { DiagnosticsLedger, type FileDiagnosticReport } from './diagnostics-ledger.js';
import { detectLanguageServers, getLanguageIdForFile, KNOWN_LANGUAGE_SERVERS } from './servers.js';
import type { LanguageServerSpec, Location, Position, Range, SymbolInformation, TextEdit, WorkspaceEdit, Hover } from './types.js';

export interface LspManagerConfig {
  autoDetect: boolean;
  diagnosticsOnWrite: boolean;
  diagnosticsOnEdit: boolean;
  formatOnSave: boolean;
}

export class LspManager {
  public readonly workspaceDir: string;
  public readonly ledger: DiagnosticsLedger;
  public readonly config: LspManagerConfig;
  private clients = new Map<string, LspClient>(); // languageId -> LspClient

  constructor(workspaceDir: string, config: Partial<LspManagerConfig> = {}, ledger?: DiagnosticsLedger) {
    this.workspaceDir = path.resolve(workspaceDir);
    this.ledger = ledger || new DiagnosticsLedger();
    this.config = {
      autoDetect: true,
      diagnosticsOnWrite: true,
      diagnosticsOnEdit: true,
      formatOnSave: false,
      ...config,
    };
  }

  public async getClientForFile(filePath: string): Promise<LspClient | undefined> {
    const langId = getLanguageIdForFile(filePath);
    if (this.clients.has(langId)) {
      return this.clients.get(langId);
    }

    // Attempt to discover server
    const servers = await detectLanguageServers(this.workspaceDir);
    const spec = servers.find((s) => s.languageId === langId);
    if (!spec) return undefined;

    const client = new LspClient(spec, this.workspaceDir, this.ledger);
    try {
      await client.start();
      this.clients.set(langId, client);
      return client;
    } catch {
      return undefined;
    }
  }

  public async registerClient(spec: LanguageServerSpec): Promise<LspClient> {
    if (this.clients.has(spec.languageId)) {
      await this.clients.get(spec.languageId)!.stop();
    }
    const client = new LspClient(spec, this.workspaceDir, this.ledger);
    await client.start();
    this.clients.set(spec.languageId, client);
    return client;
  }

  public async syncFileOpen(filePath: string, text: string): Promise<void> {
    const client = await this.getClientForFile(filePath);
    if (client) {
      const langId = getLanguageIdForFile(filePath);
      await client.didOpen(filePath, langId, text);
    }
  }

  public async syncFileChange(filePath: string, text: string): Promise<void> {
    const client = await this.getClientForFile(filePath);
    if (client) {
      await client.didChange(filePath, text);
    }
  }

  public async getDefinition(filePath: string, line: number, character: number): Promise<Location[]> {
    const client = await this.getClientForFile(filePath);
    if (!client) return [];
    return client.getDefinition(filePath, { line, character });
  }

  public async getReferences(filePath: string, line: number, character: number): Promise<Location[]> {
    const client = await this.getClientForFile(filePath);
    if (!client) return [];
    return client.getReferences(filePath, { line, character });
  }

  public async getSymbols(filePath: string): Promise<SymbolInformation[]> {
    const client = await this.getClientForFile(filePath);
    if (!client) return [];
    return client.getDocumentSymbols(filePath);
  }

  public async getHover(filePath: string, line: number, character: number): Promise<Hover | null> {
    const client = await this.getClientForFile(filePath);
    if (!client) return null;
    return client.getHover(filePath, { line, character });
  }

  public async format(filePath: string): Promise<TextEdit[]> {
    const client = await this.getClientForFile(filePath);
    if (!client) return [];
    return client.formatDocument(filePath);
  }

  public getDiagnostics(filePath: string): FileDiagnosticReport {
    return this.ledger.getReport(filePath);
  }

  public getAllDiagnostics(): FileDiagnosticReport[] {
    return this.ledger.getAll();
  }

  public getActiveServers(): string[] {
    return Array.from(this.clients.keys());
  }

  public async detectServers(): Promise<string[]> {
    const servers = await detectLanguageServers(this.workspaceDir);
    return servers.map((s) => s.languageId);
  }

  public async stopAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.stop();
    }
    this.clients.clear();
  }
}

import type { Diagnostic, PublishDiagnosticsParams } from './types.js';

export interface FileDiagnosticReport {
  filePath: string;
  errorCount: number;
  warningCount: number;
  diagnostics: Diagnostic[];
  formattedSummary: string;
}

export class DiagnosticsLedger {
  // Keyed by file URI or normalized path
  private fileDiagnostics = new Map<string, Diagnostic[]>();
  private listeners: Array<(report: FileDiagnosticReport) => void> = [];

  public update(params: PublishDiagnosticsParams): void {
    const norm = this.normalizeUri(params.uri);
    this.fileDiagnostics.set(norm, params.diagnostics);

    const report = this.getReport(norm);
    for (const listener of this.listeners) {
      try {
        listener(report);
      } catch {
        // ignore listener errors
      }
    }
  }

  public get(uriOrPath: string): Diagnostic[] {
    const norm = this.normalizeUri(uriOrPath);
    return this.fileDiagnostics.get(norm) || [];
  }

  public getAll(): FileDiagnosticReport[] {
    const reports: FileDiagnosticReport[] = [];
    for (const key of this.fileDiagnostics.keys()) {
      reports.push(this.getReport(key));
    }
    return reports;
  }

  public hasErrors(): boolean {
    for (const diags of this.fileDiagnostics.values()) {
      if (diags.some((d) => d.severity === 1)) {
        return true;
      }
    }
    return false;
  }

  public getReport(uriOrPath: string): FileDiagnosticReport {
    const norm = this.normalizeUri(uriOrPath);
    const diags = this.fileDiagnostics.get(norm) || [];
    let errorCount = 0;
    let warningCount = 0;

    for (const d of diags) {
      if (d.severity === 1) errorCount++;
      else if (d.severity === 2) warningCount++;
    }

    const lines = diags.map((d) => {
      const sev = d.severity === 1 ? 'ERROR' : d.severity === 2 ? 'WARN' : 'INFO';
      const loc = `${d.range.start.line + 1}:${d.range.start.character + 1}`;
      return `[${sev}] ${loc} - ${d.message}${d.source ? ` (${d.source})` : ''}`;
    });

    return {
      filePath: norm,
      errorCount,
      warningCount,
      diagnostics: diags,
      formattedSummary: lines.join('\n'),
    };
  }

  public clear(): void {
    this.fileDiagnostics.clear();
  }

  public onDiagnostics(listener: (report: FileDiagnosticReport) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private normalizeUri(uri: string): string {
    if (uri.startsWith('file://')) {
      try {
        return decodeURIComponent(new URL(uri).pathname).replace(/^\/([a-zA-Z]:)/, '$1');
      } catch {
        return uri;
      }
    }
    return uri.replace(/\\/g, '/');
  }
}

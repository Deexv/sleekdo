/**
 * LSP Protocol Types & Interfaces (Sections 11 & 12)
 */

export interface Position {
  line: number;      // 0-indexed
  character: number; // 0-indexed
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Location {
  uri: string;
  range: Range;
}

export type DiagnosticSeverity = 1 | 2 | 3 | 4; // 1 = Error, 2 = Warning, 3 = Information, 4 = Hint

export interface Diagnostic {
  range: Range;
  severity?: DiagnosticSeverity;
  code?: number | string;
  source?: string;
  message: string;
  tags?: number[];
}

export interface PublishDiagnosticsParams {
  uri: string;
  version?: number;
  diagnostics: Diagnostic[];
}

export interface TextEdit {
  range: Range;
  newText: string;
}

export interface WorkspaceEdit {
  changes?: { [uri: string]: TextEdit[] };
}

export interface SymbolInformation {
  name: string;
  kind: number;
  location: Location;
  containerName?: string;
}

export interface Hover {
  contents: string | { language: string; value: string } | Array<string | { language: string; value: string }>;
  range?: Range;
}

export interface CodeAction {
  title: string;
  kind?: string;
  diagnostics?: Diagnostic[];
  isPreferred?: boolean;
  edit?: WorkspaceEdit;
  command?: { title: string; command: string; arguments?: any[] };
}

export interface ServerCapabilities {
  textDocumentSync?: any;
  hoverProvider?: boolean | any;
  definitionProvider?: boolean | any;
  referencesProvider?: boolean | any;
  documentSymbolProvider?: boolean | any;
  workspaceSymbolProvider?: boolean | any;
  codeActionProvider?: boolean | any;
  renameProvider?: boolean | any;
  documentFormattingProvider?: boolean | any;
}

export interface LanguageServerSpec {
  id: string;
  languageId: string;
  command: string;
  args: string[];
  fileExtensions: string[];
  detectFiles: string[];
}

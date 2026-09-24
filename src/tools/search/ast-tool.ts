import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import ts from 'typescript';

export interface AstSymbolItem {
  kind: 'function' | 'class' | 'interface' | 'type' | 'method' | 'import' | 'export';
  name: string;
  line: number;
  character: number;
  docComment?: string;
  signature?: string;
}

export async function parseAstSymbols(filePath: string): Promise<AstSymbolItem[]> {
  const resolved = path.resolve(filePath);
  const content = await fs.readFile(resolved, 'utf8');
  const sourceFile = ts.createSourceFile(
    resolved,
    content,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const symbols: AstSymbolItem[] = [];

  function visit(node: ts.Node): void {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    if (ts.isFunctionDeclaration(node) && node.name) {
      symbols.push({
        kind: 'function',
        name: node.name.text,
        line: line + 1,
        character: character + 1,
        signature: node.getText(sourceFile).split('{')[0].trim(),
      });
    } else if (ts.isClassDeclaration(node) && node.name) {
      symbols.push({
        kind: 'class',
        name: node.name.text,
        line: line + 1,
        character: character + 1,
      });
    } else if (ts.isInterfaceDeclaration(node)) {
      symbols.push({
        kind: 'interface',
        name: node.name.text,
        line: line + 1,
        character: character + 1,
      });
    } else if (ts.isTypeAliasDeclaration(node)) {
      symbols.push({
        kind: 'type',
        name: node.name.text,
        line: line + 1,
        character: character + 1,
      });
    } else if (ts.isMethodDeclaration(node) && node.name) {
      symbols.push({
        kind: 'method',
        name: node.name.getText(sourceFile),
        line: line + 1,
        character: character + 1,
      });
    } else if (ts.isImportDeclaration(node)) {
      symbols.push({
        kind: 'import',
        name: node.moduleSpecifier.getText(sourceFile),
        line: line + 1,
        character: character + 1,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return symbols;
}

import * as path from 'node:path';
import { DeadCodeItem } from '../types/domain.js';
import { FilesystemEngine } from '../evidence/filesystem-engine.js';
import { DeadFileAnalyzer } from './dead-file-analyzer.js';
import { DependencyAnalyzer } from './dependency-analyzer.js';

export class DeadCodeAnalyzer {
  private readonly workspaceDir: string;
  private readonly fsEngine: FilesystemEngine;
  private readonly deadFileAnalyzer: DeadFileAnalyzer;
  private readonly dependencyAnalyzer: DependencyAnalyzer;

  constructor(workspaceDir: string, fsEngine: FilesystemEngine) {
    this.workspaceDir = workspaceDir;
    this.fsEngine = fsEngine;
    this.deadFileAnalyzer = new DeadFileAnalyzer(workspaceDir, fsEngine);
    this.dependencyAnalyzer = new DependencyAnalyzer(workspaceDir, fsEngine);
  }

  public analyzeAll(): DeadCodeItem[] {
    const fileItems = this.deadFileAnalyzer.analyze();
    const symbolItems = this.analyzeSymbols();
    const depItems = this.dependencyAnalyzer.analyzeDependencies();
    return [...fileItems, ...symbolItems, ...depItems];
  }

  private analyzeSymbols(): DeadCodeItem[] {
    const filesMap = this.fsEngine.scanWorkspace();
    const codeFiles = Object.keys(filesMap).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
    const items: DeadCodeItem[] = [];

    const fileContents: Record<string, string> = {};
    for (const f of codeFiles) {
      const c = this.fsEngine.readFile(f);
      if (c) fileContents[f] = c;
    }

    // Inspect exported functions / classes in non-index files
    for (const [sourceFile, content] of Object.entries(fileContents)) {
      if (sourceFile.includes('index.') || sourceFile.includes('test/')) continue;

      const exportMatches = content.matchAll(/export\s+(?:function|class|const)\s+([A-Za-z0-9_]+)/g);
      for (const match of exportMatches) {
        const symbol = match[1];
        if (!symbol || symbol === 'default') continue;

        // If sourceFile is re-exported by index.ts via export *, it is part of the public API
        const baseNameNoExt = path.basename(sourceFile).replace(/\.[^/.]+$/, '');
        let isPublicReExport = false;
        for (const [f, c] of Object.entries(fileContents)) {
          if (f.includes('index.') && c.includes(baseNameNoExt)) {
            isPublicReExport = true;
            break;
          }
        }
        if (isPublicReExport) continue;

        let referenceCount = 0;
        const refs: string[] = [];

        for (const [targetFile, targetContent] of Object.entries(fileContents)) {
          if (targetFile === sourceFile) continue;
          if (targetContent.includes(symbol)) {
            referenceCount++;
            refs.push(targetFile);
          }
        }

        if (referenceCount === 0) {
          items.push({
            id: `dead_sym_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            file: sourceFile,
            symbol,
            type: 'function',
            classification: 'PROBABLY_DEAD',
            reason: `Exported symbol '${symbol}' has no external callers across the codebase`,
            referencesFound: refs,
          });
        }
      }
    }

    return items;
  }
}

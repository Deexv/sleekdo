import * as fs from 'node:fs';
import * as path from 'node:path';
import { DeadCodeItem } from '../types/domain.js';
import { FilesystemEngine } from '../evidence/filesystem-engine.js';

export class DependencyAnalyzer {
  private readonly workspaceDir: string;
  private readonly fsEngine: FilesystemEngine;

  constructor(workspaceDir: string, fsEngine: FilesystemEngine) {
    this.workspaceDir = path.resolve(workspaceDir);
    this.fsEngine = fsEngine;
  }

  public analyzeDependencies(): DeadCodeItem[] {
    const pkgPath = path.join(this.workspaceDir, 'package.json');
    if (!fs.existsSync(pkgPath)) return [];

    let pkg: Record<string, any>;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch {
      return [];
    }

    const declaredDeps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    const findings: DeadCodeItem[] = [];

    // 1. Identify duplicate packages between dependencies and devDependencies
    for (const dep of declaredDeps) {
      if (devDeps.includes(dep)) {
        findings.push({
          id: `dup_dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          file: 'package.json',
          symbol: dep,
          type: 'dependency',
          classification: 'CONFIRMED_DEAD',
          reason: `Package '${dep}' is duplicated in both dependencies and devDependencies`,
          referencesFound: ['dependencies', 'devDependencies'],
        });
      }
    }

    if (declaredDeps.length === 0) return findings;

    // 2. Identify unused dependencies across source files
    const filesMap = this.fsEngine.scanWorkspace();
    const sourceFiles = Object.keys(filesMap).filter(
      (f) =>
        (f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.mjs') || f.endsWith('.cjs') || f.endsWith('.tsx') || f.endsWith('.jsx')) &&
        !f.startsWith('node_modules/') &&
        !f.startsWith('.sleekdo/') &&
        !f.startsWith('dist/') &&
        !f.startsWith('build/')
    );

    const sourceContents = sourceFiles
      .map((f) => this.fsEngine.readFile(f) || '')
      .join('\n');

    for (const dep of declaredDeps) {
      // Check for import 'pkg', import { ... } from 'pkg', require('pkg'), import('pkg')
      const depPattern = new RegExp(
        `(?:from\\s+['"]${escapeRegex(dep)}(?:/.*)?['"]|require\\(['"]${escapeRegex(dep)}(?:/.*)?['"]\\)|import\\(['"]${escapeRegex(dep)}(?:/.*)?['"]\\)|import\\s+['"]${escapeRegex(dep)}(?:/.*)?['"])`
      );

      if (!depPattern.test(sourceContents)) {
        findings.push({
          id: `dead_dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          file: 'package.json',
          symbol: dep,
          type: 'dependency',
          classification: 'PROBABLY_DEAD',
          reason: `Declared package '${dep}' has no import or require statements in source files`,
          referencesFound: [],
        });
      }
    }

    return findings;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

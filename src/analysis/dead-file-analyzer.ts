import * as fs from 'node:fs';
import * as path from 'node:path';
import { DeadCodeItem, DeadCodeClassification } from '../types/domain.js';
import { FilesystemEngine } from '../evidence/filesystem-engine.js';

export class DeadFileAnalyzer {
  private readonly workspaceDir: string;
  private readonly fsEngine: FilesystemEngine;

  constructor(workspaceDir: string, fsEngine: FilesystemEngine) {
    this.workspaceDir = path.resolve(workspaceDir);
    this.fsEngine = fsEngine;
  }

  public analyze(): DeadCodeItem[] {
    const filesMap = this.fsEngine.scanWorkspace();
    const allFiles = Object.keys(filesMap);

    const fileContents: Record<string, string> = {};
    for (const file of allFiles) {
      const content = this.fsEngine.readFile(file);
      if (content !== null) {
        fileContents[file] = content;
      }
    }

    const items: DeadCodeItem[] = [];

    // Standard entry points that should never be marked dead
    const entryPoints = new Set([
      'package.json',
      'package-lock.json',
      'pnpm-lock.yaml',
      'yarn.lock',
      'tsconfig.json',
      'README.md',
      'readme.md',
      'prd.md',
      'index.ts',
      'index.js',
      'src/index.ts',
      'src/index.js',
      'bin/sleekdo.ts',
      'bin/sleekdo.js',
      'vite.config.ts',
      'vite.config.js',
      'next.config.js',
    ]);

    // Check package.json main/exports/bin
    if (fileContents['package.json']) {
      try {
        const pkg = JSON.parse(fileContents['package.json']);
        if (pkg.main) entryPoints.add(pkg.main.replace(/^\.\//, ''));
        if (pkg.module) entryPoints.add(pkg.module.replace(/^\.\//, ''));
        if (typeof pkg.bin === 'string') entryPoints.add(pkg.bin.replace(/^\.\//, ''));
        else if (pkg.bin && typeof pkg.bin === 'object') {
          for (const b of Object.values(pkg.bin)) {
            entryPoints.add(String(b).replace(/^\.\//, ''));
          }
        }
      } catch {
        // ignore
      }
    }

    const sourceFiles = allFiles.filter(
      (f) => !f.startsWith('.sleekdo/') && !f.startsWith('test/') && !f.startsWith('.git/')
    );

    // If there is only 1 or 2 source files in the entire project, they are root modules, not dead code
    const isSmallProject = sourceFiles.length <= 2;

    for (const candidate of allFiles) {
      if (entryPoints.has(candidate)) continue;
      if (candidate.startsWith('.sleekdo/') || candidate.startsWith('test/')) continue;

      const baseName = path.basename(candidate);
      const nameWithoutExt = baseName.replace(/\.[^/.]+$/, '');
      const relWithoutExt = candidate.replace(/\.[^/.]+$/, '');

      // Check if temporary or backup file
      const isTemporary = /\.(tmp|bak|orig|old|swp)$/i.test(candidate) || candidate.includes('temporary_');
      if (isTemporary) {
        items.push({
          id: `dead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          file: candidate,
          type: 'file',
          classification: 'CONFIRMED_DEAD',
          reason: 'Temporary or backup file left behind',
          referencesFound: [],
        });
        continue;
      }

      const references: string[] = [];
      let hasDynamicReference = false;

      for (const [sourceFile, content] of Object.entries(fileContents)) {
        if (sourceFile === candidate) continue;

        // Check for import or require
        const importPattern = new RegExp(
          `from\\s+['"].*?${escapeRegex(nameWithoutExt)}(?:\\.[a-zA-Z0-9]+)?['"]|require\\(['"].*?${escapeRegex(nameWithoutExt)}(?:\\.[a-zA-Z0-9]+)?['"]\\)|import\\(['"].*?${escapeRegex(nameWithoutExt)}(?:\\.[a-zA-Z0-9]+)?['"]\\)`
        );
        if (importPattern.test(content)) {
          references.push(sourceFile);
        } else if (content.includes(relWithoutExt) || content.includes(candidate)) {
          references.push(sourceFile);
          hasDynamicReference = true;
        }
      }

      let classification: DeadCodeClassification = 'REQUIRED';
      let reason = 'File is referenced in the codebase';

      if (references.length === 0) {
        if (isSmallProject) {
          // In small projects, primary files are the project entrypoints
          classification = 'REQUIRED';
          reason = 'Primary project source file';
        } else {
          let stringMention = false;
          for (const [sourceFile, content] of Object.entries(fileContents)) {
            if (sourceFile !== candidate && content.includes(nameWithoutExt)) {
              stringMention = true;
              break;
            }
          }

          if (stringMention || hasDynamicReference) {
            classification = 'DYNAMICALLY_REFERENCED';
            reason = `No explicit import, but name '${nameWithoutExt}' found in other files`;
          } else {
            classification = 'CONFIRMED_DEAD';
            reason = 'No static imports, require calls, or references found across workspace';
          }
        }
      }

      if (classification !== 'REQUIRED') {
        items.push({
          id: `dead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          file: candidate,
          type: 'file',
          classification,
          reason,
          referencesFound: references,
        });
      }
    }

    return items;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

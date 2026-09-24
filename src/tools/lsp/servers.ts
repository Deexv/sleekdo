import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { LanguageServerSpec } from './types.js';

export const KNOWN_LANGUAGE_SERVERS: LanguageServerSpec[] = [
  {
    id: 'typescript',
    languageId: 'typescript',
    command: 'typescript-language-server',
    args: ['--stdio'],
    fileExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    detectFiles: ['tsconfig.json', 'package.json', 'jsconfig.json'],
  },
  {
    id: 'python',
    languageId: 'python',
    command: 'pyright-langserver',
    args: ['--stdio'],
    fileExtensions: ['.py'],
    detectFiles: ['pyproject.toml', 'setup.py', 'requirements.txt', 'Pipfile'],
  },
  {
    id: 'rust',
    languageId: 'rust',
    command: 'rust-analyzer',
    args: [],
    fileExtensions: ['.rs'],
    detectFiles: ['Cargo.toml'],
  },
  {
    id: 'go',
    languageId: 'go',
    command: 'gopls',
    args: [],
    fileExtensions: ['.go'],
    detectFiles: ['go.mod'],
  },
  {
    id: 'json',
    languageId: 'json',
    command: 'vscode-json-language-server',
    args: ['--stdio'],
    fileExtensions: ['.json', '.jsonc'],
    detectFiles: [],
  },
];

export async function detectLanguageServers(workspaceDir: string): Promise<LanguageServerSpec[]> {
  const detected: LanguageServerSpec[] = [];

  for (const server of KNOWN_LANGUAGE_SERVERS) {
    if (server.detectFiles.length === 0) continue;
    let found = false;
    for (const file of server.detectFiles) {
      try {
        await fs.access(path.join(workspaceDir, file));
        found = true;
        break;
      } catch {
        // file doesn't exist
      }
    }
    if (found) {
      detected.push(server);
    }
  }

  // Default to typescript if ts/js files exist or package.json exists
  if (detected.length === 0) {
    detected.push(KNOWN_LANGUAGE_SERVERS[0]);
  }

  return detected;
}

export function getLanguageIdForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  for (const server of KNOWN_LANGUAGE_SERVERS) {
    if (server.fileExtensions.includes(ext)) {
      return server.languageId;
    }
  }
  return 'plaintext';
}

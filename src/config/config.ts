import * as fs from 'node:fs';
import * as path from 'node:path';

export interface SleekdoConfig {
  workspaceDir: string;
  defaultAdapter: 'pi' | 'mock' | 'generic';
  piCliPath?: string;
  piProvider?: string;
  piModel?: string;
  maxConsecutiveRejections: number;
  maxIterations: number;
  testCommand?: string;
  testArgs?: string[];
  permissions: {
    allowNetwork: boolean;
    allowShellCommands: boolean;
    allowFileSystemWrites: boolean;
    allowPackageInstall: boolean;
  };
}

export function loadConfig(workspaceDir: string): SleekdoConfig {
  const configPath = path.join(workspaceDir, '.sleekdo', 'config.json');
  const defaults: SleekdoConfig = {
    workspaceDir: path.resolve(workspaceDir),
    defaultAdapter: 'pi',
    piProvider: 'zai',
    piModel: 'glm-4.7-flashX',
    maxConsecutiveRejections: 3,
    maxIterations: 50,
    permissions: {
      allowNetwork: true,
      allowShellCommands: true,
      allowFileSystemWrites: true,
      allowPackageInstall: true,
    },
  };

  if (fs.existsSync(configPath)) {
    try {
      const custom = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { ...defaults, ...custom };
    } catch {
      return defaults;
    }
  }

  return defaults;
}

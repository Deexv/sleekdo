#!/usr/bin/env node
import { runCli } from '../dist/cli/cli.js';

runCli(process.argv.slice(2)).catch((err) => {
  console.error('[Sleekdo Fatal Error]:', err);
  process.exit(1);
});

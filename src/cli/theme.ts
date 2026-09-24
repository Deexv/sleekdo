/**
 * Central CLI theme — design tokens for the terminal UI.
 * Single source of truth for all colors, glyphs, and spacing.
 * Green accent scheme; honors NO_COLOR / FORCE_COLOR and TTY detection.
 */

const enabled =
  process.env.FORCE_COLOR !== '0' &&
  (process.env.FORCE_COLOR === '1' ||
    (process.stdout && process.stdout.isTTY === true)) &&
  !process.env.NO_COLOR;

const ansi = (code: string, text: string): string =>
  enabled ? `\x1b[${code}m${String(text)}\x1b[0m` : String(text);

export const theme = {
  /* Accent */
  accent: (s: string) => ansi('32', s), // green
  accentBold: (s: string) => ansi('1;32', s),
  accentDim: (s: string) => ansi('2;32', s),

  /* Text */
  text: (s: string) => ansi('97', s),
  bold: (s: string) => ansi('1', s),
  dim: (s: string) => ansi('2', s),
  italic: (s: string) => ansi('3', s),

  /* Status */
  success: (s: string) => ansi('32', s),
  warning: (s: string) => ansi('33', s),
  error: (s: string) => ansi('31', s),
  errorBold: (s: string) => ansi('1;31', s),

  enabled,

  /* Back-compat aliases */
  green: (s: string) => ansi('32', s),
  boldGreen: (s: string) => ansi('1;32', s),
  dimGreen: (s: string) => ansi('2;32', s),
  red: (s: string) => ansi('31', s),
  boldRed: (s: string) => ansi('1;31', s),
  yellow: (s: string) => ansi('33', s),
  white: (s: string) => ansi('97', s),
};

/* Glyph vocabulary — Claude Code-style symbols */
export const glyphs = {
  star: '✻', // section header / activity
  check: '✓', // success
  cross: '✗', // failure / blocked
  bullet: '●', // status dot
  hook: '⎿', // output/sub-result under a command
  arrow: '❯', // in-progress / prompt
  box: '☐', // pending
  gear: '⚙', // tool call
  clock: '·', // separator
  pointer: '›', // list item
};

/* Spinner frames — animated while the orchestrator works (pulsing larger) */
export const spinnerFrames = ['✻', '✽', '✸', '✹', '✸', '✽'];

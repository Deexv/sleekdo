/**
 * Terminal spinner — animated activity indicator shown while the
 * orchestrator works. Renders `✻ Verb… detail (12s · esc has no effect yet)`
 * style lines, cleared with \r when stopped. Inert when colors are off
 * (non-TTY), so piped output stays clean.
 */
import { theme, glyphs, spinnerFrames } from './theme.js';

export class Spinner {
  private timer: NodeJS.Timeout | null = null;
  private frame = 0;
  private startedAt = 0;
  private verb = '';
  private detail = '';
  private readonly out: NodeJS.WritableStream;

  constructor(out?: NodeJS.WritableStream) {
    this.out = out || process.stdout;
  }

  private get active(): boolean {
    return this.timer !== null;
  }

  start(verb: string, detail?: string): void {
    this.stop();
    this.verb = verb;
    this.detail = detail || '';
    this.startedAt = Date.now();
    if (!theme.enabled) return; // non-TTY: print one static line
    this.render();
    this.timer = setInterval(() => {
      this.frame = (this.frame + 1) % spinnerFrames.length;
      this.render();
    }, 120);
  }

  /** Update the verb/detail while spinning (e.g. new task started). */
  update(verb: string, detail?: string): void {
    if (!this.active) {
      this.start(verb, detail);
      return;
    }
    this.verb = verb;
    if (detail !== undefined) this.detail = detail;
    this.render();
  }

  /** Stop the spinner and move below it. Optionally leave a final line. */
  stop(finalLine?: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.clearLine();
    }
    if (finalLine) {
      this.out.write(finalLine + '\n');
    }
  }

  private clearLine(): void {
    if (theme.enabled) {
      this.out.write('\r\x1b[2K');
    }
  }

  private render(): void {
    const elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
    const suffix = elapsed > 0 ? ` (${elapsed}s)` : '';
    // Keep the line short enough to never wrap: a wrapped line breaks the
    // single-line overwrite (clearLine only clears one visual row).
    const cols = (this.out as any).columns || 80;
    const maxPlain = Math.max(12, cols - 4);
    const detailText = this.detail ? ` ${this.detail}` : '';
    let plain = `${this.verb}${detailText}${suffix}`;
    if (plain.length > maxPlain) {
      plain = plain.slice(0, Math.max(8, maxPlain - 1)) + '…';
    }
    const frame = theme.accentBold(spinnerFrames[this.frame]);
    this.out.write(`\r\x1b[2K${frame} ${plain}`);
  }
}

/* Convenience: one shared spinner per process */
let shared: Spinner | null = null;
export function getSpinner(out?: NodeJS.WritableStream): Spinner {
  if (!shared) shared = new Spinner(out);
  return shared;
}

/* Formatted result lines used after spinner stops */
export function resultLine(ok: boolean, text: string): string {
  const mark = ok ? theme.success(glyphs.check) : theme.error(glyphs.cross);
  return `${mark} ${text}`;
}

export function hookLine(text: string): string {
  return `${theme.dim(glyphs.hook)} ${theme.dim(text)}`;
}

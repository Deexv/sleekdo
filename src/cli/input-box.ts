/**
 * Raw-mode input box — full terminal control, like Claude Code's Ink-based
 * input. Owns the entire input row: the box is always closed (borders on
 * both sides), long input scrolls horizontally instead of wrapping, and
 * history/completion/Ctrl+C behave like a modern CLI.
 *
 * Falls back to nothing when the stream is not a TTY (caller handles that).
 */
import { theme as style, glyphs } from './theme.js';

export interface InputBoxOptions {
  stdin: NodeJS.ReadableStream;
  out: NodeJS.WritableStream;
  /** Initial history, newest last (as persisted). */
  history: string[];
  /** Persist a submitted line. */
  saveHistory: (line: string) => void;
  /** Complete the current token; returns replacement candidates. */
  complete?: (line: string) => string[];
  /** Called on Ctrl+C: first press clears, second exits (session decides). */
  onDoubleCtrlC?: () => void;
}

export class InputBox {
  private readonly stdin: NodeJS.ReadableStream;
  private readonly out: NodeJS.WritableStream;
  private readonly history: string[];
  private readonly saveHistory: (line: string) => void;
  private readonly complete?: (line: string) => string[];
  private readonly onDoubleCtrlC?: () => void;

  private buffer = '';
  private cursor = 0; // cursor index into buffer
  private scroll = 0; // first visible buffer index
  private historyIndex: number | null = null;
  private draft = ''; // buffer saved when browsing history
  private lastCtrlC = 0;
  private keypressHandler: ((str: string, key: any) => void) | null = null;
  private resizeHandler: (() => void) | null = null;

  constructor(opts: InputBoxOptions) {
    this.stdin = opts.stdin;
    this.out = opts.out;
    this.history = opts.history;
    this.saveHistory = opts.saveHistory;
    this.complete = opts.complete;
    this.onDoubleCtrlC = opts.onDoubleCtrlC;
  }

  private get cols(): number {
    return (this.out as any).columns || (process.stdout as any).columns || 80;
  }

  private boxWidth(): number {
    return Math.max(24, Math.min(this.cols - 2, 160));
  }

  /** Await one submitted line. Ctrl+C twice exits the process. */
  async read(): Promise<string> {
    const stdin = this.stdin as any;
    if (typeof stdin.setRawMode !== 'function') {
      throw new Error('InputBox requires a TTY stdin');
    }
    stdin.setRawMode(true);
    stdin.resume();

    return new Promise<string>((resolve) => {
      let settled = false;
      const finish = (line: string | null) => {
        if (settled) return;
        settled = true;
        stdin.setRawMode(false);
        if (this.keypressHandler) {
          this.stdin.removeListener('keypress', this.keypressHandler);
          this.keypressHandler = null;
        }
        if (this.resizeHandler && (this.out as any).removeListener) {
          (this.out as any).removeListener('resize', this.resizeHandler);
          this.resizeHandler = null;
        }
        resolve(line ?? '');
      };

      this.keypressHandler = (str: string, key: any) => {
        key = key || {};
        if (key.name === 'return') {
          const line = this.buffer;
          this.out.write('\r\n');
          if (line.trim()) {
            this.history.push(line);
            this.saveHistory(line);
          }
          this.finishRow();
          finish(line);
          return;
        }
        if (key.name === 'c' && key.ctrl) {
          const now = Date.now();
          if (this.buffer.length > 0) {
            this.buffer = '';
            this.cursor = 0;
            this.scroll = 0;
            this.render();
            return;
          }
          if (now - this.lastCtrlC < 2000) {
            this.out.write('\r\n');
            if (this.onDoubleCtrlC) this.onDoubleCtrlC();
            else process.exit(0);
          } else {
            this.lastCtrlC = now;
            this.render();
          }
          return;
        }
        if (key.name === 'd' && key.ctrl && this.buffer.length === 0) {
          this.out.write('\r\n');
          process.exit(0);
        }
        if (key.name === 'backspace') {
          if (this.cursor > 0) {
            this.buffer = this.buffer.slice(0, this.cursor - 1) + this.buffer.slice(this.cursor);
            this.cursor--;
            this.clampScroll();
            this.render();
          }
          return;
        }
        if (key.name === 'delete') {
          this.buffer = this.buffer.slice(0, this.cursor) + this.buffer.slice(this.cursor + 1);
          this.render();
          return;
        }
        if (key.name === 'left') {
          if (this.cursor > 0) { this.cursor--; this.clampScroll(); this.render(); }
          return;
        }
        if (key.name === 'right') {
          if (this.cursor < this.buffer.length) { this.cursor++; this.clampScroll(); this.render(); }
          return;
        }
        if (key.name === 'home' || (key.ctrl && key.name === 'a')) { this.cursor = 0; this.clampScroll(); this.render(); return; }
        if (key.name === 'end' || (key.ctrl && key.name === 'e')) { this.cursor = this.buffer.length; this.clampScroll(); this.render(); return; }
        if (key.name === 'up') {
          if (this.history.length === 0) return;
          if (this.historyIndex === null) { this.draft = this.buffer; this.historyIndex = this.history.length - 1; }
          else if (this.historyIndex > 0) this.historyIndex--;
          this.buffer = this.history[this.historyIndex];
          this.cursor = this.buffer.length;
          this.clampScroll();
          this.render();
          return;
        }
        if (key.name === 'down') {
          if (this.historyIndex === null) return;
          this.historyIndex++;
          if (this.historyIndex >= this.history.length) {
            this.historyIndex = null;
            this.buffer = this.draft;
          } else {
            this.buffer = this.history[this.historyIndex];
          }
          this.cursor = this.buffer.length;
          this.clampScroll();
          this.render();
          return;
        }
        if (key.name === 'tab') {
          if (this.complete) {
            const hits = this.complete(this.buffer).filter((h) => h.startsWith(this.buffer));
            if (hits.length === 1) {
              this.buffer = hits[0];
              this.cursor = this.buffer.length;
              this.render();
            }
          }
          return;
        }
        if (key.name === 'escape') return;
        if (key.ctrl || key.meta) return;
        if (str && str.length > 0) {
          // Paste: collapse newlines into spaces so the single-line box stays intact
          const clean = str.replace(/\r\n/g, ' ').replace(/[\r\n]/g, ' ');
          this.buffer = this.buffer.slice(0, this.cursor) + clean + this.buffer.slice(this.cursor);
          this.cursor += clean.length;
          this.clampScroll();
          this.render();
        }
      };

      this.resizeHandler = () => {
        // redraw the whole box (top border may have been a different width)
        this.out.write('\r\x1b[2K\x1b[1A\r\x1b[2K');
        this.out.write(style.dimGreen(`╭${'─'.repeat(this.boxWidth())}╮`) + '\n');
        this.render();
      };

      this.stdin.on('keypress', this.keypressHandler);
      if ((this.out as any).on) {
        (this.out as any).on('resize', this.resizeHandler!);
      }

      this.render();
    });
  }

  private clampScroll(): void {
    const contentWidth = Math.max(4, this.boxWidth() - 6);
    // Ensure cursor is visible within the scrolling window
    if (this.cursor < this.scroll) this.scroll = this.cursor;
    if (this.cursor > this.scroll + contentWidth - 1) {
      this.scroll = this.cursor - contentWidth + 1;
    }
    if (this.scroll > this.buffer.length) this.scroll = this.buffer.length;
  }

  /** Clear the input row and print the closing border. */
  private finishRow(): void {
    this.out.write('\x1b[2K');
    this.out.write(style.dimGreen(`╰${'─'.repeat(this.boxWidth())}╯`) + '\n');
  }

  private render(): void {
    const width = this.boxWidth();
    const contentWidth = Math.max(4, width - 6);
    const visible = this.buffer.slice(this.scroll, this.scroll + contentWidth);
    const pad = ' '.repeat(Math.max(0, contentWidth - visible.length));
    const row =
      style.dimGreen('│') +
      ' ' +
      style.accentBold(glyphs.arrow) +
      ' ' +
      style.text(visible) +
      style.dim(pad) +
      style.dimGreen('│');
    this.out.write('\r\x1b[2K' + row);
    // Place cursor: 1 (border) + 1 (space) + 1 (❯) + 1 (space) = col 4 zero-based
    const cursorCol = 4 + (this.cursor - this.scroll);
    this.out.write(`\x1b[${cursorCol + 1}G`);
  }
}

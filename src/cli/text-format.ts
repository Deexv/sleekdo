/**
 * Streaming-safe terminal markdown formatter.
 *
 * Agent narration arrives as arbitrary deltas, so formatting per-delta would
 * split tokens (`**bo` + `ld**`). This buffers content and only formats
 * complete lines; the trailing partial line stays buffered until more input
 * arrives or flush() is called at end of turn.
 */
import { theme } from './theme.js';

export class StreamFormatter {
  private pending = '';
  private cols: number;

  constructor(cols?: number) {
    this.cols = Math.max(20, (cols || 80) - 4);
  }

  /** Feed a delta; returns formatted text ready to print (may be empty). */
  feed(delta: string): string {
    this.pending += delta;
    const parts = this.pending.split('\n');
    this.pending = parts.pop() ?? ''; // keep partial last line buffered
    return parts.map((l) => this.formatLine(l) ?? '').join('\n') + (parts.length > 0 ? '\n' : '');
  }

  /** Flush any buffered partial line (call at end of turn). */
  flush(): string {
    if (!this.pending) return '';
    const out = this.formatLine(this.pending) ?? '';
    this.pending = '';
    return out;
  }

  private formatLine(line: string): string | null {
    if (line.trim() === '') return '';
    let out = line.replace(/\s+$/, '');

    // Headings
    const heading = out.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      out = theme.accentBold(heading[2].trim());
      return this.wrap(out);
    }

    // Bullets: -, *, • → dim bullet
    out = out.replace(/^(\s*)[-*•]\s+/, `$1${theme.dim('•')} `);
    // Numbered list: keep the number, accent it
    out = out.replace(/^(\s*)(\d+)\.\s+/, `$1${theme.accent('$2.')} `);

    // Inline code first (protect its content from bold processing)
    const codeParts = out.split(/(`[^`]*`)/g);
    out = codeParts
      .map((p) => (p.startsWith('`') && p.endsWith('`') && p.length > 2 ? theme.accent(p.slice(1, -1)) : p))
      .join('');

    // Bold
    out = out.replace(/\*\*([^*]+)\*\*/g, (_, t) => theme.bold(t));
    // Italic (single asterisk, cautious)
    out = out.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s.,:;)]|$)/g, (_, pre, t) => pre + theme.italic(t));
    // Leftover literal ** pairs (unbalanced across chunk) → strip markers
    out = out.replace(/\*\*/g, '');

    return this.wrap(out);
  }

  /** Word-wrap to terminal width, preserving leading indentation. */
  private wrap(line: string): string {
    if (line.length <= this.cols) return line;
    const indentMatch = line.match(/^\s*/);
    const indent = indentMatch ? indentMatch[0] : '';
    const words = line.split(/\s+/);
    const rows: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? current + ' ' + word : word;
      if (candidate.length > this.cols && current) {
        rows.push(current);
        current = indent + word;
      } else {
        current = candidate;
      }
    }
    if (current) rows.push(current);
    return rows.join('\n');
  }
}

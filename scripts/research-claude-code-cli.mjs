/**
 * Research script: fetch Claude Code CLI interface documentation
 * and extract UI/UX patterns (prompt box, status lines, colors, layout).
 *
 * Usage: node scripts/research-claude-code-cli.mjs
 */
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

const SOURCES = [
  {
    name: 'interactive-mode',
    url: 'https://code.claude.com/docs/en/interactive-mode',
  },
  {
    name: 'cli-reference',
    url: 'https://code.claude.com/docs/en/cli-reference',
  },
  {
    name: 'terminal-config',
    url: 'https://code.claude.com/docs/en/terminal-config',
  },
  {
    name: 'slash-common',
    url: 'https://code.claude.com/docs/en/slash-commands',
  },
  {
    name: 'docs-index',
    url: 'https://code.claude.com/docs/en/quickstart',
  },
];

function fetch(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects'));
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (research script)' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, url).href;
          res.resume();
          return resolve(fetch(next, redirects + 1));
        }
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      })
      .on('error', reject);
  });
}

/** Crude HTML -> text: drop scripts/styles/tags, collapse whitespace */
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

const outDir = path.join(process.cwd(), '.sleekdo-research');
fs.mkdirSync(outDir, { recursive: true });
const report = [];

for (const src of SOURCES) {
  process.stdout.write(`Fetching ${src.url} ... `);
  try {
    const { status, body } = await fetch(src.src || src.url);
    if (status !== 200) {
      console.log(`HTTP ${status}`);
      report.push({ source: src.name, url: src.url, status, text: '' });
      continue;
    }
    const text = htmlToText(body);
    fs.writeFileSync(path.join(outDir, `${src.name}.txt`), text);
    console.log(`ok (${text.length} chars)`);
    report.push({ source: src.name, url: src.url, status, text });
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
    report.push({ source: src.name, url: src.url, status: 0, text: '', error: e.message });
  }
}

// Extract UI-relevant fragments
const INTERESTING = [
  /[^.]*prompt[^.]*box[^.]*\./gi,
  /[^.]*border[^.]*\./gi,
  /[^.]*spinner[^.]*\./gi,
  /[^.]*status line[^.]*\./gi,
  /[^.]*vim[^.]*mode[^.]*\./gi,
  /[^.]*theme[^.]*\./gi,
  /[^.]*color[^.]*\./gi,
  /[^.]*syntax highlight[^.]*\./gi,
  /[^.]*multiline[^.]*\./gi,
  /[^.]*tab[^.]*complet[^.]*\./gi,
  /[^.]*history[^.]*\./gi,
  /[^.]* ESC [^.]*\./gi,
  /[^.]*queue[^.]*message[^.]*\./gi,
  /[^.]*plan mode[^.]*\./gi,
];

const summaryLines = [];
for (const r of report) {
  if (!r.text) continue;
  summaryLines.push(`\n### ${r.source} (${r.url})`);
  const seen = new Set();
  for (const re of INTERESTING) {
    for (const m of r.text.match(re) || []) {
      const s = m.trim();
      if (s.length > 30 && s.length < 400 && !seen.has(s)) {
        seen.add(s);
        summaryLines.push(`- ${s}`);
      }
    }
  }
}

fs.writeFileSync(path.join(outDir, 'ui-patterns-summary.md'), summaryLines.join('\n'));
console.log(`\nSaved raw pages + ui-patterns-summary.md to ${outDir}`);
console.log(`\n=== EXTRACTED UI PATTERNS (first 120 lines) ===`);
console.log(summaryLines.slice(0, 120).join('\n'));

// ─── Extended research: how Ink/claude-code render input ───
async function researchExtra() {
  const extra = [
    { name: 'ink-readme', url: 'https://raw.githubusercontent.com/vadimdemedes/ink/master/readme.md' },
    { name: 'claude-code-fullscreen', url: 'https://code.claude.com/docs/en/interactive-mode#fullscreen-rendering' },
  ];
  const lines = ['\n### INPUT RENDERING RESEARCH'];
  for (const src of extra) {
    try {
      const { status, body } = await fetch(src.url);
      const text = src.url.includes('raw.githubusercontent') ? body : htmlToText(body);
      fs.writeFileSync(path.join(outDir, src.name + '.txt'), text);
      lines.push(`\n#### ${src.name} (${status})`);
      // grab fragments about input, raw mode, cursor, alt screen
      for (const kw of ['raw mode', 'alternate screen', 'cursor', 'input box', 'fullscreen', 'Static', 'rerender', 'cursorTo', 'clearLine']) {
        const idx = text.toLowerCase().indexOf(kw.toLowerCase());
        if (idx >= 0) {
          lines.push(`- [${kw}] …${text.slice(Math.max(0, idx - 100), idx + 250).replace(/\s+/g, ' ')}…`);
        }
      }
    } catch (e) {
      lines.push(`\n#### ${src.name} FAILED: ${e.message}`);
    }
  }
  fs.appendFileSync(path.join(outDir, 'ui-patterns-summary.md'), lines.join('\n'));
  console.log(lines.join('\n').slice(0, 3000));
}
await researchExtra();

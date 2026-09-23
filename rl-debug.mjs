import readline from 'node:readline';
import fs from 'node:fs';
const log = (m) => { fs.appendFileSync('rl-debug.log', m + '\n'); process.stderr.write(m + '\n'); };
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true, historySize: 200, prompt: '' });
const queue = [];
let resolver = null;
rl.on('line', (l) => { log('LINE: ' + JSON.stringify(l)); if (resolver) { const r = resolver; resolver = null; r(l); } else queue.push(l); });
rl.on('close', () => log('CLOSE'));
async function ask(name) {
  log('ASK ' + name);
  const v = await new Promise((res) => {
    if (queue.length > 0) { log('FROM QUEUE: ' + queue[0]); res(queue.shift()); }
    else { resolver = res; rl.prompt(); }
  });
  log('GOT(' + name + '): ' + JSON.stringify(v));
  return v;
}
log('start');
const a = await ask('startup');
log('busy after startup...');
await new Promise(r => setTimeout(r, 500));
const b = await ask('second');
await new Promise(r => setTimeout(r, 500));
const c = await ask('third');
log('done');
process.exit(0);

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/home/user/RutgerCv/chess/package.json');
const { Chess } = require('chess.js');
const games = JSON.parse(readFileSync('cal.json'));
const p = spawn('node', ['/home/user/RutgerCv/chess/node_modules/stockfish/bin/stockfish-19-lite-single.js'], { cwd: '/home/user/RutgerCv/chess/node_modules/stockfish/bin' });
let buf = '', lines = new Map(), resolver = null;
p.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
  if (l === 'readyok' && resolver) { resolver(); resolver = null; }
  const m = l.match(/depth (\d+).*?multipv (\d+) score (cp|mate) (-?\d+).*? pv (\S+)/);
  if (m && !/bound/.test(l)) lines.set(+m[2], { cp: m[3] === 'cp' ? +m[4] : null, mate: m[3] === 'mate' ? +m[4] : null, mv: m[5] });
  if (l.startsWith('bestmove') && resolver) { resolver(); resolver = null; } } });
const cmd = (c) => p.stdin.write(c + '\n');
const wait = () => new Promise((r) => (resolver = r));
cmd('uci'); cmd('setoption name MultiPV value 2'); cmd('isready'); await wait();
const out = [];
for (const g of games) {
  const c = new Chess(); c.loadPgn(g.pgn);
  const moves = c.history({ verbose: true });
  const fens = [moves[0].before, ...moves.map((m) => m.after)];
  const pos = [];
  for (const fen of fens) {
    const t = new Chess(fen);
    if (t.isGameOver()) { pos.push({ fen, term: t.isCheckmate() ? (t.turn() === 'w' ? 'wmated' : 'bmated') : 'draw' }); continue; }
    lines.clear(); cmd('position fen ' + fen); cmd('go depth 14'); await wait();
    const sign = fen.split(' ')[1] === 'b' ? -1 : 1;
    const conv = (l) => l && { cp: l.cp == null ? null : l.cp * sign, mate: l.mate == null ? null : l.mate * sign, mv: l.mv };
    pos.push({ fen, l1: conv(lines.get(1)), l2: conv(lines.get(2)) });
  }
  out.push({ url: g.url, acc: g.acc, white: g.white.username, black: g.black.username, moves: moves.map((m) => ({ san: m.san, color: m.color, uci: m.from + m.to + (m.promotion ?? '') })), pos });
  writeFileSync('harvest.json', JSON.stringify(out)); console.log('done', out.length, g.url);
}
cmd('quit');

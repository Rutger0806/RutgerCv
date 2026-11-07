// Controleert dat alle cursuszetten legaal zijn.
// Gebruik: node --experimental-strip-types scripts/check-courses.mjs
import { Chess } from 'chess.js';
const { COURSES, buildTree } = await import(new URL('../src/courses.ts', import.meta.url));
let bad = 0;
for (const c of COURSES) {
  const walk = (node, chess, path) => {
    for (const k of node.kids) {
      const g = new Chess(chess.fen());
      try { g.move(k.san); } catch { console.log('ONLEGAAL', c.id, [...path, k.san].join(' ')); bad++; continue; }
      walk(k, g, [...path, k.san]);
    }
  };
  const tree = buildTree(c);
  walk(tree, new Chess(), []);
  for (const b of c.branches) {
    const oppIsWhite = c.side === 'black';
    const firstIsWhite = b.from % 2 === 0;
    if (!b.own && b.steps.length && firstIsWhite !== oppIsWhite) { console.log('FOUTE KLEUR variant', c.id, b.title); bad++; }
  }
  const nodes = (n) => 1 + n.kids.reduce((s, k) => s + nodes(k), 0);
  const noted = (n) => (n.note ? 1 : 0) + n.kids.reduce((s, k) => s + noted(k), 0);
  console.log(c.id.padEnd(14), 'zetten', String(nodes(tree) - 1).padStart(3), 'met uitleg', String(noted(tree)).padStart(3));
}
console.log(bad ? `${bad} problemen` : 'alles legaal');
process.exit(bad ? 1 : 0);

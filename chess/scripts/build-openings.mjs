// Haalt de Lichess openingsdatabase (ECO) op en maakt public/data/openings.json
// Gebruik: node scripts/build-openings.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
const base = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master/';
const out = [];
for (const l of 'abcde') {
  const txt = await (await fetch(`${base}${l}.tsv`)).text();
  for (const row of txt.trim().split('\n').slice(1)) {
    const [eco, name, pgn] = row.split('\t');
    const moves = pgn.replace(/\d+\.(\.\.)?/g, '').trim().split(/\s+/).join(' ');
    out.push([eco, name, moves]);
  }
}
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/openings.json', JSON.stringify(out));
console.log(out.length, 'openingen');

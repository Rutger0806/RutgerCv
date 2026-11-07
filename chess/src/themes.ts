import { Chess } from 'chess.js';
import { BAD, moverWin, type Cls, type GameAnalysis, type ParsedGame } from './analysis';
import type { Book } from './book';
import { fenKey, uciToSan } from './util';

export type Theme = 'allowmate' | 'hang' | 'missedmate' | 'missedtactic' | 'threw' | 'opening' | 'endgame' | 'positional';
export type Phase = 'opening' | 'middle' | 'end';

export const THEMES: Record<Theme, { name: string; icon: string; advice: string }> = {
  allowmate: {
    name: 'Mat toegestaan',
    icon: 'skull',
    advice: 'Vóór elke zet: welke schaakjes kan mijn tegenstander geven na mijn zet? Check altijd: schaken, slaan, dreigen, ook voor je tegenstander.',
  },
  hang: {
    name: 'Stukken weggegeven',
    icon: 'gift',
    advice: 'Na je gekozen zet, vraag: wordt iets van mij aangevallen en niet (genoeg) beschermd? Tel aanvallers en verdedigers voordat je loslaat.',
  },
  missedmate: {
    name: 'Mat gemist',
    icon: 'target',
    advice: 'Als de tegenstander zwak staat: zoek eerst alle schaakjes. Veel matcombinaties beginnen met een schaak of een offer.',
  },
  missedtactic: {
    name: 'Gemiste tactiek',
    icon: 'magnifying-glass',
    advice: 'Gebruik de routine CCT: Checks, Captures, Threats, voor beide kanten, voordat je een rustige zet kiest.',
  },
  threw: {
    name: 'Winst weggegeven',
    icon: 'trend-down',
    advice: 'Sta je beter? Vereenvoudig: ruil stukken, neem geen risico, en vraag bij elke zet wat de tegenstander nog kan.',
  },
  opening: {
    name: 'Fouten in de opening',
    icon: 'book-open',
    advice: 'Leer de belangrijkste lijnen van je repertoire beter en let op de eerste afwijkingen van je tegenstander.',
  },
  endgame: {
    name: 'Fouten in het eindspel',
    icon: 'flag-checkered',
    advice: 'Oefen basis-eindspelen (opposities, Lucena, Philidor): daar win of verlies je halve punten.',
  },
  positional: {
    name: 'Positionele onnauwkeurigheden',
    icon: 'compass',
    advice: 'Denk aan plan en activiteit: breng stukken naar actieve velden, vermijd onnodige pionzetten en houd je koning veilig.',
  },
};

export interface Issue {
  gameIdx: number;
  ply: number; // 1-based
  san: string;
  loss: number;
  cls: Cls;
  theme: Theme;
  phase: Phase;
  fen: string;
  best: string | null;
  bestSan: string | null;
}

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

export function phaseOf(fen: string, ply: number): Phase {
  if (ply <= 20) return 'opening';
  let mat = 0;
  for (const ch of fen.split(' ')[0]) {
    const v = VAL[ch.toLowerCase()];
    if (v && ch.toLowerCase() !== 'p') mat += v;
  }
  return mat <= 24 ? 'end' : 'middle';
}

export function diagnose(g: ParsedGame, an: GameAnalysis, i: number, gameIdx: number): Issue {
  const m = g.moves[i];
  const white = m.color === 'w';
  const fen = g.fens[i];
  const best = an.best[i];
  const bestSan = best ? uciToSan(fen, best) : null;
  const before = moverWin(an.evals[i], white);
  const after = moverWin(an.evals[i + 1], white);
  const phase = phaseOf(fen, i + 1);
  let theme: Theme = 'positional';

  const evAfter = an.evals[i + 1];
  const evBefore = an.evals[i];
  const matedAfter = evAfter.mate != null && evAfter.mate !== 0 && evAfter.mate < 0 === white;
  const mateBefore = evBefore.mate != null && evBefore.mate !== 0 && evBefore.mate > 0 === white;

  // wat kan de tegenstander nu slaan?
  let hangs = false;
  const reply = an.best[i + 1];
  if (reply) {
    try {
      const rm = new Chess(g.fens[i + 1]).move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] });
      if (rm.captured && VAL[rm.captured] >= 3) hangs = true;
    } catch {
      /* negeer */
    }
  }
  // wat miste je?
  let missCapture = false;
  let missCheck = false;
  if (best) {
    try {
      const bc = new Chess(fen);
      const bm = bc.move({ from: best.slice(0, 2), to: best.slice(2, 4), promotion: best[4] });
      if (bm.captured && VAL[bm.captured] >= 3) missCapture = true;
      if (bm.san.includes('+') || bm.san.includes('#')) missCheck = true;
    } catch {
      /* negeer */
    }
  }

  if (matedAfter) theme = 'allowmate';
  else if (hangs) theme = 'hang';
  else if (mateBefore) theme = 'missedmate';
  else if (missCapture || missCheck) theme = 'missedtactic';
  else if (before >= 75 && after < 55) theme = 'threw';
  else if (phase === 'opening') theme = 'opening';
  else if (phase === 'end') theme = 'endgame';

  return { gameIdx, ply: i + 1, san: m.san, loss: an.loss[i], cls: an.cls[i], theme, phase, fen, best, bestSan };
}

/** Alle slechte zetten van mijn kleur in één partij. */
export function issuesFor(g: ParsedGame, an: GameAnalysis, color: 'w' | 'b', gameIdx: number): Issue[] {
  const out: Issue[] = [];
  g.moves.forEach((m, i) => {
    if (m.color === color && BAD.includes(an.cls[i]) && an.best[i]) out.push(diagnose(g, an, i, gameIdx));
  });
  return out;
}

export interface OpeningLeak {
  gameIdx: number;
  openingName: string;
  mySan: string;
  bookSan: string;
  line: string[]; // zetten tot en met de boekzet
  side: 'white' | 'black';
}

/** Eerste keer dat ik uit de theorie ging met een duidelijk slechtere zet. */
export function openingLeak(g: ParsedGame, an: GameAnalysis, color: 'w' | 'b', book: Book, gameIdx: number): OpeningLeak | null {
  for (let i = 0; i < Math.min(g.moves.length, 24); i++) {
    const m = g.moves[i];
    const moves = book.next.get(fenKey(g.fens[i]));
    if (!moves) break; // al buiten de theorie
    if (m.color !== color) continue;
    const uci = m.from + m.to + (m.promotion ?? '');
    if (moves.has(uci)) continue;
    if (an.loss[i] < 5) return null;
    const top = [...moves.values()].sort((a, b) => b.count - a.count)[0];
    let name = '';
    for (let k = i; k >= 0; k--) {
      const nm = book.nameAt.get(fenKey(g.fens[k]));
      if (nm) {
        name = nm.name;
        break;
      }
    }
    return {
      gameIdx,
      openingName: name || 'Opening',
      mySan: m.san,
      bookSan: top.san,
      line: [...g.moves.slice(0, i).map((x) => x.san), top.san],
      side: color === 'w' ? 'white' : 'black',
    };
  }
  return null;
}

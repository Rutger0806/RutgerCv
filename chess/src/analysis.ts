import { Chess, type Move } from 'chess.js';
import { batchEngine, evWin, lineToEv, terminalEv, type Ev } from './engine';
import { fenKey } from './util';
import type { Book } from './book';

export type Cls = 'brilliant' | 'great' | 'book' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'miss' | 'mistake' | 'blunder';

export const CLS_INFO: Record<Cls, { label: string; sym: string; mark: string; color: string }> = {
  brilliant: { label: 'Briljant', sym: '!!', mark: '!!', color: '#1baca6' },
  great: { label: 'Geweldig', sym: '!', mark: '!', color: '#5c8bb0' },
  book: { label: 'Theorie', sym: 'B', mark: 'B', color: '#a88865' },
  best: { label: 'Beste', sym: '★', mark: '★', color: '#7fa650' },
  excellent: { label: 'Uitstekend', sym: '✓', mark: '✓', color: '#96bc4b' },
  good: { label: 'Goed', sym: '•', mark: '✓', color: '#9aa4ad' },
  inaccuracy: { label: 'Onnauwkeurig', sym: '?!', mark: '?!', color: '#e0a800' },
  miss: { label: 'Gemiste kans', sym: '✗', mark: '✗', color: '#e0707a' },
  mistake: { label: 'Fout', sym: '?', mark: '?', color: '#e58f2a' },
  blunder: { label: 'Blunder', sym: '??', mark: '??', color: '#ca3431' },
};

export const BAD: Cls[] = ['inaccuracy', 'miss', 'mistake', 'blunder'];
export const KEY: Cls[] = ['brilliant', 'great', 'inaccuracy', 'miss', 'mistake', 'blunder'];

export interface ParsedGame {
  headers: Record<string, string>;
  moves: Move[];
  fens: string[]; // n+1 stellingen
}

export function parseGame(pgn: string): ParsedGame {
  const c = new Chess();
  c.loadPgn(pgn.trim());
  const headers = c.header() as Record<string, string>;
  const moves = c.history({ verbose: true });
  const fens = [moves.length ? moves[0].before : c.fen()];
  for (const m of moves) fens.push(m.after);
  return { headers, moves, fens };
}

export interface GameAnalysis {
  evals: Ev[]; // per stelling, vanuit wit
  alt: (Ev | null)[]; // tweede beste lijn per stelling (vanuit wit)
  best: (string | null)[]; // beste zet (uci) per stelling voor de speler aan zet
  cls: Cls[]; // per zet (index i hoort bij zet i+1)
  loss: number[]; // winkansverlies in % voor de zettende partij
  acc: { w: number; b: number };
  depth: number;
}

export const moverWin = (ev: Ev, white: boolean) => (white ? evWin(ev) : 100 - evWin(ev));

/**
 * Drempels (winkans-verlies in %) en nauwkeurigheidsformule, gekalibreerd op
 * Chess.com Game Review: 26 partij-kanten met bekende nauwkeurigheid (rating ~1000-1100)
 * en de labels van één partij. Zie chess/README.md.
 */
export const T = { inaccuracy: 5, mistake: 12, blunder: 26, greatGap: 25, missPrev: 12, accK: 0.16 };

export function classify(loss: number, isBest: boolean): Cls {
  if (isBest || loss < 0.5) return 'best';
  if (loss < 2) return 'excellent';
  if (loss < T.inaccuracy) return 'good';
  if (loss < T.mistake) return 'inaccuracy';
  if (loss < T.blunder) return 'mistake';
  return 'blunder';
}

const accOf = (loss: number) => 100 * Math.exp(-T.accK * loss);

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
export const PIECE_NL: Record<string, string> = { p: 'pion', n: 'paard', b: 'loper', r: 'toren', q: 'dame', k: 'koning' };

/** Is dit een offer? (stuk op een aangevallen veld dat meer waard is dan wat het pakt) */
export function isSacrifice(m: Move): boolean {
  if (m.promotion || m.piece === 'k' || m.piece === 'p') return false;
  const c = new Chess(m.after);
  const opp = m.color === 'w' ? 'b' : 'w';
  const att = c.attackers(m.to, opp);
  if (!att.length) return false;
  const vm = VAL[m.piece];
  const vc = m.captured ? VAL[m.captured] : 0;
  const minAtt = Math.min(...att.map((s) => VAL[c.get(s)!.type]));
  const defended = c.attackers(m.to, m.color).length > 0;
  const net = vm - vc - (defended ? minAtt : 0);
  return net >= 2 && vm >= 3;
}

export function summarize(
  g: ParsedGame,
  evals: Ev[],
  best: (string | null)[],
  book: Book | null,
  depth: number,
  alt: (Ev | null)[] = [],
): GameAnalysis {
  const cls: Cls[] = [];
  const loss: number[] = [];
  const accs = { w: [] as number[], b: [] as number[] };
  g.moves.forEach((m, i) => {
    const white = m.color === 'w';
    const before = moverWin(evals[i], white);
    const after = moverWin(evals[i + 1], white);
    const l = Math.max(0, before - after);
    const uci = m.from + m.to + (m.promotion ?? '');
    const isBest = best[i] === uci;
    let c = classify(l, isBest);
    const prevLoss = i > 0 ? loss[i - 1] : 0;
    const second = alt[i] ? moverWin(alt[i]!, white) : null;
    const gap = second != null ? moverWin(evals[i], white) - second : 0;
    const prevMove = i > 0 ? g.moves[i - 1] : null;
    const recapture = !!(m.captured && prevMove?.captured && prevMove.to === m.to);
    if (c === 'best' || c === 'excellent') {
      if ((isBest || l < 2) && isSacrifice(m) && after >= 45 && before <= 92 && after >= before - 3) c = 'brilliant';
      else if (isBest && gap >= T.greatGap && !recapture) c = 'great';
    }
    // Chess.com: een slechte zet direct nadat de tegenstander fouten maakte terwijl jij beter stond = "Miss"
    if ((c === 'inaccuracy' || c === 'mistake' || c === 'blunder') && prevLoss >= T.missPrev && before >= 50) c = 'miss';
    if (book && i < 24 && book.next.get(fenKey(g.fens[i]))?.has(uci)) c = 'book';
    cls.push(c);
    loss.push(l);
    (white ? accs.w : accs.b).push(accOf(l));
  });
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return { evals, alt, best, cls, loss, acc: { w: mean(accs.w), b: mean(accs.b) }, depth };
}

/** Analyseer alle stellingen van een partij (2 lijnen, voor "geweldige" zetten). */
export async function analyseGame(
  g: ParsedGame,
  depth: number,
  book: Book | null,
  onProgress: (done: number, total: number) => void,
  shouldStop: () => boolean,
): Promise<GameAnalysis | null> {
  const eng = batchEngine();
  const evals: Ev[] = [];
  const alt: (Ev | null)[] = [];
  const best: (string | null)[] = [];
  for (let i = 0; i < g.fens.length; i++) {
    if (shouldStop()) return null;
    const term = terminalEv(g.fens[i]);
    if (term) {
      evals.push(term);
      alt.push(null);
      best.push(null);
    } else {
      const lines = await eng.analyse(g.fens[i], { depth, multipv: 2 });
      if (shouldStop()) return null;
      const l = lines[0];
      evals.push(l ? lineToEv(l) : { cp: 0, mate: null });
      alt.push(lines[1] ? lineToEv(lines[1]) : null);
      best.push(l?.pv[0] ?? null);
    }
    onProgress(i + 1, g.fens.length);
  }
  return summarize(g, evals, best, book, depth, alt);
}

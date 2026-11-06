import { Chess, type Move } from 'chess.js';
import { batchEngine, evWin, lineToEv, terminalEv, type Ev } from './engine';
import { fenKey } from './util';
import type { Book } from './book';

export type Cls = 'book' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export const CLS_INFO: Record<Cls, { label: string; sym: string; color: string }> = {
  book: { label: 'Theorie', sym: '📖', color: '#a88865' },
  best: { label: 'Beste', sym: '★', color: '#7fa650' },
  excellent: { label: 'Uitstekend', sym: '✓', color: '#96bc4b' },
  good: { label: 'Goed', sym: '•', color: '#9aa4ad' },
  inaccuracy: { label: 'Onnauwkeurig', sym: '?!', color: '#f7c631' },
  mistake: { label: 'Fout', sym: '?', color: '#e58f2a' },
  blunder: { label: 'Blunder', sym: '??', color: '#ca3431' },
};

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
  best: (string | null)[]; // beste zet (uci) per stelling voor de speler aan zet
  cls: Cls[]; // per zet (index i hoort bij zet i+1)
  loss: number[]; // winkansverlies in % voor de zettende partij
  acc: { w: number; b: number };
  depth: number;
}

export const moverWin = (ev: Ev, white: boolean) => (white ? evWin(ev) : 100 - evWin(ev));

export function classify(loss: number, isBest: boolean): Cls {
  if (isBest || loss < 0.5) return 'best';
  if (loss < 2) return 'excellent';
  if (loss < 5) return 'good';
  if (loss < 10) return 'inaccuracy';
  if (loss < 20) return 'mistake';
  return 'blunder';
}

const accOf = (loss: number) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));

export function summarize(g: ParsedGame, evals: Ev[], best: (string | null)[], book: Book | null, depth: number): GameAnalysis {
  const cls: Cls[] = [];
  const loss: number[] = [];
  const accs = { w: [] as number[], b: [] as number[] };
  g.moves.forEach((m, i) => {
    const white = m.color === 'w';
    const before = moverWin(evals[i], white);
    const after = moverWin(evals[i + 1], white);
    const l = Math.max(0, before - after);
    const uci = m.from + m.to + (m.promotion ?? '');
    let c = classify(l, best[i] === uci);
    if (book && i < 24 && book.next.get(fenKey(g.fens[i]))?.has(uci)) c = 'book';
    cls.push(c);
    loss.push(l);
    (white ? accs.w : accs.b).push(accOf(l));
  });
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return { evals, best, cls, loss, acc: { w: mean(accs.w), b: mean(accs.b) }, depth };
}

/** Analyseer alle stellingen van een partij. */
export async function analyseGame(
  g: ParsedGame,
  depth: number,
  book: Book | null,
  onProgress: (done: number, total: number) => void,
  shouldStop: () => boolean,
): Promise<GameAnalysis | null> {
  const eng = batchEngine();
  const evals: Ev[] = [];
  const best: (string | null)[] = [];
  for (let i = 0; i < g.fens.length; i++) {
    if (shouldStop()) return null;
    const term = terminalEv(g.fens[i]);
    if (term) {
      evals.push(term);
      best.push(null);
    } else {
      const lines = await eng.analyse(g.fens[i], { depth, multipv: 1 });
      if (shouldStop()) return null;
      const l = lines[0];
      evals.push(l ? lineToEv(l) : { cp: 0, mate: null });
      best.push(l?.pv[0] ?? null);
    }
    onProgress(i + 1, g.fens.length);
  }
  return summarize(g, evals, best, book, depth);
}

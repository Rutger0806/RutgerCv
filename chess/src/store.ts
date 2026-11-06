import { load, save } from './util';

export interface Settings {
  chesscom: string;
  lichess: string;
  depth: number;
}
export const settings = (): Settings => ({ chesscom: '', lichess: '', depth: 16, ...load<Partial<Settings>>('settings', {}) });
export const saveSettings = (s: Settings) => save('settings', s);

/* ---------- puzzels / fouten met herhaling ---------- */
export interface Puzzle {
  id: string;
  fen: string;
  /** uci-zetten. Bij setup=true is de eerste zet van de tegenstander. */
  moves: string[];
  setup: boolean;
  title: string;
  source: 'mistake' | 'import';
  tags?: string[];
  rating?: number;
  box: number;
  due: number;
  solved: number;
  failed: number;
}

const DAYS = [0, 1, 3, 7, 16, 35, 90];
export const puzzles = () => load<Puzzle[]>('puzzles', []);
export const savePuzzles = (p: Puzzle[]) => save('puzzles', p);

export function addPuzzles(items: Omit<Puzzle, 'box' | 'due' | 'solved' | 'failed'>[]): number {
  const cur = puzzles();
  const byId = new Map(cur.map((p) => [p.id, p]));
  let n = 0;
  for (const it of items) {
    const ex = byId.get(it.id);
    if (ex) {
      ex.tags = [...new Set([...(ex.tags ?? []), ...(it.tags ?? [])])];
      continue;
    }
    const p: Puzzle = { ...it, box: 0, due: 0, solved: 0, failed: 0 };
    cur.push(p);
    byId.set(p.id, p);
    n++;
  }
  savePuzzles(cur);
  return n;
}

export function recordPuzzle(id: string, success: boolean) {
  const all = puzzles();
  const p = all.find((x) => x.id === id);
  if (!p) return;
  if (success) {
    p.solved++;
    p.box = Math.min(DAYS.length - 1, p.box + 1);
  } else {
    p.failed++;
    p.box = 0;
  }
  p.due = Date.now() + DAYS[p.box] * 86400000;
  savePuzzles(all);
}

/* ---------- repertoire ---------- */
export interface RepLine {
  id: string;
  eco: string;
  name: string;
  san: string[];
  side: 'white' | 'black';
}
export const repertoire = () => load<RepLine[]>('repertoire', []);
export const saveRepertoire = (r: RepLine[]) => save('repertoire', r);

/* ---------- opgeslagen analyses ---------- */
export interface SavedGame {
  id: string;
  title: string;
  date: number;
  pgn: string;
  evals: [number, number | null][];
  best: (string | null)[];
  alt?: ([number, number | null] | null)[];
  depth: number;
}
export const savedGames = () => load<SavedGame[]>('games', []);
export const saveGames = (g: SavedGame[]) => save('games', g);

export function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

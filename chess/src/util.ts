import { Chess } from 'chess.js';

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const $ = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) =>
  root.querySelector(sel) as T;

/** Positie-sleutel zonder zetteller, zodat transposities matchen. */
export const fenKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function uciToSan(fen: string, uci: string): string | null {
  try {
    const c = new Chess(fen);
    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return m.san;
  } catch {
    return null;
  }
}

/** Zet een PV (uci-lijst) om naar SAN met zetnummers. */
export function pvToSan(fen: string, pv: string[], max = 10): string {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const u of pv.slice(0, max)) {
    const white = c.turn() === 'w';
    let m;
    try {
      m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    } catch {
      break;
    }
    const n = c.moveNumber() - (white ? 0 : 1);
    if (white) out.push(`${n}.${m.san}`);
    else out.push(out.length === 0 ? `${n}...${m.san}` : m.san);
  }
  return out.join(' ');
}

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('rc.' + key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem('rc.' + key, JSON.stringify(value));
  } catch {
    /* vol of geblokkeerd */
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function fmtEval(cp: number | null, mate: number | null): string {
  if (mate != null) return mate === 0 ? '#' : `${mate > 0 ? '' : '-'}M${Math.abs(mate)}`;
  if (cp == null) return '…';
  if (Math.abs(cp) >= 50000) return cp > 0 ? '1-0' : '0-1';
  const v = cp / 100;
  return (v > 0 ? '+' : '') + v.toFixed(2);
}

/** Winkans (0-100) voor wit op basis van centipawns (Lichess-formule). */
export const winPct = (cp: number) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

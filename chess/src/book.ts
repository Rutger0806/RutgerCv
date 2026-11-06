import { Chess } from 'chess.js';
import { fenKey } from './util';

export interface Opening {
  eco: string;
  name: string;
  san: string[];
}

export interface BookMove {
  uci: string;
  san: string;
  count: number;
  /** Kortste openingsnaam waar deze zet in voorkomt. */
  sample: Opening;
}

export interface Book {
  list: Opening[];
  /** positie -> opening die precies daar eindigt */
  nameAt: Map<string, Opening>;
  /** positie -> volgende boekzetten */
  next: Map<string, Map<string, BookMove>>;
}

let cache: Promise<Book> | null = null;

export function loadBook(): Promise<Book> {
  cache ??= (async () => {
    const rows: [string, string, string][] = await (
      await fetch(`${import.meta.env.BASE_URL}data/openings.json`)
    ).json();
    const list: Opening[] = rows.map(([eco, name, moves]) => ({ eco, name, san: moves.split(' ') }));
    const nameAt = new Map<string, Opening>();
    const next = new Map<string, Map<string, BookMove>>();
    const chess = new Chess();
    for (const op of list) {
      chess.reset();
      for (const san of op.san) {
        const before = fenKey(chess.fen());
        let m;
        try {
          m = chess.move(san);
        } catch {
          break;
        }
        const uci = m.from + m.to + (m.promotion ?? '');
        let map = next.get(before);
        if (!map) next.set(before, (map = new Map()));
        const e = map.get(uci);
        if (e) {
          e.count++;
          if (op.name.length < e.sample.name.length) e.sample = op;
        } else map.set(uci, { uci, san: m.san, count: 1, sample: op });
      }
      const k = fenKey(chess.fen());
      const prev = nameAt.get(k);
      if (!prev || op.name.length < prev.name.length) nameAt.set(k, op);
    }
    return { list, nameAt, next };
  })();
  return cache;
}

/** Lijst boekzetten, meest voorkomende eerst. */
export function bookMoves(book: Book, fen: string): BookMove[] {
  const m = book.next.get(fenKey(fen));
  return m ? [...m.values()].sort((a, b) => b.count - a.count) : [];
}

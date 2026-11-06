import { Chess } from 'chess.js';
import { winPct } from './util';

/** Eén regel (variant) van de engine, altijd vanuit het gezichtspunt van WIT. */
export interface PvLine {
  multipv: number;
  depth: number;
  cp: number | null;
  mate: number | null;
  pv: string[];
}

/** Uitkomst van een stelling vanuit wit. mate>0: wit geeft mat. */
export interface Ev {
  cp: number;
  mate: number | null;
}

export const lineToEv = (l: PvLine): Ev => ({ cp: l.cp ?? 0, mate: l.mate });

/** Winkans voor wit (0-100). */
export function evWin(e: Ev): number {
  if (e.mate != null) return e.mate > 0 ? 100 : e.mate < 0 ? 0 : 50;
  return winPct(e.cp);
}

interface Job {
  fen: string;
  depth?: number;
  movetime?: number;
  multipv: number;
  onInfo?: (lines: PvLine[]) => void;
  resolve: (lines: PvLine[]) => void;
  lines: Map<number, PvLine>;
}

const ENGINE_URL = `${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`;

export class Engine {
  private w: Worker;
  private cur: Job | null = null;
  private next: Job | null = null;
  private ready: Promise<void>;

  constructor() {
    this.w = new Worker(ENGINE_URL);
    this.ready = new Promise((resolve) => {
      const h = (e: MessageEvent) => {
        const line = String(e.data);
        if (line.startsWith('readyok')) {
          resolve();
        }
      };
      this.w.addEventListener('message', h);
    });
    this.w.addEventListener('message', (e) => this.onLine(String(e.data)));
    this.send('uci');
    this.send('setoption name Hash value 32');
    this.send('isready');
  }

  private send(cmd: string) {
    this.w.postMessage(cmd);
  }

  analyse(
    fen: string,
    opts: { depth?: number; movetime?: number; multipv?: number; onInfo?: (l: PvLine[]) => void } = {},
  ): Promise<PvLine[]> {
    return new Promise((resolve) => {
      const job: Job = {
        fen,
        depth: opts.depth,
        movetime: opts.movetime,
        multipv: opts.multipv ?? 1,
        onInfo: opts.onInfo,
        resolve,
        lines: new Map(),
      };
      if (this.next) this.next.resolve([]);
      this.next = job;
      if (this.cur) this.send('stop');
      else void this.pump();
    });
  }

  stop() {
    if (this.next) {
      this.next.resolve([]);
      this.next = null;
    }
    if (this.cur) this.send('stop');
  }

  private async pump() {
    if (this.cur || !this.next) return;
    const job = this.next;
    this.next = null;
    this.cur = job;
    await this.ready;
    this.send(`setoption name MultiPV value ${job.multipv}`);
    this.send(`position fen ${job.fen}`);
    this.send(job.movetime ? `go movetime ${job.movetime}` : `go depth ${job.depth ?? 14}`);
  }

  private onLine(line: string) {
    const job = this.cur;
    if (!job) return;
    if (line.startsWith('info') && line.includes(' pv ') && line.includes(' score ')) {
      if (/\b(lowerbound|upperbound)\b/.test(line)) return;
      const m = line.match(/depth (\d+).*?multipv (\d+) score (cp|mate) (-?\d+).*? pv (.+)$/);
      if (!m) return;
      const sign = job.fen.split(' ')[1] === 'b' ? -1 : 1;
      const val = parseInt(m[4], 10) * sign;
      const pl: PvLine = {
        multipv: parseInt(m[2], 10),
        depth: parseInt(m[1], 10),
        cp: m[3] === 'cp' ? val : null,
        mate: m[3] === 'mate' ? val : null,
        pv: m[5].trim().split(/\s+/),
      };
      job.lines.set(pl.multipv, pl);
      job.onInfo?.(sorted(job.lines));
    } else if (line.startsWith('bestmove')) {
      this.cur = null;
      job.resolve(sorted(job.lines));
      void this.pump();
    }
  }

  terminate() {
    this.w.terminate();
  }
}

const sorted = (m: Map<number, PvLine>) => [...m.values()].sort((a, b) => a.multipv - b.multipv);

/** Stelling zonder zetten: mat of remise bepalen zonder engine. */
export function terminalEv(fen: string): Ev | null {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { cp: c.turn() === 'w' ? -100000 : 100000, mate: null };
  if (c.isDraw() || c.isStalemate()) return { cp: 0, mate: null };
  return null;
}

let live: Engine | null = null;
let batch: Engine | null = null;
export const liveEngine = () => (live ??= new Engine());
export const batchEngine = () => (batch ??= new Engine());

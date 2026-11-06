import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import type { DrawShape } from 'chessground/draw';
import { Chess } from 'chess.js';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

export interface UserMove {
  from: string;
  to: string;
  promotion?: string;
}

export interface Arrow {
  from: string;
  to: string;
  color?: string;
}

export interface ShowOpts {
  lastMove?: [string, string] | null;
  orientation?: 'white' | 'black';
  /** Welke kleur mag de gebruiker verzetten? null = bord is vergrendeld. */
  movable?: 'white' | 'black' | 'both' | null;
  arrows?: Arrow[];
  badge?: { sq: string; text: string; color: string } | null;
}

const toShapes = (arrows: Arrow[], badge?: ShowOpts['badge']): DrawShape[] => {
  const out: DrawShape[] = arrows.map((a) => ({ orig: a.from as Key, dest: a.to as Key, brush: a.color ?? 'green' }));
  if (badge) {
    out.push({
      orig: badge.sq as Key,
      customSvg: {
        html: `<g transform="translate(62,2)"><circle cx="18" cy="18" r="18" fill="${badge.color}" stroke="#fff" stroke-width="2"/><text x="18" y="25" font-size="${badge.text.length > 1 ? 18 : 22}" font-weight="800" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">${badge.text}</text></g>`,
      },
    });
  }
  return out;
};

export class Board {
  cg: Api;
  private el: HTMLElement;
  private fen = '';
  private orientation: 'white' | 'black' = 'white';

  constructor(el: HTMLElement, private onUserMove: (m: UserMove) => void) {
    this.el = el;
    el.style.position = 'relative';
    this.cg = Chessground(el, {
      animation: { duration: 180 },
      highlight: { lastMove: true, check: true },
      movable: { free: false, showDests: true, events: { after: (o, d) => this.handle(o, d) } },
      premovable: { enabled: false },
      draggable: { showGhost: true },
      drawable: { enabled: true, visible: true },
    });
  }

  show(fen: string, o: ShowOpts = {}) {
    this.fen = fen;
    if (o.orientation) this.orientation = o.orientation;
    const chess = new Chess(fen);
    const dests = new Map<Key, Key[]>();
    const side = chess.turn() === 'w' ? 'white' : 'black';
    const allowed = o.movable === 'both' || o.movable === side;
    if (allowed) {
      for (const m of chess.moves({ verbose: true })) {
        const arr = dests.get(m.from as Key) ?? [];
        arr.push(m.to as Key);
        dests.set(m.from as Key, arr);
      }
    }
    this.cg.set({
      fen,
      orientation: this.orientation,
      turnColor: side,
      check: chess.inCheck() ? side : false,
      lastMove: (o.lastMove ?? undefined) as Key[] | undefined,
      movable: { color: allowed ? side : undefined, dests, free: false },
      drawable: { autoShapes: toShapes(o.arrows ?? [], o.badge) },
    });
    this.closePromo();
  }

  flip() {
    this.orientation = this.orientation === 'white' ? 'black' : 'white';
    this.cg.set({ orientation: this.orientation });
  }
  get orient() {
    return this.orientation;
  }
  setArrows(arrows: Arrow[]) {
    this.cg.setAutoShapes(toShapes(arrows));
  }
  shake() {
    this.el.classList.remove('shake');
    void this.el.offsetWidth;
    this.el.classList.add('shake');
  }

  private handle(from: string, to: string) {
    const chess = new Chess(this.fen);
    const piece = chess.get(from as never);
    const lastRank = to[1] === '8' || to[1] === '1';
    if (piece?.type === 'p' && lastRank) {
      this.askPromotion(from, to, piece.color);
      return;
    }
    this.onUserMove({ from, to });
  }

  private askPromotion(from: string, to: string, color: string) {
    this.closePromo();
    const box = document.createElement('div');
    box.className = 'promo';
    const glyph: Record<string, string> =
      color === 'w' ? { q: '♕', r: '♖', b: '♗', n: '♘' } : { q: '♛', r: '♜', b: '♝', n: '♞' };
    for (const p of ['q', 'r', 'b', 'n']) {
      const b = document.createElement('button');
      b.textContent = glyph[p];
      b.onclick = () => {
        this.closePromo();
        this.onUserMove({ from, to, promotion: p });
      };
      box.append(b);
    }
    const cancel = document.createElement('button');
    cancel.textContent = '✕';
    cancel.onclick = () => this.show(this.fen, { movable: color === 'w' ? 'white' : 'black' });
    box.append(cancel);
    this.el.append(box);
  }
  private closePromo() {
    this.el.querySelector('.promo')?.remove();
  }

  destroy() {
    this.cg.destroy();
  }
}

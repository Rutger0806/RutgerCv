import { Chess } from 'chess.js';
import { BAD, CLS_INFO, PIECE_NL, moverWin, type Cls, type GameAnalysis, type ParsedGame } from './analysis';
import type { Book } from './book';
import { esc, fenKey, uciToSan } from './util';

export interface Coaching {
  cls: Cls;
  html: string;
  best: string | null; // uci van de betere zet (alleen bij slechte zetten)
}

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/** Coach-uitleg voor zet nummer `i` (0-based) in Nederlands. */
export function coach(g: ParsedGame, an: GameAnalysis, i: number, book: Book | null): Coaching {
  const m = g.moves[i];
  const c = an.cls[i];
  const white = m.color === 'w';
  const san = `<b>${esc(m.san)}</b>`;
  const before = moverWin(an.evals[i], white);
  const after = moverWin(an.evals[i + 1], white);
  const bestUci = an.best[i];
  const bestSan = bestUci ? uciToSan(g.fens[i], bestUci) : null;
  const delta = `<span class="muted">Winkans ${before.toFixed(0)}% → ${after.toFixed(0)}%.</span>`;

  let html = '';
  switch (c) {
    case 'brilliant':
      html = `Briljant! Met ${san} offer je materiaal, maar het is precies de sterkste voortzetting. Zulke zetten zie je niet snel.`;
      break;
    case 'great':
      html = `Geweldig gezien! ${san} is hier de enige zet die de stelling in balans of in jouw voordeel houdt.`;
      break;
    case 'book': {
      const nm = book?.nameAt.get(fenKey(g.fens[i + 1]));
      html = `${san} is theorie${nm ? `: <i>${esc(nm.name)}</i>` : ''}. Je zit nog in de bekende opening.`;
      break;
    }
    case 'best':
      html = `${san} is de beste zet van de engine.`;
      break;
    case 'excellent':
      html = `${san} is een uitstekende zet, vrijwel net zo sterk als de beste.`;
      break;
    case 'good':
      html = `${san} is een prima zet.${bestSan ? ` De engine had een lichte voorkeur voor <b>${esc(bestSan)}</b>.` : ''}`;
      break;
    default: {
      const intro =
        c === 'blunder'
          ? `${san} is een blunder.`
          : c === 'mistake'
            ? `${san} is een fout.`
            : c === 'miss'
              ? `Je tegenstander speelde zwak, maar je greep je kans niet met ${san}.`
              : `${san} is een onnauwkeurigheid.`;
      html = `${intro} ${reason(g, an, i, white)}${bestSan ? ` <b>${esc(bestSan)}</b> was sterker.` : ''} ${delta}`;
      return { cls: c, html, best: bestUci };
    }
  }
  return { cls: c, html, best: BAD.includes(c) ? bestUci : null };
}

/** Probeer in woorden uit te leggen wat er mis ging. */
function reason(g: ParsedGame, an: GameAnalysis, i: number, white: boolean): string {
  const after = an.evals[i + 1];
  // laat mat toe?
  if (after.mate != null && after.mate !== 0 && (after.mate < 0) === white) {
    return `Hiermee kan je tegenstander mat geven in ${Math.abs(after.mate)}.`;
  }
  // tegenstander kan nu iets slaan
  const reply = an.best[i + 1];
  if (reply) {
    const c = new Chess(g.fens[i + 1]);
    try {
      const rm = c.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] });
      if (rm.captured && VAL[rm.captured] >= 3) {
        const moved = g.moves[i];
        const same = rm.to === moved.to;
        return `Je tegenstander kan nu je ${PIECE_NL[rm.captured]}${same ? '' : ' (of ander materiaal)'} winnen met ${esc(rm.san)}.`;
      }
    } catch {
      /* negeer */
    }
  }
  // wat miste je?
  const b = an.best[i];
  if (b) {
    const c = new Chess(g.fens[i]);
    try {
      const bm = c.move({ from: b.slice(0, 2), to: b.slice(2, 4), promotion: b[4] });
      if (c.isCheckmate()) return 'Je miste een matzet!';
      if (bm.captured && VAL[bm.captured] >= 3) return `Je kon een ${PIECE_NL[bm.captured]} winnen.`;
      if (bm.san.includes('+')) return 'Je miste een sterke zet met schaak.';
    } catch {
      /* negeer */
    }
  }
  const sign = after.cp * (white ? 1 : -1);
  if (an.evals[i].mate == null && after.mate == null && sign < -150) return 'Hierdoor sta je nu duidelijk slechter.';
  return 'De stelling wordt daardoor minder gunstig voor je.';
}

export const label = (c: Cls) => CLS_INFO[c].label;

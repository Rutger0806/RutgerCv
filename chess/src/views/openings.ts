import { Chess } from 'chess.js';
import { Board, type UserMove } from '../board';
import { bookMoves, loadBook, type Book, type Opening } from '../book';
import { repertoire, saveRepertoire, type RepLine } from '../store';
import { $, esc, fenKey, START_FEN } from '../util';
import { load, save } from '../util';

type Mode = 'explore' | 'practice' | 'rep';

interface TreeMove {
  san: string;
  weight: number;
}

function buildTree(lines: { san: string[] }[]): Map<string, Map<string, TreeMove>> {
  const tree = new Map<string, Map<string, TreeMove>>();
  const c = new Chess();
  for (const l of lines) {
    c.reset();
    for (const san of l.san) {
      const key = fenKey(c.fen());
      let m;
      try {
        m = c.move(san);
      } catch {
        break;
      }
      const uci = m.from + m.to + (m.promotion ?? '');
      let map = tree.get(key);
      if (!map) tree.set(key, (map = new Map()));
      const e = map.get(uci);
      if (e) e.weight++;
      else map.set(uci, { san: m.san, weight: 1 });
    }
  }
  return tree;
}

export function mount(root: HTMLElement): () => void {
  root.innerHTML = `
  <div class="layout">
    <div class="left">
      <div class="boardrow"><div class="board"></div></div>
      <div class="controls">
        <button data-a="undo">◀ Terug</button>
        <button data-a="reset">⟲ Begin</button>
        <button data-a="flip">⇅ Draai</button>
      </div>
      <div class="comment" id="opname">Beginstelling</div>
      <div class="trail muted" id="trail"></div>
    </div>
    <div class="right">
      <section class="card">
        <div class="tabs" id="modeTabs">
          <button data-m="explore" class="on">Verkennen</button>
          <button data-m="practice">Oefenen</button>
          <button data-m="rep">Repertoire</button>
        </div>
        <div id="panel"><p class="muted">Openingsboek laden…</p></div>
      </section>
    </div>
  </div>`;

  const board = new Board($(root, '.board'), (m) => onUserMove(m));
  const panel = $(root, '#panel');
  const nameEl = $(root, '#opname');
  const trailEl = $(root, '#trail');

  let book: Book | null = null;
  let mode: Mode = 'explore';
  let disposed = false;
  const chess = new Chess();
  let hist: string[] = []; // SAN van de huidige lijn
  let orient: 'white' | 'black' = 'white';

  // oefenen
  let tree = new Map<string, Map<string, TreeMove>>();
  let side: 'white' | 'black' = 'white';
  let practiceActive = false;
  let mistakes = 0;
  let totalMistakes = 0;
  let timer: number | undefined;
  let hintArrow: { from: string; to: string } | null = null;
  let source = 'all-white';
  let msg = '';

  void loadBook().then((b) => {
    book = b;
    renderPanel();
    refresh();
  });

  /* ---------- gemeenschappelijk ---------- */
  function replay(moves: string[]) {
    chess.reset();
    const last = [];
    for (const s of moves) {
      try {
        const m = chess.move(s);
        last.push(m);
      } catch {
        break;
      }
    }
    hist = chess.history();
  }

  function openingName(): Opening | null {
    if (!book) return null;
    const c = new Chess();
    let found: Opening | null = book.nameAt.get(fenKey(c.fen())) ?? null;
    for (const s of hist) {
      c.move(s);
      found = book.nameAt.get(fenKey(c.fen())) ?? found;
    }
    return found;
  }

  function refresh() {
    const h = chess.history({ verbose: true });
    const last = h[h.length - 1];
    const movable = mode === 'explore' ? 'both' : practiceActive && chess.turn() === side[0] ? side : null;
    board.show(chess.fen(), {
      orientation: orient,
      lastMove: last ? [last.from, last.to] : null,
      movable,
      arrows: hintArrow ? [hintArrow] : [],
    });
    const op = openingName();
    nameEl.innerHTML = op ? `<b>${esc(op.name)}</b> <span class="muted">${op.eco}</span>` : hist.length ? '<span class="muted">Buiten de theorie</span>' : 'Beginstelling';
    trailEl.textContent = h.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m.san}` : m.san)).join(' ');
  }

  root.querySelector('.controls')!.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).dataset.a;
    if (a === 'flip') {
      orient = orient === 'white' ? 'black' : 'white';
      board.flip();
    } else if (a === 'undo' && mode === 'explore') {
      replay(hist.slice(0, -1));
      refresh();
      renderPanel();
    } else if (a === 'reset') {
      if (mode === 'explore') {
        replay([]);
        refresh();
        renderPanel();
      } else if (mode === 'practice') startPractice();
    }
  });

  $(root, '#modeTabs').addEventListener('click', (e) => {
    const m = (e.target as HTMLElement).dataset.m as Mode | undefined;
    if (!m) return;
    window.clearTimeout(timer);
    mode = m;
    practiceActive = false;
    hintArrow = null;
    $(root, '#modeTabs')
      .querySelectorAll('button')
      .forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.m === m));
    if (m !== 'practice') {
      replay(m === 'explore' ? hist : []);
    }
    if (m === 'practice') {
      replay([]);
      msg = '';
    }
    renderPanel();
    refresh();
  });

  function onUserMove(m: UserMove) {
    if (mode === 'explore') {
      try {
        chess.move(m);
      } catch {
        refresh();
        return;
      }
      hist = chess.history();
      refresh();
      renderPanel();
    } else if (mode === 'practice') practiceMove(m);
  }

  function renderPanel() {
    if (!book) return;
    if (mode === 'explore') renderExplore();
    else if (mode === 'practice') renderPractice();
    else renderRep();
  }

  /* ---------- verkennen ---------- */
  let query = '';
  let repMsg = '';

  function renderExplore() {
    const moves = bookMoves(book!, chess.fen());
    const q = query.trim().toLowerCase();
    const results = q
      ? book!.list.filter((o) => q.split(/\s+/).every((w) => o.name.toLowerCase().includes(w) || o.eco.toLowerCase() === w)).slice(0, 80)
      : [];
    panel.innerHTML = `
      <input id="q" placeholder="Zoek opening (bijv. Najdorf, Londen, Caro-Kann)…" value="${esc(query)}" />
      ${
        q
          ? `<div class="row small"><span class="muted">${results.length}${results.length === 80 ? '+' : ''} resultaten</span>
             <button id="addAllW">+ alles als wit</button><button id="addAllB">+ alles als zwart</button></div>
             <div class="gamelist" id="res">${results
               .map(
                 (o, i) => `<div class="opitem"><button data-view="${i}"><b>${esc(o.name)}</b><span>${o.eco} · ${esc(o.san.slice(0, 8).join(' '))}${o.san.length > 8 ? '…' : ''}</span></button>
               <button class="mini" data-w="${i}" title="Toevoegen aan repertoire als wit">+♔</button><button class="mini" data-b="${i}" title="Toevoegen aan repertoire als zwart">+♚</button></div>`,
               )
               .join('')}</div>`
          : ''
      }
      <h4>Boekzetten in deze stelling</h4>
      ${
        moves.length
          ? `<div class="chips">${moves.map((m) => `<button class="chip" data-uci="${m.uci}"><b>${esc(m.san)}</b><span>${esc(m.sample.name)}</span></button>`).join('')}</div>`
          : '<p class="muted">Geen theoriezetten meer in het boek.</p>'
      }
      <div class="row">
        <button id="addW" ${hist.length ? '' : 'disabled'}>Deze lijn → repertoire (wit)</button>
        <button id="addB" ${hist.length ? '' : 'disabled'}>Deze lijn → repertoire (zwart)</button>
      </div>
      <p class="muted">${esc(repMsg)}</p>`;
    $(panel, '#q').oninput = (e) => {
      query = (e.target as HTMLInputElement).value;
      const pos = (e.target as HTMLInputElement).selectionStart;
      renderExplore();
      const inp = $<HTMLInputElement>(panel, '#q');
      inp.focus();
      inp.setSelectionRange(pos, pos);
    };
    panel.querySelectorAll<HTMLElement>('[data-uci]').forEach((b) => {
      b.onclick = () => {
        const uci = b.dataset.uci!;
        onUserMove({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      };
    });
    panel.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => {
      b.onclick = () => {
        replay(results[+b.dataset.view!].san);
        refresh();
        renderExplore();
      };
    });
    const addLines = (ops: Opening[], s: 'white' | 'black') => {
      const cur = repertoire();
      const have = new Set(cur.map((l) => l.id));
      let n = 0;
      for (const o of ops) {
        const id = `${s}:${o.san.join(' ')}`;
        if (have.has(id)) continue;
        cur.push({ id, eco: o.eco, name: o.name, san: o.san, side: s });
        n++;
      }
      saveRepertoire(cur);
      repMsg = `${n} lijn(en) toegevoegd aan je repertoire (${s === 'white' ? 'wit' : 'zwart'}).`;
      renderExplore();
    };
    panel.querySelectorAll<HTMLElement>('[data-w]').forEach((b) => (b.onclick = () => addLines([results[+b.dataset.w!]], 'white')));
    panel.querySelectorAll<HTMLElement>('[data-b]').forEach((b) => (b.onclick = () => addLines([results[+b.dataset.b!]], 'black')));
    const all = panel.querySelector<HTMLElement>('#addAllW');
    if (all) {
      all.onclick = () => addLines(results, 'white');
      $(panel, '#addAllB').onclick = () => addLines(results, 'black');
    }
    const cur = (s: 'white' | 'black') => () => {
      const op = openingName();
      addLines([{ eco: op?.eco ?? '—', name: op ? `${op.name} (+${hist.length - op.san.length})`.replace(' (+0)', '') : 'Eigen lijn', san: hist }], s);
    };
    $(panel, '#addW').onclick = cur('white');
    $(panel, '#addB').onclick = cur('black');
  }

  /* ---------- oefenen ---------- */
  const stats = () => load<{ runs: number; clean: number }>('openstats', { runs: 0, clean: 0 });

  function sourceLines(): { san: string[]; side: 'white' | 'black'; name: string }[] {
    const rep = repertoire();
    if (source === 'all-white') return rep.filter((l) => l.side === 'white');
    if (source === 'all-black') return rep.filter((l) => l.side === 'black');
    const l = rep.find((x) => x.id === source);
    return l ? [l] : [];
  }

  function renderPractice() {
    const rep = repertoire();
    const st = stats();
    panel.innerHTML = rep.length
      ? `<p>Kies wat je wilt oefenen. Je speelt jouw zetten uit het repertoire; de tegenstander kiest willekeurig uit jouw lijnen.</p>
         <div class="row"><select id="src">
           <option value="all-white" ${source === 'all-white' ? 'selected' : ''}>Hele repertoire als wit (${rep.filter((l) => l.side === 'white').length})</option>
           <option value="all-black" ${source === 'all-black' ? 'selected' : ''}>Hele repertoire als zwart (${rep.filter((l) => l.side === 'black').length})</option>
           ${rep.map((l) => `<option value="${esc(l.id)}" ${source === l.id ? 'selected' : ''}>${l.side === 'white' ? '♔' : '♚'} ${esc(l.name)}</option>`).join('')}
         </select><button class="primary" id="start">Start</button></div>
         <div id="pstat" class="feedback">${msg}</div>
         <div class="row"><button id="hint" ${practiceActive ? '' : 'disabled'}>💡 Hint</button><button id="skip" ${practiceActive ? '' : 'disabled'}>Opgeven (toon zet)</button></div>
         <p class="muted">Totaal: ${st.runs} oefenrondes, ${st.clean} foutloos.</p>`
      : '<p>Je repertoire is nog leeg. Ga naar <b>Verkennen</b>, zoek een opening en voeg die toe met +♔ of +♚.</p>';
    if (!rep.length) return;
    $(panel, '#src').onchange = (e) => (source = (e.target as HTMLSelectElement).value);
    $(panel, '#start').onclick = () => {
      source = ($(panel, '#src') as HTMLSelectElement).value;
      startPractice();
    };
    $(panel, '#hint').onclick = showHint;
    $(panel, '#skip').onclick = () => {
      showHint();
      totalMistakes++;
    };
  }

  function startPractice() {
    window.clearTimeout(timer);
    const lines = sourceLines();
    if (!lines.length) {
      msg = '<span class="err">Geen lijnen voor deze keuze.</span>';
      renderPractice();
      return;
    }
    side = source === 'all-black' ? 'black' : source === 'all-white' ? 'white' : (lines[0].side);
    tree = buildTree(lines);
    orient = side;
    practiceActive = true;
    mistakes = 0;
    totalMistakes = 0;
    hintArrow = null;
    msg = `Jij speelt ${side === 'white' ? 'wit' : 'zwart'}. Speel de juiste theoriezet!`;
    replay([]);
    renderPractice();
    refresh();
    step();
  }

  function expected(): Map<string, TreeMove> | undefined {
    return tree.get(fenKey(chess.fen()));
  }

  function step() {
    if (!practiceActive) return;
    const exp = expected();
    if (!exp || !exp.size) return finishPractice();
    if (chess.turn() === side[0]) {
      refresh();
      return;
    }
    // tegenstander: gewogen willekeurig
    const items = [...exp.entries()];
    let r = Math.random() * items.reduce((s, [, v]) => s + v.weight, 0);
    let pick = items[0];
    for (const it of items) {
      r -= it[1].weight;
      if (r <= 0) {
        pick = it;
        break;
      }
    }
    timer = window.setTimeout(() => {
      if (disposed || !practiceActive) return;
      const [uci] = pick;
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      hist = chess.history();
      hintArrow = null;
      refresh();
      step();
    }, 450);
  }

  function practiceMove(m: UserMove) {
    if (!practiceActive || chess.turn() !== side[0]) return;
    const exp = expected();
    const uci = m.from + m.to + (m.promotion ?? '');
    if (exp?.has(uci)) {
      chess.move(m);
      hist = chess.history();
      hintArrow = null;
      mistakes = 0;
      refresh();
      step();
      return;
    }
    // fout
    totalMistakes++;
    mistakes++;
    board.shake();
    const bm = book && bookMoves(book, chess.fen()).find((b) => b.uci === uci);
    const extra = bm ? ` (wel theorie: <i>${esc(bm.sample.name)}</i>, maar niet in jouw repertoire)` : '';
    msg = `<span class="err">✗ Niet de repertoirezet${extra}. Probeer opnieuw.</span>`;
    if (mistakes >= 2) showHint();
    renderPractice();
    refresh();
  }

  function showHint() {
    const exp = expected();
    if (!exp) return;
    const [uci] = [...exp.entries()].sort((a, b) => b[1].weight - a[1].weight)[0];
    hintArrow = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
    refresh();
  }

  function finishPractice() {
    practiceActive = false;
    hintArrow = null;
    const st = stats();
    st.runs++;
    if (totalMistakes === 0) st.clean++;
    save('openstats', st);
    const op = openingName();
    msg = `<span class="ok">✓ Lijn afgerond${op ? `: <b>${esc(op.name)}</b>` : ''} — ${totalMistakes === 0 ? 'foutloos! 🎉' : `${totalMistakes} fout(en)`}.</span> Druk op Start voor een volgende lijn.`;
    renderPractice();
    refresh();
  }

  /* ---------- repertoire ---------- */
  function renderRep() {
    const rep = repertoire();
    const group = (s: 'white' | 'black') => {
      const ls = rep.filter((l) => l.side === s);
      return `<h4>${s === 'white' ? '♔ Met wit' : '♚ Met zwart'} (${ls.length})</h4>${
        ls.length
          ? ls.map((l) => `<div class="opitem"><button data-show="${esc(l.id)}"><b>${esc(l.name)}</b><span>${l.eco} · ${esc(l.san.join(' '))}</span></button><button class="mini" data-del="${esc(l.id)}" title="Verwijderen">✕</button></div>`).join('')
          : '<p class="muted">Leeg.</p>'
      }`;
    };
    panel.innerHTML = group('white') + group('black');
    panel.querySelectorAll<HTMLElement>('[data-show]').forEach((b) => {
      b.onclick = () => {
        const l = rep.find((x) => x.id === b.dataset.show) as RepLine;
        replay(l.san);
        orient = l.side;
        refresh();
      };
    });
    panel.querySelectorAll<HTMLElement>('[data-del]').forEach((b) => {
      b.onclick = () => {
        saveRepertoire(repertoire().filter((x) => x.id !== b.dataset.del));
        renderRep();
      };
    });
  }

  replay([]);
  board.show(START_FEN, { movable: 'both' });

  return () => {
    disposed = true;
    window.clearTimeout(timer);
    board.destroy();
  };
}

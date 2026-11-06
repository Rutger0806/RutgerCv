import { Chess } from 'chess.js';
import { Board, type UserMove } from '../board';
import { evWin, liveEngine, lineToEv, sameStrength } from '../engine';
import { addPuzzles, puzzles, recordPuzzle, savePuzzles, type Puzzle } from '../store';
import { $, esc, fmtEval, load, save, sleep, uciToSan } from '../util';

interface Lesson {
  id: string;
  title: string;
  fen: string;
  user: 'white' | 'black';
  goal: 'win' | 'draw';
  tip: string;
}

const LESSONS: Lesson[] = [
  { id: 'kq', title: 'Mat met dame + koning', fen: '8/8/8/4k3/8/8/8/Q3K3 w - - 0 1', user: 'white', goal: 'win',
    tip: 'Sluit de koning in met een "ridderafstand" (dame een ridderzet van de koning). Duw hem naar de rand, breng je eigen koning erbij en pas op voor pat.' },
  { id: 'kr', title: 'Mat met toren + koning', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', user: 'white', goal: 'win',
    tip: 'Snij de koning af met de toren, dwing hem naar de rand met opposities en geef mat op de rand. Houd je toren buiten bereik van de koning.' },
  { id: 'kbb', title: 'Mat met twee lopers', fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1', user: 'white', goal: 'win',
    tip: 'De lopers werken samen als twee naast elkaar liggende diagonalen. Dwing de koning naar een hoek, breng de koning ondersteunend naar voren.' },
  { id: 'kbn', title: 'Mat met loper + paard', fen: '8/8/8/4k3/8/8/8/2B1KN2 w - - 0 1', user: 'white', goal: 'win',
    tip: 'De moeilijkste basismat. Drijf de koning naar de hoek met de kleur van je loper (via de "W-manoeuvre" van het paard). Je hebt maximaal 33 zetten nodig.' },
  { id: 'opp', title: 'Koning + pion: sleutelvelden', fen: '3k4/8/3K4/3P4/8/8/8/8 w - - 0 1', user: 'white', goal: 'win',
    tip: 'Je koning staat vóór de pion op de 6e rij. Je wint als je koning de sleutelvelden (c7/d7/e7 hier) bereikt. Gebruik opposities en geef geen pat.' },
  { id: 'kp6', title: 'Koning voor de pion op de 6e rij', fen: '6k1/8/6K1/6P1/8/8/8/8 w - - 0 1', user: 'white', goal: 'win',
    tip: 'Met je koning op de 6e rij vóór je pion win je altijd, ook als de pion op de g-lijn staat. Duw de koning weg, steun de pion naar voren en let op pat op de rand.' },
  { id: 'draw-kp', title: 'Koning + pion: houd remise', fen: '8/8/8/3k4/8/3K4/3P4/8 w - - 0 1', user: 'black', goal: 'draw',
    tip: 'Je koning staat voor de pion. Blijf in opposities en laat wit nooit de sleutelvelden bereiken. Wit begint.' },
  { id: 'lucena', title: 'Lucena-stelling (winnen)', fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', user: 'white', goal: 'win',
    tip: 'Bouw de "brug": toren naar de 4e rij (Td4), koning naar buiten, en dek schaaks met de toren af. Pion promoveert dan.' },
  { id: 'philidor', title: 'Philidor-stelling (remise houden)', fen: '4k3/8/r7/3PK3/8/8/8/4R3 b - - 0 1', user: 'black', goal: 'draw',
    tip: 'Houd je toren op de 6e rij tot de pion de 6e rij betreedt, dan toren naar achteren voor schaakjes van achter. Jouw koning blijft voor de pion.' },
];

export function mount(root: HTMLElement): () => void {
  root.innerHTML = `
  <div class="layout">
    <div class="left">
      <div class="boardrow"><div class="board"></div></div>
      <div class="controls" id="ctl"></div>
      <div class="comment" id="status">Kies een les of puzzel aan de rechterkant.</div>
    </div>
    <div class="right">
      <section class="card">
        <div class="tabs" id="tt">
          <button data-t="end" class="on">Eindspelen</button>
          <button data-t="puz">Puzzels &amp; fouten</button>
        </div>
        <div id="panel"></div>
      </section>
    </div>
  </div>`;

  const board = new Board($(root, '.board'), (m) => onMove(m));
  const panel = $(root, '#panel');
  const status = $(root, '#status');
  const ctl = $(root, '#ctl');
  let disposed = false;
  let tab: 'end' | 'puz' = 'end';
  let handler: ((m: UserMove) => void) | null = null;
  const onMove = (m: UserMove) => handler?.(m);

  $(root, '#tt').addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).dataset.t as 'end' | 'puz' | undefined;
    if (!t) return;
    tab = t;
    handler = null;
    liveEngine().stop();
    $(root, '#tt')
      .querySelectorAll('button')
      .forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.t === t));
    board.show(new Chess().fen(), { movable: null });
    ctl.innerHTML = '';
    status.textContent = 'Kies een les of puzzel aan de rechterkant.';
    render();
  });

  const render = () => (tab === 'end' ? renderEnd() : renderPuz());

  /* ============ eindspelen ============ */
  let lesson: Lesson | null = null;
  let chess = new Chess();
  let stack: string[] = [];
  let busy = false;
  let over = false;
  let warned = false;

  function renderEnd() {
    panel.innerHTML = `<p class="muted">Speel de stelling uit tegen Stockfish. Je krijgt een waarschuwing zodra je de winst of remise weggeeft.</p>
      <div class="gamelist">${LESSONS.map(
        (l) => `<button data-l="${l.id}"><b>${esc(l.title)}</b><span>${l.goal === 'win' ? 'Doel: winnen' : 'Doel: remise houden'} · jij speelt ${l.user === 'white' ? 'wit' : 'zwart'}</span></button>`,
      ).join('')}</div>
      ${lesson ? `<div class="tip"><b>Tip:</b> ${esc(lesson.tip)}</div>` : ''}`;
    panel.querySelectorAll<HTMLElement>('[data-l]').forEach((b) => (b.onclick = () => startLesson(LESSONS.find((l) => l.id === b.dataset.l)!)));
  }

  function startLesson(l: Lesson) {
    lesson = l;
    chess = new Chess(l.fen);
    stack = [];
    over = false;
    warned = false;
    busy = false;
    handler = lessonMove;
    ctl.innerHTML = `<button id="hint">💡 Hint</button><button id="take">↶ Zet terug</button><button id="restart">⟲ Opnieuw</button>`;
    $(ctl, '#hint').onclick = lessonHint;
    $(ctl, '#take').onclick = takeBack;
    $(ctl, '#restart').onclick = () => startLesson(l);
    renderEnd();
    status.textContent = `${l.title} — ${l.goal === 'win' ? 'win de stelling' : 'houd remise'}.`;
    showLesson();
    if (chess.turn() !== l.user[0]) void engineReply();
  }

  function showLesson(arrows: { from: string; to: string }[] = []) {
    const h = chess.history({ verbose: true });
    const last = h[h.length - 1];
    board.show(chess.fen(), {
      orientation: lesson!.user,
      lastMove: last ? [last.from, last.to] : null,
      movable: !over && !busy && chess.turn() === lesson!.user[0] ? lesson!.user : null,
      arrows,
    });
  }

  function userWin(white: number) {
    return lesson!.user === 'white' ? white : 100 - white;
  }

  function checkEnd(): boolean {
    const l = lesson!;
    if (chess.isCheckmate()) {
      const userMated = chess.turn() === l.user[0];
      finish(!userMated && l.goal === 'win' ? true : userMated ? false : false, userMated ? 'Je bent mat gezet.' : 'Schaakmat! 🎉');
      return true;
    }
    if (chess.isDraw()) {
      finish(l.goal === 'draw', l.goal === 'draw' ? 'Remise bereikt — gelukt! 🎉' : 'Remise: de winst is verspeeld.');
      return true;
    }
    if (l.goal === 'draw' && chess.history().length >= 60) {
      finish(true, '30 zetten volgehouden zonder de remise te verspelen — gelukt! 🎉');
      return true;
    }
    return false;
  }

  function finish(ok: boolean, text: string) {
    over = true;
    status.innerHTML = `<span class="${ok ? 'ok' : 'err'}">${ok ? '✓' : '✗'} ${esc(text)}</span>`;
    showLesson();
  }

  async function lessonMove(m: UserMove) {
    if (over || busy) return;
    stack.push(chess.fen());
    try {
      chess.move(m);
    } catch {
      stack.pop();
      showLesson();
      return;
    }
    if (checkEnd()) return;
    await engineReply();
  }

  async function engineReply() {
    busy = true;
    showLesson();
    status.textContent = 'Engine denkt na…';
    const lines = await liveEngine().analyse(chess.fen(), { depth: 16, multipv: 1 });
    if (disposed || !lesson) return;
    const l = lines[0];
    if (!l) {
      busy = false;
      showLesson();
      return;
    }
    // beoordeel de stelling voor jou (na jouw zet)
    const uw = userWin(evWin(lineToEv(l)));
    const l2 = lesson;
    let warn = '';
    if (stack.length && !warned) {
      if (l2.goal === 'win' && uw < 70) warn = `⚠ Je laat de winst lopen (${fmtEval(l.cp, l.mate)} voor wit). Gebruik "Zet terug".`;
      if (l2.goal === 'draw' && uw < 30) warn = `⚠ Je staat nu verloren (${fmtEval(l.cp, l.mate)} voor wit). Gebruik "Zet terug".`;
      if (warn) warned = true;
    }
    await sleep(350);
    const u = l.pv[0];
    chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    busy = false;
    if (checkEnd()) return;
    status.innerHTML = warn ? `<span class="err">${esc(warn)}</span>` : 'Jouw zet.';
    showLesson();
  }

  async function lessonHint() {
    if (over || busy || !lesson) return;
    const lines = await liveEngine().analyse(chess.fen(), { depth: 16, multipv: 1 });
    const u = lines[0]?.pv[0];
    if (!u) return;
    status.innerHTML = `Hint: <b>${esc(uciToSan(chess.fen(), u) ?? u)}</b>`;
    showLesson([{ from: u.slice(0, 2), to: u.slice(2, 4) }]);
  }

  function takeBack() {
    if (!lesson || busy) return;
    const f = stack.pop();
    if (!f) return;
    chess = new Chess(f);
    over = false;
    warned = false;
    status.textContent = 'Zet teruggenomen.';
    showLesson();
  }

  /* ============ puzzels ============ */
  let cur: Puzzle | null = null;
  let pz: Chess = new Chess();
  let idx = 0;
  let failedOnce = false;
  let solvedState = false;
  let impMsg = '';
  let pFilter = '';

  function renderPuz() {
    const all = puzzles();
    const due = all.filter((p) => p.due <= Date.now());
    const tags = [...new Set(all.flatMap((p) => p.tags ?? []))].sort().reverse();
    const tagOpts = tags.map((t) => `<option value="tag:${esc(t)}" ${t === pFilter ? 'selected' : ''}>${esc(t)}</option>`).join('');
    panel.innerHTML = `
      <p><b>${all.length}</b> puzzels · <b>${due.length}</b> om te herhalen · ${all.filter((p) => p.source === 'mistake').length} eigen fouten</p>
      <div class="row"><button class="primary" id="next" ${all.length ? '' : 'disabled'}>${due.length ? 'Volgende puzzel' : 'Oefen toch'}</button>
        <select id="filter"><option value="all">Alles</option><option value="mistake">Alleen eigen fouten</option><option value="import">Alleen geïmporteerd</option>${tagOpts}</select></div>
      <details ${all.length ? '' : 'open'}><summary>Puzzels importeren (Lichess)</summary>
        <p class="muted">Download <code>lichess_db_puzzle.csv.zst</code> van database.lichess.org, pak het uit en kies hier het bestand (alleen het eerste deel wordt gelezen), of plak regels.</p>
        <div class="row"><label>Rating <input id="rmin" type="number" value="1000" style="width:5em"/> – <input id="rmax" type="number" value="1800" style="width:5em"/></label>
        <label>Max <input id="rcnt" type="number" value="200" style="width:5em"/></label></div>
        <input type="file" id="file" accept=".csv,.txt" />
        <textarea id="csv" rows="3" placeholder="PuzzleId,FEN,Moves,Rating,…"></textarea>
        <button id="imp">Importeer</button> <span class="muted">${esc(impMsg)}</span>
      </details>
      ${all.length ? '<button id="clearImp" class="link">Geïmporteerde puzzels wissen</button>' : ''}
      <h4>Eigen fouten uit je partijen</h4>
      <p class="muted">Analyseer een partij en klik op "Bewaar fouten als puzzels" — ze komen hier terug met spaced repetition.</p>`;
    $(panel, '#next').onclick = () => nextPuzzle(($(panel, '#filter') as HTMLSelectElement).value);
    if (pFilter) ($(panel, '#filter') as HTMLSelectElement).value = 'tag:' + pFilter;
    $(panel, '#imp').onclick = async () => {
      const f = ($(panel, '#file') as HTMLInputElement).files?.[0];
      const text = f ? await f.slice(0, 6_000_000).text() : ($(panel, '#csv') as HTMLTextAreaElement).value;
      const min = +($(panel, '#rmin') as HTMLInputElement).value;
      const max = +($(panel, '#rmax') as HTMLInputElement).value;
      const cnt = +($(panel, '#rcnt') as HTMLInputElement).value;
      const items: Omit<Puzzle, 'box' | 'due' | 'solved' | 'failed'>[] = [];
      for (const line of text.split('\n')) {
        const c = line.trim().split(',');
        if (c.length < 4 || c[0] === 'PuzzleId') continue;
        const rating = +c[3];
        if (!(rating >= min && rating <= max)) continue;
        try {
          new Chess(c[1]);
        } catch {
          continue;
        }
        items.push({ id: `p-${c[0]}`, fen: c[1], moves: c[2].split(' '), setup: true, title: `Lichess puzzel ${c[0]}`, rating, source: 'import' });
        if (items.length >= cnt) break;
      }
      const n = addPuzzles(items);
      impMsg = `${n} puzzel(s) toegevoegd.`;
      renderPuz();
    };
    const clr = panel.querySelector<HTMLElement>('#clearImp');
    if (clr) clr.onclick = () => {
      savePuzzles(puzzles().filter((p) => p.source !== 'import'));
      renderPuz();
    };
  }

  function nextPuzzle(filter: string) {
    let pool = puzzles().filter((p) => filter === 'all' || (filter.startsWith('tag:') ? p.tags?.includes(filter.slice(4)) : p.source === filter));
    const due = pool.filter((p) => p.due <= Date.now());
    if (due.length) pool = due;
    if (!pool.length) {
      status.textContent = 'Geen puzzels in deze selectie.';
      return;
    }
    cur = pool[Math.floor(Math.random() * pool.length)];
    pz = new Chess(cur.fen);
    idx = 0;
    failedOnce = false;
    solvedState = false;
    handler = puzzleMove;
    ctl.innerHTML = `<button id="hint">💡 Hint</button><button id="show">Toon oplossing</button><button id="nx">Volgende ➜</button>`;
    $(ctl, '#hint').onclick = () => hintPuzzle(false);
    $(ctl, '#show').onclick = () => hintPuzzle(true);
    $(ctl, '#nx').onclick = () => nextPuzzle(filter);
    status.innerHTML = `<b>${esc(cur.title)}</b>${cur.rating ? ` · rating ${cur.rating}` : ''}`;
    if (cur.setup) {
      showPuz(null, null);
      void sleep(600).then(() => {
        if (disposed) return;
        applyUci(cur!.moves[0]);
        idx = 1;
        showPuz(cur!.moves[0], null);
        say('Vind de beste zet voor ' + (pz.turn() === 'w' ? 'wit' : 'zwart') + '.');
      });
    } else {
      showPuz(null, null);
      say('Vind de beste zet voor ' + (pz.turn() === 'w' ? 'wit' : 'zwart') + '.');
    }
  }

  const say = (t: string, cls = '') => (status.innerHTML = `<span class="${cls}"><b>${esc(cur?.title ?? '')}</b><br>${t}</span>`);

  function applyUci(u: string) {
    pz.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  }

  function showPuz(lastUci: string | null, hint: string | null) {
    const userColor = cur!.setup ? (new Chess(cur!.fen).turn() === 'w' ? 'black' : 'white') : (new Chess(cur!.fen).turn() === 'w' ? 'white' : 'black');
    board.show(pz.fen(), {
      orientation: userColor,
      lastMove: lastUci ? [lastUci.slice(0, 2), lastUci.slice(2, 4)] : null,
      movable: solvedState || (cur!.setup && idx === 0) ? null : userColor,
      arrows: hint ? [{ from: hint.slice(0, 2), to: hint.slice(2, 4) }] : [],
    });
  }

  function hintPuzzle(full: boolean) {
    if (!cur || solvedState) return;
    const u = cur.moves[idx];
    if (!u) return;
    failedOnce = true;
    showPuz(null, full ? u : u.slice(0, 2) + u.slice(0, 2));
    if (full) say(`Oplossing: <b>${esc(uciToSan(pz.fen(), u) ?? u)}</b>`);
    else say('Kijk naar het stuk op het gemarkeerde veld.');
    if (!full) board.cg.setAutoShapes([{ orig: u.slice(0, 2) as never, brush: 'green' }]);
  }

  async function puzzleMove(m: UserMove) {
    if (!cur || solvedState) return;
    const uci = m.from + m.to + (m.promotion ?? '');
    const expected = cur.moves[idx];
    const probe = new Chess(pz.fen());
    let ok = uci === expected;
    try {
      probe.move(m);
    } catch {
      showPuz(null, null);
      return;
    }
    if (!ok && probe.isCheckmate()) ok = true; // elke matzet telt
    if (!ok && cur.source === 'mistake') ok = await sameStrength(pz.fen(), expected, uci);
    if (disposed) return;
    if (!ok) {
      if (!failedOnce) recordPuzzle(cur.id, false);
      failedOnce = true;
      board.shake();
      showPuz(null, null);
      say('✗ Niet de beste zet — probeer opnieuw.', 'err');
      return;
    }
    pz.move(m);
    idx++;
    if (idx >= cur.moves.length || pz.isGameOver()) {
      solvedState = true;
      if (!failedOnce) recordPuzzle(cur.id, true);
      showPuz(uci, null);
      say(failedOnce ? '✓ Opgelost (met hulp/fout) — komt snel terug.' : '✓ Goed! Opgelost.', 'ok');
      return;
    }
    // tegenzet automatisch
    showPuz(uci, null);
    await sleep(450);
    if (disposed) return;
    const reply = cur.moves[idx];
    applyUci(reply);
    idx++;
    showPuz(reply, null);
    say('✓ Goed. Wat nu?', 'ok');
  }

  render();
  board.show(new Chess().fen(), { movable: null });

  // gestart vanuit de dagtraining?
  const start = load<{ tab: 'end' | 'puz'; tag?: string; lesson?: string } | null>('theoryStart', null);
  if (start) {
    save('theoryStart', null);
    $(root, `#tt [data-t=${start.tab}]`).click();
    if (start.tab === 'puz' && start.tag) {
      pFilter = start.tag;
      renderPuz();
      nextPuzzle('tag:' + start.tag);
    } else if (start.tab === 'end' && start.lesson) startLesson(LESSONS.find((l) => l.id === start.lesson)!);
  }

  return () => {
    disposed = true;
    liveEngine().stop();
    board.destroy();
  };
}

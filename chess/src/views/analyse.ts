import { Chess } from 'chess.js';
import { Board } from '../board';
import { liveEngine, batchEngine, evWin, lineToEv, type Ev, type PvLine } from '../engine';
import { analyseGame, parseGame, summarize, CLS_INFO, moverWin, type Cls, type GameAnalysis, type ParsedGame } from '../analysis';
import { loadBook, type Book } from '../book';
import { addPuzzles, hash, savedGames, saveGames, saveSettings, settings } from '../store';
import { $, esc, fmtEval, pvToSan, uciToSan } from '../util';

interface ListedGame {
  label: string;
  pgn: string;
}

export function mount(root: HTMLElement): () => void {
  root.innerHTML = `
  <div class="layout">
    <div class="left">
      <div class="boardrow">
        <div class="evalbar"><div class="fill"></div><span>0.0</span></div>
        <div class="board"></div>
      </div>
      <div class="controls">
        <button data-a="start" title="Begin">⏮</button>
        <button data-a="prev" title="Vorige (←)">◀</button>
        <button data-a="next" title="Volgende (→)">▶</button>
        <button data-a="end" title="Einde">⏭</button>
        <button data-a="flip" title="Draai bord (f)">⇅</button>
        <button data-a="explore" title="Probeer eigen zetten vanaf deze stelling">✎ Probeer zetten</button>
      </div>
      <div class="comment" id="comment">Laad een partij om te beginnen.</div>
      <div class="players" id="players"></div>
    </div>
    <div class="right">
      <section class="card">
        <div class="tabs" id="srcTabs">
          <button data-t="pgn" class="on">PGN</button>
          <button data-t="chesscom">Chess.com</button>
          <button data-t="lichess">Lichess</button>
          <button data-t="saved">Opgeslagen</button>
        </div>
        <div id="srcBody"></div>
      </section>
      <section class="card" id="status" hidden></section>
      <section class="card" id="summary" hidden></section>
      <section class="card" id="graphCard" hidden>
        <svg id="graph" viewBox="0 0 400 90" preserveAspectRatio="none"></svg>
      </section>
      <section class="card">
        <label class="inline"><input type="checkbox" id="engOn" checked /> Engine (Stockfish)</label>
        <div id="engine" class="enginelines"></div>
      </section>
      <section class="card moves" id="moves"><p class="muted">Nog geen partij.</p></section>
    </div>
  </div>`;

  const board = new Board($(root, '.board'), onUserMove);
  const el = {
    comment: $(root, '#comment'),
    players: $(root, '#players'),
    srcBody: $(root, '#srcBody'),
    status: $(root, '#status'),
    summary: $(root, '#summary'),
    graphCard: $(root, '#graphCard'),
    graph: $(root, '#graph') as unknown as SVGSVGElement,
    engine: $(root, '#engine'),
    engOn: $<HTMLInputElement>(root, '#engOn'),
    moves: $(root, '#moves'),
    fill: $(root, '.evalbar .fill'),
    evalTxt: $(root, '.evalbar span'),
  };

  let book: Book | null = null;
  void loadBook().then((b) => (book = b));

  let game: ParsedGame | null = null;
  let an: GameAnalysis | null = null;
  let ply = 0;
  let orient: 'white' | 'black' = 'white';
  let explore: string[] | null = null; // stapel van fens in probeer-modus
  let token = 0;
  let disposed = false;
  let liveEv: Ev | null = null;
  let analysing = false;

  /* ---------- bron-tabs ---------- */
  let tab = 'pgn';
  let listed: ListedGame[] = [];
  const cfg = settings();

  function renderSource() {
    $(root, '#srcTabs')
      .querySelectorAll('button')
      .forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.t === tab));
    if (tab === 'pgn') {
      el.srcBody.innerHTML = `<textarea id="pgn" rows="5" placeholder="Plak hier je PGN…"></textarea>
        <div class="row"><label>Diepte <select id="depth">${[12, 14, 16, 18, 20].map((d) => `<option ${d === cfg.depth ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        <button class="primary" id="loadPgn">Laad &amp; analyseer</button></div>`;
      $(el.srcBody, '#loadPgn').onclick = () => {
        const v = ($(el.srcBody, '#pgn') as HTMLTextAreaElement).value;
        cfg.depth = +($(el.srcBody, '#depth') as HTMLSelectElement).value;
        openPgn(v);
      };
    } else if (tab === 'chesscom' || tab === 'lichess') {
      const u = tab === 'chesscom' ? cfg.chesscom : cfg.lichess;
      el.srcBody.innerHTML = `<div class="row"><input id="user" placeholder="gebruikersnaam" value="${esc(u)}" />
        <button class="primary" id="go">Zoek partijen</button></div><div id="list" class="gamelist"></div>`;
      const go = () => void fetchGames(($(el.srcBody, '#user') as HTMLInputElement).value.trim());
      $(el.srcBody, '#go').onclick = go;
      if (u && listed.length) renderList();
    } else {
      const sg = savedGames();
      el.srcBody.innerHTML = sg.length
        ? `<div class="gamelist">${sg
            .map((g) => `<button data-id="${g.id}"><b>${esc(g.title)}</b><span>${new Date(g.date).toLocaleDateString('nl-NL')} · diepte ${g.depth}</span></button>`)
            .join('')}</div>`
        : '<p class="muted">Nog geen opgeslagen analyses. Elke geanalyseerde partij wordt automatisch bewaard.</p>';
      el.srcBody.querySelectorAll<HTMLElement>('[data-id]').forEach((b) => {
        b.onclick = () => {
          const g = savedGames().find((x) => x.id === b.dataset.id);
          if (g) openPgn(g.pgn, g);
        };
      });
    }
  }
  $(root, '#srcTabs').addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).dataset.t;
    if (t) {
      tab = t;
      listed = [];
      renderSource();
    }
  });

  function renderList() {
    const box = el.srcBody.querySelector('#list');
    if (!box) return;
    box.innerHTML = listed.length
      ? listed.map((g, i) => `<button data-i="${i}">${esc(g.label)}</button>`).join('')
      : '<p class="muted">Geen partijen gevonden.</p>';
    box.querySelectorAll<HTMLElement>('[data-i]').forEach((b) => {
      b.onclick = () => {
        cfg.depth = cfg.depth || 16;
        openPgn(listed[+b.dataset.i!].pgn);
      };
    });
  }

  async function fetchGames(user: string) {
    if (!user) return;
    const box = el.srcBody.querySelector('#list')!;
    box.innerHTML = '<p class="muted">Laden…</p>';
    listed = [];
    try {
      if (tab === 'chesscom') {
        cfg.chesscom = user;
        const arch = (await (await fetch(`https://api.chess.com/pub/player/${user.toLowerCase()}/games/archives`)).json()).archives as string[];
        for (const url of arch.slice(-2).reverse()) {
          const data = (await (await fetch(url)).json()).games as any[];
          for (const g of data.slice().reverse()) {
            if (!g.pgn) continue;
            const res = g.white.result === 'win' ? '1-0' : g.black.result === 'win' ? '0-1' : '½-½';
            listed.push({
              label: `${g.white.username} (${g.white.rating}) – ${g.black.username} (${g.black.rating}) · ${res} · ${g.time_class} · ${new Date(g.end_time * 1000).toLocaleDateString('nl-NL')}`,
              pgn: g.pgn,
            });
          }
        }
      } else {
        cfg.lichess = user;
        const txt = await (
          await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=30&pgnInJson=true&opening=true`, {
            headers: { Accept: 'application/x-ndjson' },
          })
        ).text();
        for (const l of txt.trim().split('\n')) {
          if (!l) continue;
          const g = JSON.parse(l);
          const res = g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '½-½';
          listed.push({
            label: `${g.players.white.user?.name ?? 'anoniem'} – ${g.players.black.user?.name ?? 'anoniem'} · ${res} · ${g.speed} · ${new Date(g.createdAt).toLocaleDateString('nl-NL')}`,
            pgn: g.pgn,
          });
        }
      }
      saveSettings(cfg);
    } catch (e) {
      box.innerHTML = `<p class="err">Kon partijen niet ophalen (${esc(String(e))}).</p>`;
      return;
    }
    renderList();
  }

  /* ---------- partij openen & analyseren ---------- */
  function openPgn(pgn: string, saved?: { evals: [number, number | null][]; best: (string | null)[]; depth: number }) {
    token++;
    batchEngine().stop();
    try {
      game = parseGame(pgn);
    } catch (e) {
      el.comment.innerHTML = `<span class="err">Ongeldige PGN: ${esc(String((e as Error).message))}</span>`;
      return;
    }
    if (!game.moves.length) {
      el.comment.innerHTML = '<span class="err">Geen zetten gevonden in deze PGN.</span>';
      return;
    }
    an = null;
    explore = null;
    ply = 0;
    const h = game.headers;
    const me = [cfg.chesscom, cfg.lichess].filter(Boolean).map((s) => s.toLowerCase());
    orient = me.includes((h.Black ?? '').toLowerCase()) ? 'black' : 'white';
    el.players.innerHTML = `<b>${esc(h.White ?? '?')}</b> ${h.WhiteElo ? `(${esc(h.WhiteElo)})` : ''} – <b>${esc(h.Black ?? '?')}</b> ${h.BlackElo ? `(${esc(h.BlackElo)})` : ''} · ${esc(h.Result ?? '*')}`;
    el.summary.hidden = true;
    el.graphCard.hidden = true;
    renderMoves();
    if (saved) {
      const evals = saved.evals.map(([cp, mate]) => ({ cp, mate }));
      an = summarize(game, evals, saved.best, book, saved.depth);
      finishAnalysis();
    } else {
      void runAnalysis();
    }
    update();
  }

  async function runAnalysis() {
    if (!game) return;
    const my = ++token;
    const g = game;
    analysing = true;
    liveEngine().stop();
    el.status.hidden = false;
    el.status.innerHTML = `<div class="progress"><div></div></div><p class="muted" id="pt">Analyseren…</p><button id="cancel">Stop</button>`;
    $(el.status, '#cancel').onclick = () => {
      token++;
      analysing = false;
      batchEngine().stop();
      el.status.hidden = true;
      update();
    };
    if (!book) book = await loadBook();
    const res = await analyseGame(
      g,
      cfg.depth,
      book,
      (d, t) => {
        if (my !== token) return;
        ($(el.status, '.progress div') as HTMLElement).style.width = `${(d / t) * 100}%`;
        $(el.status, '#pt').textContent = `Analyseren… ${d}/${t}`;
      },
      () => my !== token || disposed,
    );
    if (my === token) analysing = false;
    if (!res || my !== token) return;
    an = res;
    const id = hash(g.fens.join('|') + JSON.stringify(g.headers));
    const list = savedGames().filter((x) => x.id !== id);
    list.unshift({
      id,
      title: `${g.headers.White ?? '?'} – ${g.headers.Black ?? '?'}`,
      date: Date.now(),
      pgn: pgnOf(g),
      evals: res.evals.map((e) => [e.cp, e.mate]),
      best: res.best,
      depth: res.depth,
    });
    saveGames(list.slice(0, 40));
    finishAnalysis();
  }

  const pgnOf = (g: ParsedGame) => {
    const c = new Chess();
    for (const m of g.moves) c.move(m.san);
    for (const [k, v] of Object.entries(g.headers)) c.setHeader(k, v);
    return c.pgn();
  };

  function finishAnalysis() {
    el.status.hidden = true;
    renderSummary();
    renderGraph();
    renderMoves();
    update();
  }

  /* ---------- weergave ---------- */
  const curFen = () => (explore ? explore[explore.length - 1] : game ? game.fens[ply] : new Chess().fen());

  function currentEv(): Ev | null {
    if (explore) return liveEv;
    if (liveEv && el.engOn.checked) return liveEv;
    return an?.evals[ply] ?? null;
  }

  function update() {
    liveEv = null;
    const fen = curFen();
    const m = !explore && game && ply > 0 ? game.moves[ply - 1] : null;
    const arrows: { from: string; to: string; color?: string }[] = [];
    let comment = '';
    if (explore) {
      comment = 'Probeer-modus: verzet stukken om varianten te testen. <button class="link" id="back">Terug naar de partij</button>';
    } else if (game && m) {
      const n = Math.ceil(ply / 2);
      const label = `${n}${m.color === 'w' ? '.' : '...'} ${m.san}`;
      if (an) {
        const c = an.cls[ply - 1];
        const info = CLS_INFO[c];
        comment = `<b>${esc(label)}</b> <span class="badge" style="background:${info.color}">${info.sym} ${info.label}</span>`;
        if (c === 'book' && book) {
          const nm = book.nameAt.get(fen.split(' ').slice(0, 4).join(' '));
          if (nm) comment += ` <span class="muted">${esc(nm.name)}</span>`;
        }
        if (c === 'inaccuracy' || c === 'mistake' || c === 'blunder') {
          const b = an.best[ply - 1];
          const san = b ? uciToSan(game.fens[ply - 1], b) : null;
          if (san) comment += `<br>Beter was <b>${esc(san)}</b> <span class="muted">(−${an.loss[ply - 1].toFixed(0)}% winkans)</span>`;
          if (b) arrows.push({ from: b.slice(0, 2), to: b.slice(2, 4), color: 'green' });
        }
      } else comment = `<b>${esc(label)}</b>`;
    } else if (game) comment = 'Beginstelling.';
    el.comment.innerHTML = comment;
    $(el.comment, '#back')?.addEventListener('click', () => {
      explore = null;
      update();
    });
    board.show(fen, {
      orientation: orient,
      lastMove: m ? [m.from, m.to] : null,
      movable: explore ? 'both' : null,
      arrows,
    });
    // zet-lijst markering
    el.moves.querySelectorAll('.on').forEach((n) => n.classList.remove('on'));
    const cell = el.moves.querySelector(`[data-ply="${ply}"]`);
    if (cell && !explore) {
      cell.classList.add('on');
      (cell as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
    drawBar();
    drawGraphMarker();
    startLive();
  }

  function drawBar() {
    const ev = currentEv();
    if (!ev) {
      el.fill.style.height = '50%';
      el.evalTxt.textContent = '';
      return;
    }
    el.fill.style.height = `${evWin(ev)}%`;
    el.evalTxt.textContent = fmtEval(ev.mate == null ? ev.cp : null, ev.mate);
    el.evalTxt.className = evWin(ev) > 50 ? 'dark' : 'light';
    $(root, '.evalbar').classList.toggle('flipped', orient === 'black');
  }

  /* ---------- live engine ---------- */
  function startLive() {
    const eng = liveEngine();
    if (analysing) {
      el.engine.innerHTML = '<p class="muted">Engine wacht tot de partij-analyse klaar is…</p>';
      return;
    }
    if (!el.engOn.checked) {
      eng.stop();
      el.engine.innerHTML = '';
      liveEv = null;
      return;
    }
    const fen = curFen();
    const c = new Chess(fen);
    if (c.isGameOver()) {
      eng.stop();
      liveEv = null;
      el.engine.innerHTML = `<p class="muted">${c.isCheckmate() ? 'Schaakmat.' : 'Einde van de partij.'}</p>`;
      return;
    }
    liveEv = null;
    void eng.analyse(fen, {
      depth: 20,
      multipv: 3,
      onInfo: (lines) => {
        if (disposed || fen !== curFen()) return;
        renderLines(fen, lines);
      },
    });
  }

  function renderLines(fen: string, lines: PvLine[]) {
    if (!lines.length) return;
    liveEv = lineToEv(lines[0]);
    drawBar();
    el.engine.innerHTML = lines
      .map(
        (l) => `<div class="pvline"><span class="pvev">${fmtEval(l.cp, l.mate)}</span><span class="pvmoves">${esc(pvToSan(fen, l.pv, 9))}</span><span class="muted">d${l.depth}</span></div>`,
      )
      .join('');
  }
  el.engOn.onchange = () => update();

  function onUserMove(m: { from: string; to: string; promotion?: string }) {
    if (!explore) return;
    const c = new Chess(curFen());
    try {
      c.move(m);
    } catch {
      update();
      return;
    }
    explore.push(c.fen());
    board.show(c.fen(), { lastMove: [m.from, m.to], movable: 'both' });
    drawBar();
    startLive();
  }

  /* ---------- samenvatting, grafiek, zetten ---------- */
  function renderSummary() {
    if (!an || !game) return;
    const count = (white: boolean, c: Cls) => an!.cls.filter((x, i) => x === c && (game!.moves[i].color === 'w') === white).length;
    const order: Cls[] = ['book', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'];
    el.summary.hidden = false;
    el.summary.innerHTML = `
      <div class="acc"><div><small>${esc(game.headers.White ?? 'Wit')}</small><b>${an.acc.w.toFixed(1)}%</b></div>
      <div class="muted">nauwkeurigheid</div>
      <div><small>${esc(game.headers.Black ?? 'Zwart')}</small><b>${an.acc.b.toFixed(1)}%</b></div></div>
      <table class="cnt">${order
        .map((c) => `<tr><td>${count(true, c)}</td><td><span class="badge" style="background:${CLS_INFO[c].color}">${CLS_INFO[c].sym}</span> ${CLS_INFO[c].label}</td><td>${count(false, c)}</td></tr>`)
        .join('')}</table>
      <button id="saveMistakes">Bewaar fouten van ${orient === 'white' ? 'wit' : 'zwart'} als puzzels</button>
      <span class="muted" id="saveMsg"></span>`;
    $(el.summary, '#saveMistakes').onclick = () => {
      if (!an || !game) return;
      const color = orient === 'white' ? 'w' : 'b';
      const items = game.moves
        .map((m, i) => ({ m, i }))
        .filter(({ m, i }) => m.color === color && (an!.cls[i] === 'mistake' || an!.cls[i] === 'blunder') && an!.best[i])
        .map(({ i }) => ({
          id: `m-${hash(game!.fens[i])}`,
          fen: game!.fens[i],
          moves: [an!.best[i]!],
          setup: false,
          title: `${game!.headers.White} – ${game!.headers.Black}, zet ${Math.floor(i / 2) + 1}`,
          source: 'mistake' as const,
        }));
      const n = addPuzzles(items);
      $(el.summary, '#saveMsg').textContent = n ? ` ${n} puzzel(s) toegevoegd bij Theorie & puzzels.` : ' Geen nieuwe fouten om op te slaan.';
    };
  }

  function renderGraph() {
    if (!an) return;
    el.graphCard.hidden = false;
    const n = an.evals.length - 1;
    const pts = an.evals.map((e, i) => [(i / n) * 400, 90 - evWin(e) * 0.9]);
    const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const dots = an.cls
      .map((c, i) => (c === 'blunder' || c === 'mistake' ? `<circle cx="${pts[i + 1][0]}" cy="${pts[i + 1][1]}" r="2.6" fill="${CLS_INFO[c].color}" />` : ''))
      .join('');
    el.graph.innerHTML = `<rect width="400" height="90" fill="#262421"/><polygon points="0,90 ${line} 400,90" fill="#e8e6e3" opacity=".85"/>
      <line x1="0" x2="400" y1="45" y2="45" stroke="#7a7570" stroke-dasharray="2 3" stroke-width=".6"/>${dots}
      <line id="marker" y1="0" y2="90" stroke="#7fa650" stroke-width="1.4"/>`;
    el.graph.onclick = (ev) => {
      const r = el.graph.getBoundingClientRect();
      goto(Math.round(((ev.clientX - r.left) / r.width) * n));
    };
  }
  function drawGraphMarker() {
    if (!an || !game) return;
    const mk = el.graph.querySelector('#marker');
    const x = (ply / (an.evals.length - 1)) * 400;
    mk?.setAttribute('x1', String(x));
    mk?.setAttribute('x2', String(x));
  }

  function renderMoves() {
    if (!game) return;
    const g = game;
    const cell = (i: number) => {
      const m = g.moves[i];
      if (!m) return '<span></span>';
      const c = an?.cls[i];
      const bad = c === 'inaccuracy' || c === 'mistake' || c === 'blunder';
      const ev = an ? an.evals[i + 1] : null;
      return `<button data-ply="${i + 1}" class="mv ${bad ? c : ''}">${esc(m.san)}${c && c !== 'good' && c !== 'excellent' && c !== 'best' ? `<i style="color:${CLS_INFO[c].color}">${CLS_INFO[c].sym}</i>` : ''}${ev ? `<small>${fmtEval(ev.mate == null ? ev.cp : null, ev.mate)}</small>` : ''}</button>`;
    };
    let html = '';
    for (let i = 0; i < g.moves.length; i += 2) html += `<div class="mrow"><span class="num">${i / 2 + 1}.</span>${cell(i)}${cell(i + 1)}</div>`;
    el.moves.innerHTML = html;
    el.moves.querySelectorAll<HTMLElement>('[data-ply]').forEach((b) => (b.onclick = () => goto(+b.dataset.ply!)));
  }

  function goto(p: number) {
    if (!game) return;
    explore = null;
    ply = Math.max(0, Math.min(game.moves.length, p));
    update();
  }

  root.querySelector('.controls')!.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.a;
    if (!a) return;
    if (a === 'start') goto(0);
    else if (a === 'end') goto(game?.moves.length ?? 0);
    else if (a === 'prev') (explore && explore.length > 1 ? (explore.pop(), update()) : goto(ply - 1));
    else if (a === 'next') goto(ply + 1);
    else if (a === 'flip') {
      orient = orient === 'white' ? 'black' : 'white';
      board.flip();
      drawBar();
    } else if (a === 'explore') {
      explore = [curFen()];
      update();
    }
  });

  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).matches('input,textarea,select')) return;
    if (e.key === 'ArrowLeft') goto(ply - 1);
    else if (e.key === 'ArrowRight') goto(ply + 1);
    else if (e.key === 'Home') goto(0);
    else if (e.key === 'End') goto(game?.moves.length ?? 0);
    else if (e.key === 'f') {
      orient = orient === 'white' ? 'black' : 'white';
      board.flip();
      drawBar();
    }
  };
  window.addEventListener('keydown', onKey);

  renderSource();
  board.show(new Chess().fen(), { orientation: 'white', movable: null });
  startLive();

  return () => {
    disposed = true;
    token++;
    window.removeEventListener('keydown', onKey);
    liveEngine().stop();
    batchEngine().stop();
    board.destroy();
  };
}

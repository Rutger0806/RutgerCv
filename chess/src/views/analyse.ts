import { Chess } from 'chess.js';
import { Board } from '../board';
import { liveEngine, batchEngine, evWin, lineToEv, sameStrength, type Ev, type PvLine } from '../engine';
import { analyseGame, parseGame, summarize, CLS_INFO, BAD, KEY, type Cls, type GameAnalysis, type ParsedGame } from '../analysis';
import { coach } from '../coach';
import { loadBook, type Book } from '../book';
import { addPuzzles, hash, savedGames, saveGames, saveSettings, settings } from '../store';
import { $, esc, fmtEval, load, pvToSan, save } from '../util';

interface ListedGame {
  label: string;
  pgn: string;
  res: 'win' | 'loss' | 'draw' | '';
  speed: string;
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
      <section class="card coach" id="coach" hidden>
        <div class="coachrow"><div class="avatar">♞</div><div class="bubble" id="bubble"></div></div>
        <div class="row" id="coachBtns">
          <button data-c="prevkey">◀ Vorig moment</button>
          <button data-c="nextkey" class="primary">Volgend moment ▶</button>
          <button data-c="best" id="bBest">💡 Toon beste zet</button>
          <button data-c="retry" id="bRetry">↻ Probeer opnieuw</button>
        </div>
        <label class="inline small"><input type="checkbox" id="both" /> Ook zetten van de tegenstander</label>
      </section>
      <section class="card" id="status" hidden></section>
      <section class="card" id="graphCard" hidden>
        <svg id="graph" viewBox="0 0 400 90" preserveAspectRatio="none"></svg>
      </section>
      <section class="card">
        <label class="inline"><input type="checkbox" id="engOn" checked /> Engine (Stockfish)</label>
        <div id="engine" class="enginelines"></div>
      </section>
      <section class="card moves" id="moves"><p class="muted">Nog geen partij.</p></section>
      <section class="card" id="summary" hidden></section>
    </div>
  </div>`;

  const board = new Board($(root, '.board'), onUserMove);
  const el = {
    comment: $(root, '#comment'),
    players: $(root, '#players'),
    srcBody: $(root, '#srcBody'),
    status: $(root, '#status'),
    coach: $(root, '#coach'),
    bubble: $(root, '#bubble'),
    both: $<HTMLInputElement>(root, '#both'),
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
  let meColor: 'w' | 'b' | null = null;
  let showBest = false;
  let retry: number | null = null;
  let retryDone = false;

  /* ---------- bron-tabs ---------- */
  let tab = 'pgn';
  let listed: ListedGame[] = [];
  let archives: string[] = [];
  let archIdx = -1;
  let hasMore = false;
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
        <button class="primary" id="go">${u ? 'Vernieuwen' : 'Zoek partijen'}</button></div>
        <div class="row small"><select id="tc"><option value="">Alle speeltempo\'s</option><option>bullet</option><option>blitz</option><option>rapid</option><option>classical</option><option>daily</option></select>
        <span class="muted" id="cnt"></span></div>
        <div id="list" class="gamelist"></div><button id="more" hidden>Oudere partijen laden</button>`;
      const go = () => {
        listed = [];
        archIdx = -1;
        void fetchGames(($(el.srcBody, '#user') as HTMLInputElement).value.trim());
      };
      $(el.srcBody, '#go').onclick = go;
      $(el.srcBody, '#more').onclick = () => void fetchGames(($(el.srcBody, '#user') as HTMLInputElement).value.trim());
      ($(el.srcBody, '#tc') as HTMLSelectElement).onchange = () => renderList();
      if (listed.length) renderList();
      else if (u) go();
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
    const tc = ($(el.srcBody, '#tc') as HTMLSelectElement)?.value ?? '';
    const shown = listed.filter((g) => !tc || g.speed === tc);
    const tag = { win: 'Winst', loss: 'Verlies', draw: 'Remise', '': '' };
    box.innerHTML = shown.length
      ? shown.map((g) => `<button class="g ${g.res}" data-i="${listed.indexOf(g)}"><b>${tag[g.res]}</b> ${esc(g.label)}</button>`).join('')
      : '<p class="muted">Geen partijen gevonden.</p>';
    $(el.srcBody, '#cnt').textContent = `${shown.length} partijen`;
    $(el.srcBody, '#more').hidden = !hasMore;
    box.querySelectorAll<HTMLElement>('[data-i]').forEach((b) => {
      b.onclick = () => openPgn(listed[+b.dataset.i!].pgn);
    });
  }

  async function fetchGames(user: string) {
    if (!user) return;
    const box = el.srcBody.querySelector('#list')!;
    box.innerHTML = '<p class="muted">Laden…</p>';
    try {
      if (tab === 'chesscom') {
        const name = user.toLowerCase();
        if (cfg.chesscom !== user) {
          cfg.chesscom = user;
          listed = [];
          archives = [];
        }
        if (!archives.length || archIdx < 0) {
          const r = await fetch(`https://api.chess.com/pub/player/${name}/games/archives`);
          if (!r.ok) throw new Error(r.status === 404 ? 'gebruiker niet gevonden' : `HTTP ${r.status}`);
          archives = ((await r.json()).archives as string[]) ?? [];
          archIdx = archives.length;
        }
        // laad steeds de volgende (oudere) maand tot er genoeg partijen zijn
        let added = 0;
        while (archIdx > 0 && added < 15) {
          archIdx--;
          const data = (await (await fetch(archives[archIdx])).json()).games as any[];
          for (const g of data.slice().reverse()) {
            if (!g.pgn) continue;
            const mine = g.white.username.toLowerCase() === name ? g.white : g.black;
            const res = mine.result === 'win' ? 'win' : ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(mine.result) ? 'draw' : 'loss';
            listed.push({
              label: `${g.white.username} (${g.white.rating}) – ${g.black.username} (${g.black.rating}) · ${g.time_class} · ${new Date(g.end_time * 1000).toLocaleDateString('nl-NL')}`,
              pgn: g.pgn,
              res,
              speed: g.time_class,
            });
            added++;
          }
        }
        hasMore = archIdx > 0;
      } else {
        cfg.lichess = user;
        const txt = await (
          await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=40&pgnInJson=true&opening=true`, {
            headers: { Accept: 'application/x-ndjson' },
          })
        ).text();
        listed = [];
        for (const l of txt.trim().split('\n')) {
          if (!l) continue;
          const g = JSON.parse(l);
          const wn = g.players.white.user?.name ?? 'anoniem';
          const iAmWhite = wn.toLowerCase() === user.toLowerCase();
          const res = !g.winner ? 'draw' : (g.winner === 'white') === iAmWhite ? 'win' : 'loss';
          listed.push({
            label: `${wn} – ${g.players.black.user?.name ?? 'anoniem'} · ${g.speed} · ${new Date(g.createdAt).toLocaleDateString('nl-NL')}`,
            pgn: g.pgn,
            res,
            speed: g.speed,
          });
        }
        hasMore = false;
      }
      saveSettings(cfg);
    } catch (e) {
      box.innerHTML = `<p class="err">Kon partijen niet ophalen (${esc(String(e))}).</p>`;
      return;
    }
    renderList();
  }

  /* ---------- partij openen & analyseren ---------- */
  function openPgn(pgn: string, saved?: { evals: [number, number | null][]; best: (string | null)[]; depth: number; alt?: ([number, number | null] | null)[] }) {
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
    meColor = me.includes((h.White ?? '').toLowerCase()) ? 'w' : me.includes((h.Black ?? '').toLowerCase()) ? 'b' : null;
    orient = meColor === 'b' ? 'black' : 'white';
    el.both.checked = !meColor;
    retry = null;
    showBest = false;
    el.players.innerHTML = `<b>${esc(h.White ?? '?')}</b> ${h.WhiteElo ? `(${esc(h.WhiteElo)})` : ''} – <b>${esc(h.Black ?? '?')}</b> ${h.BlackElo ? `(${esc(h.BlackElo)})` : ''} · ${esc(h.Result ?? '*')}`;
    el.summary.hidden = true;
    el.graphCard.hidden = true;
    renderMoves();
    if (saved) {
      const evals = saved.evals.map(([cp, mate]) => ({ cp, mate }));
      const alt = ((saved as { alt?: ([number, number | null] | null)[] }).alt ?? []).map((a) => (a ? { cp: a[0], mate: a[1] } : null));
      an = summarize(game, evals, saved.best, book, saved.depth, alt);
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
      alt: res.alt.map((e) => (e ? [e.cp, e.mate] : null)),
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
  const curFen = () => (explore ? explore[explore.length - 1] : game ? game.fens[retry != null ? retry - 1 : ply] : new Chess().fen());

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
    let badge: { sq: string; text: string; color: string } | null = null;
    if (explore) {
      comment = 'Probeer-modus: verzet stukken om varianten te testen. <button class="link" id="back">Terug naar de partij</button>';
    } else if (game && m) {
      const n = Math.ceil(ply / 2);
      const label = `${n}${m.color === 'w' ? '.' : '...'} ${m.san}`;
      comment = `<b>${esc(label)}</b>`;
      if (an) {
        const c = an.cls[ply - 1];
        const info = CLS_INFO[c];
        comment += ` <span class="badge" style="background:${info.color}">${info.sym} ${info.label}</span>`;
        if (c !== 'good' && c !== 'excellent') badge = { sq: m.to, text: info.mark, color: info.color };
        const b = an.best[ply - 1];
        if (showBest && b && BAD.includes(c)) arrows.push({ from: b.slice(0, 2), to: b.slice(2, 4), color: 'green' });
      }
    } else if (game) comment = 'Beginstelling.';
    el.comment.innerHTML = comment;
    $(el.comment, '#back')?.addEventListener('click', () => {
      explore = null;
      update();
    });
    if (retry != null && game) {
      const rm = game.moves[retry - 1];
      const prev = retry > 1 ? game.moves[retry - 2] : null;
      board.show(fen, {
        orientation: orient,
        lastMove: prev ? [prev.from, prev.to] : null,
        movable: retryDone ? null : rm.color === 'w' ? 'white' : 'black',
      });
    } else {
      board.show(fen, {
        orientation: orient,
        lastMove: m ? [m.from, m.to] : null,
        movable: explore ? 'both' : null,
        arrows,
        badge: explore ? null : badge,
      });
    }
    renderCoach();
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
    if (retry != null) {
      eng.stop();
      el.engine.innerHTML = '<p class="muted">Engine verborgen tijdens “Probeer opnieuw”.</p>';
      return;
    }
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

  async function onUserMove(m: { from: string; to: string; promotion?: string }) {
    if (retry != null && game && an && !retryDone) {
      const i = retry - 1;
      const fen0 = game.fens[i];
      const c0 = new Chess(fen0);
      try {
        c0.move(m);
      } catch {
        update();
        return;
      }
      const uci = m.from + m.to + (m.promotion ?? '');
      const bestU = an.best[i] ?? uci;
      board.show(c0.fen(), { orientation: orient, lastMove: [m.from, m.to], movable: null });
      el.bubble.innerHTML = 'Even checken…';
      const ok = await sameStrength(fen0, bestU, uci, 5);
      if (disposed || retry == null) return;
      if (ok) {
        retryDone = true;
        el.bubble.innerHTML = '<b>Goed!</b> 🎉 Dat is een sterke zet. Ga verder met “Volgend moment”.';
      } else {
        board.shake();
        el.bubble.innerHTML = 'Niet helemaal — probeer een andere zet, of laat de beste zet zien.';
        board.show(fen0, { orientation: orient, movable: game.moves[i].color === 'w' ? 'white' : 'black' });
      }
      return;
    }
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

  /* ---------- coach ---------- */
  const keyPlies = () => {
    if (!an || !game) return [] as number[];
    const both = el.both.checked || !meColor;
    const out: number[] = [];
    an.cls.forEach((c, i) => {
      if (KEY.includes(c) && (both || game!.moves[i].color === meColor)) out.push(i + 1);
    });
    return out;
  };

  function renderCoach() {
    if (!an || !game) {
      el.coach.hidden = true;
      return;
    }
    el.coach.hidden = false;
    const btn = (id: string) => $<HTMLButtonElement>(el.coach, id);
    let html = '';
    let canBest = false;
    if (explore) html = 'Probeer maar wat varianten uit. De engine rekent mee aan de rechterkant.';
    else if (retry != null) {
      html = retryDone ? el.bubble.innerHTML : 'Zoek een betere zet dan in de partij. Ik kijk straks of hij sterk genoeg is.';
      canBest = !retryDone;
    } else if (ply === 0) {
      const mine = meColor ? (meColor === 'w' ? an.acc.w : an.acc.b) : null;
      const keys = keyPlies();
      const bl = keys.filter((p) => an!.cls[p - 1] === 'blunder').length;
      const br = keys.filter((p) => an!.cls[p - 1] === 'brilliant').length;
      let opening = '';
      if (book) {
        for (let i = game.moves.length; i >= 0; i--) {
          const nm = book.nameAt.get(game.fens[i].split(' ').slice(0, 4).join(' '));
          if (nm) {
            opening = nm.name;
            break;
          }
        }
      }
      html = `Hoi! Ik loop de partij met je door. ${mine != null ? `Jouw nauwkeurigheid: <b>${mine.toFixed(1)}%</b>. ` : `Nauwkeurigheid: wit <b>${an.acc.w.toFixed(1)}%</b>, zwart <b>${an.acc.b.toFixed(1)}%</b>. `}
        Er ${keys.length === 1 ? 'is' : 'zijn'} <b>${keys.length}</b> sleutelmoment${keys.length === 1 ? '' : 'en'}${bl ? ` (waarvan ${bl} blunder${bl > 1 ? 's' : ''})` : ''}${br ? `, en ${br} briljante zet${br > 1 ? 'ten' : ''}!` : '.'}
        ${opening ? `<br>Opening: <i>${esc(opening)}</i>.` : ''}<br>Klik op <b>Volgend moment</b> om te beginnen.`;
    } else {
      const co = coach(game, an, ply - 1, book);
      html = co.html;
      canBest = !!co.best;
    }
    el.bubble.innerHTML = html;
    btn('#bBest').hidden = !canBest;
    btn('#bRetry').hidden = !(ply > 0 && !explore && retry == null && BAD.includes(an.cls[ply - 1]) && !!an.best[ply - 1]);
    btn('#bBest').textContent = showBest ? 'Verberg beste zet' : '💡 Toon beste zet';
  }

  el.coach.addEventListener('click', (e) => {
    const c = (e.target as HTMLElement).dataset.c;
    if (!c || !game || !an) return;
    const keys = keyPlies();
    if (c === 'nextkey') {
      const n = keys.find((p) => p > ply && retry == null) ?? keys.find((p) => p > (retry ?? ply));
      if (n) goto(n);
      else {
        goto(game.moves.length);
        el.bubble.innerHTML = 'Dat waren alle sleutelmomenten. Bewaar je fouten als puzzels om ze later te oefenen!';
      }
    } else if (c === 'prevkey') {
      const prev = [...keys].reverse().find((p) => p < (retry ?? ply));
      goto(prev ?? 0);
    } else if (c === 'best') {
      if (retry != null) {
        const b = an.best[retry - 1];
        if (b) board.setArrows([{ from: b.slice(0, 2), to: b.slice(2, 4), color: 'green' }]);
      } else {
        showBest = !showBest;
        update();
      }
    } else if (c === 'retry') {
      retry = ply;
      retryDone = false;
      update();
    }
  });
  el.both.onchange = () => renderCoach();

  /* ---------- samenvatting, grafiek, zetten ---------- */
  function renderSummary() {
    if (!an || !game) return;
    const count = (white: boolean, c: Cls) => an!.cls.filter((x, i) => x === c && (game!.moves[i].color === 'w') === white).length;
    const order: Cls[] = ['brilliant', 'great', 'book', 'best', 'excellent', 'good', 'inaccuracy', 'miss', 'mistake', 'blunder'];
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
        .filter(({ m, i }) => m.color === color && (an!.cls[i] === 'mistake' || an!.cls[i] === 'blunder' || an!.cls[i] === 'miss') && an!.best[i])
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
      .map((c, i) => (c === 'blunder' || c === 'mistake' || c === 'brilliant' ? `<circle cx="${pts[i + 1][0]}" cy="${pts[i + 1][1]}" r="2.6" fill="${CLS_INFO[c].color}" />` : ''))
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
      const bad = !!c && BAD.includes(c);
      const ev = an ? an.evals[i + 1] : null;
      return `<button data-ply="${i + 1}" class="mv ${bad ? c : ''}">${esc(m.san)}${c && c !== 'good' && c !== 'excellent' && c !== 'best' && c !== 'book' ? `<i style="color:${CLS_INFO[c].color}">${CLS_INFO[c].sym}</i>` : ''}${ev ? `<small>${fmtEval(ev.mate == null ? ev.cp : null, ev.mate)}</small>` : ''}</button>`;
    };
    let html = '';
    for (let i = 0; i < g.moves.length; i += 2) html += `<div class="mrow"><span class="num">${i / 2 + 1}.</span>${cell(i)}${cell(i + 1)}</div>`;
    el.moves.innerHTML = html;
    el.moves.querySelectorAll<HTMLElement>('[data-ply]').forEach((b) => (b.onclick = () => goto(+b.dataset.ply!)));
  }

  function goto(p: number) {
    if (!game) return;
    explore = null;
    retry = null;
    retryDone = false;
    showBest = false;
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
  const wanted = load<string | null>('openGame', null);
  if (wanted) {
    save('openGame', null);
    const g = savedGames().find((x) => x.id === wanted);
    if (g) openPgn(g.pgn, g);
  }
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

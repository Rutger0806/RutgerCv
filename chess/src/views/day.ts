import { analyseGame, parseGame, summarize, type GameAnalysis, type ParsedGame } from '../analysis';
import { batchEngine } from '../engine';
import { loadBook, type Book } from '../book';
import { addPuzzles, hash, repertoire, savedGames, saveGames, saveRepertoire, saveSettings, settings } from '../store';
import { issuesFor, openingLeak, THEMES, type Issue, type OpeningLeak, type Phase, type Theme } from '../themes';
import { $, esc, save } from '../util';

interface DayGame {
  pgn: string;
  label: string;
  color: 'w' | 'b';
  result: 'win' | 'loss' | 'draw';
  speed: string;
  opponent: string;
}

interface Done {
  game: DayGame;
  parsed: ParsedGame;
  an: GameAnalysis;
  id: string;
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const go = (tab: string) => {
  location.hash = tab;
};

export function mount(root: HTMLElement): () => void {
  const cfg = settings();
  root.innerHTML = `<div class="page wide">
    <section class="card">
      <h3>Dagtraining</h3>
      <p class="muted">Kies een dag. Ik haal je partijen op, analyseer ze, zoek je meest gemaakte soort fouten en maak daar oefeningen van.</p>
      <div class="row">
        <label>Dag <input type="date" id="date" value="${todayStr()}" style="width:auto" /></label>
        <label>Diepte <select id="depth">${[10, 12, 14, 16].map((d) => `<option ${d === 12 ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      </div>
      <div class="row"><input id="cc" placeholder="Chess.com gebruikersnaam" value="${esc(cfg.chesscom)}" />
        <input id="li" placeholder="Lichess gebruikersnaam (optioneel)" value="${esc(cfg.lichess)}" /></div>
      <button class="primary" id="run">Analyseer mijn dag</button>
      <div id="prog" class="feedback"></div>
    </section>
    <div id="report"></div>
  </div>`;

  const prog = $(root, '#prog');
  const report = $(root, '#report');
  let stop = false;
  let running = false;
  let disposed = false;
  let book: Book | null = null;

  $(root, '#run').onclick = () => (running ? (stop = true) : void run());

  async function fetchDay(date: string, cc: string, li: string): Promise<DayGame[]> {
    const [y, m, d] = date.split('-').map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0).getTime();
    const end = start + 86400000;
    const out: DayGame[] = [];
    if (cc) {
      const months = new Set([start, end - 1].map((t) => {
        const x = new Date(t);
        return `${x.getUTCFullYear()}/${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
      }));
      for (const mo of months) {
        const r = await fetch(`https://api.chess.com/pub/player/${cc.toLowerCase()}/games/${mo}`);
        if (!r.ok) {
          if (r.status === 404 && months.size > 0) continue;
          throw new Error(`Chess.com: HTTP ${r.status}`);
        }
        for (const g of (await r.json()).games as any[]) {
          const t = g.end_time * 1000;
          if (!g.pgn || t < start || t >= end) continue;
          const white = g.white.username.toLowerCase() === cc.toLowerCase();
          const mine = white ? g.white : g.black;
          const opp = white ? g.black : g.white;
          out.push({
            pgn: g.pgn,
            label: `${g.white.username} – ${g.black.username}`,
            color: white ? 'w' : 'b',
            result: mine.result === 'win' ? 'win' : ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(mine.result) ? 'draw' : 'loss',
            speed: g.time_class,
            opponent: opp.username,
          });
        }
      }
    }
    if (li) {
      const r = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(li)}?since=${start}&until=${end}&pgnInJson=true`, {
        headers: { Accept: 'application/x-ndjson' },
      });
      if (!r.ok) throw new Error(`Lichess: HTTP ${r.status}`);
      for (const l of (await r.text()).trim().split('\n')) {
        if (!l) continue;
        const g = JSON.parse(l);
        const white = (g.players.white.user?.name ?? '').toLowerCase() === li.toLowerCase();
        const opp = (white ? g.players.black.user?.name : g.players.white.user?.name) ?? 'anoniem';
        out.push({
          pgn: g.pgn,
          label: `${g.players.white.user?.name ?? 'anoniem'} – ${g.players.black.user?.name ?? 'anoniem'}`,
          color: white ? 'w' : 'b',
          result: !g.winner ? 'draw' : (g.winner === 'white') === white ? 'win' : 'loss',
          speed: g.speed,
          opponent: opp,
        });
      }
    }
    return out;
  }

  async function run() {
    const date = ($(root, '#date') as HTMLInputElement).value;
    const depth = +($(root, '#depth') as HTMLSelectElement).value;
    const cc = ($(root, '#cc') as HTMLInputElement).value.trim();
    const li = ($(root, '#li') as HTMLInputElement).value.trim();
    if (!cc && !li) {
      prog.innerHTML = '<span class="err">Vul een Chess.com- of Lichess-naam in.</span>';
      return;
    }
    saveSettings({ ...cfg, chesscom: cc, lichess: li });
    running = true;
    stop = false;
    $(root, '#run').textContent = 'Stop';
    report.innerHTML = '';
    prog.textContent = 'Partijen ophalen…';
    try {
      book ??= await loadBook();
      const games = await fetchDay(date, cc, li);
      if (!games.length) {
        prog.innerHTML = `Geen partijen gevonden op ${esc(date)}.`;
        return;
      }
      const done: Done[] = [];
      const saved = savedGames();
      for (let gi = 0; gi < games.length; gi++) {
        if (stop || disposed) break;
        const dg = games[gi];
        let parsed: ParsedGame;
        try {
          parsed = parseGame(dg.pgn);
        } catch {
          continue;
        }
        if (parsed.moves.length < 4) continue;
        const id = hash(parsed.fens.join('|') + JSON.stringify(parsed.headers));
        const hit = saved.find((s) => s.id === id && s.depth >= depth && s.alt);
        let an: GameAnalysis | null;
        if (hit) {
          an = summarize(parsed, hit.evals.map(([cp, mate]) => ({ cp, mate })), hit.best, book, hit.depth, (hit.alt ?? []).map((a) => (a ? { cp: a[0], mate: a[1] } : null)));
        } else {
          an = await analyseGame(
            parsed,
            depth,
            book,
            (d, t) => (prog.innerHTML = `Partij ${gi + 1}/${games.length} analyseren… zet ${d}/${t} <div class="progress"><div style="width:${((gi + d / t) / games.length) * 100}%"></div></div>`),
            () => stop || disposed,
          );
          if (!an) break;
          const list = savedGames().filter((x) => x.id !== id);
          list.unshift({
            id,
            title: `${parsed.headers.White ?? '?'} – ${parsed.headers.Black ?? '?'}`,
            date: Date.now(),
            pgn: dg.pgn,
            evals: an.evals.map((e) => [e.cp, e.mate]),
            alt: an.alt.map((e) => (e ? [e.cp, e.mate] : null)),
            best: an.best,
            depth,
          });
          saveGames(list.slice(0, 60));
        }
        done.push({ game: dg, parsed, an, id });
      }
      if (disposed) return;
      prog.textContent = stop ? 'Gestopt — rapport van wat al klaar is.' : '';
      if (done.length) renderReport(date, done);
      else prog.textContent = 'Geen analyseerbare partijen.';
    } catch (e) {
      prog.innerHTML = `<span class="err">Mislukt: ${esc(String((e as Error).message ?? e))}</span>`;
    } finally {
      running = false;
      batchEngine().stop();
      if (!disposed) $(root, '#run').textContent = 'Analyseer mijn dag';
    }
  }

  function renderReport(date: string, done: Done[]) {
    const issues: Issue[] = [];
    const leaks: OpeningLeak[] = [];
    done.forEach((d, i) => {
      issues.push(...issuesFor(d.parsed, d.an, d.game.color, i));
      const lk = openingLeak(d.parsed, d.an, d.game.color, book!, i);
      if (lk) leaks.push(lk);
    });
    const wins = done.filter((d) => d.game.result === 'win').length;
    const losses = done.filter((d) => d.game.result === 'loss').length;
    const accs = done.map((d) => (d.game.color === 'w' ? d.an.acc.w : d.an.acc.b));
    const avgAcc = accs.reduce((a, b) => a + b, 0) / accs.length;
    const brill = done.reduce((n, d) => n + d.an.cls.filter((c, i) => (c === 'brilliant' || c === 'great') && d.parsed.moves[i].color === d.game.color).length, 0);

    // puzzels aanmaken (met thema-tags)
    const dayTag = `Dag ${date}`;
    addPuzzles(
      issues.map((is) => ({
        id: `m-${hash(is.fen)}`,
        fen: is.fen,
        moves: [is.best!],
        setup: false,
        title: `${done[is.gameIdx].game.opponent}, zet ${Math.ceil(is.ply / 2)} (${THEMES[is.theme].name})`,
        source: 'mistake' as const,
        tags: [dayTag, THEMES[is.theme].name],
      })),
    );

    // thema's
    const groups = new Map<Theme, Issue[]>();
    for (const is of issues) groups.set(is.theme, [...(groups.get(is.theme) ?? []), is]);
    const ranked = [...groups.entries()]
      .map(([t, list]) => ({ t, list, total: list.reduce((s, x) => s + x.loss, 0) }))
      .sort((a, b) => b.total - a.total);

    const phases: Record<Phase, number> = { opening: 0, middle: 0, end: 0 };
    issues.forEach((i) => phases[i.phase]++);
    const maxPh = Math.max(1, ...Object.values(phases));
    const pname: Record<Phase, string> = { opening: 'Opening', middle: 'Middenspel', end: 'Eindspel' };

    const worst = (t: Theme) => THEMES[t].name;
    const plan: string[] = [];
    if (ranked[0]) plan.push(`<b>${THEMES[ranked[0].t].icon} ${worst(ranked[0].t)}</b> is je grootste lek vandaag. ${esc(THEMES[ranked[0].t].advice)} <button data-tag="${esc(worst(ranked[0].t))}">Oefen ${ranked[0].list.length} puzzel(s)</button>`);
    if (ranked[1]) plan.push(`Daarna: <b>${THEMES[ranked[1].t].icon} ${worst(ranked[1].t)}</b>. <button data-tag="${esc(worst(ranked[1].t))}">Oefen ${ranked[1].list.length} puzzel(s)</button>`);
    if (leaks.length) plan.push(`Herhaal de openinglijnen waar je uit de theorie ging (zie hieronder) — één minuut per lijn.`);
    if (phases.end >= 2) plan.push(`Je maakte ${phases.end} fouten in het eindspel. <button id="endBtn">Oefen eindspelen</button>`);
    if (issues.length) plan.push(`Sluit af met alle ${issues.length} fouten van vandaag. <button class="primary" data-tag="${esc(dayTag)}">Start dagpuzzels</button>`);
    if (!issues.length) plan.push('Geen noemenswaardige fouten — sterke dag! Probeer morgen een lastiger tempo of oefen openingen.');

    report.innerHTML = `
    <section class="card">
      <h3>Rapport ${esc(date)}</h3>
      <div class="stats">
        <div><b>${done.length}</b><small>partijen</small></div>
        <div><b>${wins}-${losses}-${done.length - wins - losses}</b><small>W-V-R</small></div>
        <div><b>${avgAcc.toFixed(1)}%</b><small>nauwkeurigheid</small></div>
        <div><b>${issues.length}</b><small>fouten</small></div>
        <div><b>${brill}</b><small>geweldige zetten</small></div>
      </div>
    </section>
    <section class="card"><h3>Jouw oefenplan</h3><ol class="plan">${plan.map((p) => `<li>${p}</li>`).join('')}</ol></section>
    ${
      ranked.length
        ? `<section class="card"><h3>Meest gemaakte fouten</h3>${ranked
            .map(({ t, list, total }) => `
          <div class="theme">
            <div class="thead"><span class="ticon">${THEMES[t].icon}</span><b>${worst(t)}</b><span class="muted">${list.length}× · gem. −${(total / list.length).toFixed(0)}% winkans</span></div>
            <p class="muted">${esc(THEMES[t].advice)}</p>
            ${list
              .slice()
              .sort((a, b) => b.loss - a.loss)
              .slice(0, 3)
              .map((is) => `<div class="ex">tegen ${esc(done[is.gameIdx].game.opponent)}, zet ${Math.ceil(is.ply / 2)}: <b>${esc(is.san)}</b>${is.bestSan ? ` (beter: <b>${esc(is.bestSan)}</b>)` : ''} <span class="muted">−${is.loss.toFixed(0)}%</span> <button class="link" data-open="${done[is.gameIdx].id}">bekijk</button></div>`)
              .join('')}
            <button data-tag="${esc(worst(t))}">Oefen deze fouten (${list.length})</button>
          </div>`)
            .join('')}</section>`
        : ''
    }
    <section class="card"><h3>Waar gingen de fouten mis?</h3>
      ${(['opening', 'middle', 'end'] as Phase[]).map((p) => `<div class="bar"><span>${pname[p]}</span><div><i style="width:${(phases[p] / maxPh) * 100}%"></i></div><b>${phases[p]}</b></div>`).join('')}
    </section>
    ${
      leaks.length
        ? `<section class="card"><h3>Openingslekken</h3>${leaks
            .map((l, i) => `<div class="ex"><b>${esc(l.openingName)}</b>: je speelde <b>${esc(l.mySan)}</b>, theorie is <b>${esc(l.bookSan)}</b>. <button data-leak="${i}">Oefen deze lijn</button></div>`)
            .join('')}</section>`
        : ''
    }
    <section class="card"><h3>Partijen</h3><div class="gamelist">${done
      .map((d, i) => {
        const a = d.game.color === 'w' ? d.an.acc.w : d.an.acc.b;
        return `<button class="g ${d.game.result}" data-open="${d.id}"><b>${d.game.result === 'win' ? 'Winst' : d.game.result === 'loss' ? 'Verlies' : 'Remise'}</b> tegen ${esc(d.game.opponent)} · ${d.game.speed} · ${a.toFixed(0)}% · ${issues.filter((x) => x.gameIdx === i).length} fouten</button>`;
      })
      .join('')}</div></section>`;

    report.querySelectorAll<HTMLElement>('[data-tag]').forEach((b) => {
      b.onclick = () => {
        save('theoryStart', { tab: 'puz', tag: b.dataset.tag });
        go('theory');
      };
    });
    report.querySelectorAll<HTMLElement>('[data-open]').forEach((b) => {
      b.onclick = () => {
        save('openGame', b.dataset.open);
        go('analyse');
      };
    });
    report.querySelectorAll<HTMLElement>('[data-leak]').forEach((b) => {
      b.onclick = () => {
        const l = leaks[+b.dataset.leak!];
        const rep = repertoire();
        const id = `${l.side}:${l.line.join(' ')}`;
        if (!rep.some((r) => r.id === id)) rep.push({ id, eco: '—', name: `${l.openingName} (dagtraining)`, san: l.line, side: l.side });
        saveRepertoire(rep);
        save('openingsStart', id);
        go('openings');
      };
    });
    $(report, '#endBtn')?.addEventListener('click', () => {
      save('theoryStart', { tab: 'end' });
      go('theory');
    });
    report.scrollIntoView({ behavior: 'smooth' });
  }

  return () => {
    disposed = true;
    stop = true;
    batchEngine().stop();
  };
}

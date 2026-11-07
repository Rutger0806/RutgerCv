import { Chess } from 'chess.js';
import { Board, type UserMove } from '../board';
import { bookMoves, loadBook, type Book, type Opening } from '../book';
import { COURSES, LEVEL, buildTree, type Course, type TNode } from '../courses';
import { repertoire, saveRepertoire, type RepLine } from '../store';
import { liveEngine, sameStrength } from '../engine';
import { miniBoard } from '../mini';
import { $, esc, fenKey, load, save, uciToSan } from '../util';

type Mode = 'learn' | 'explore' | 'rep';
type Stage = 'intro' | 'study' | 'practice';

interface TreeMove {
  san: string;
  weight: number;
}

/* ---------- hulpjes ---------- */
function buildRepTree(lines: { san: string[] }[]): Map<string, Map<string, TreeMove>> {
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

const thumbCache = new Map<string, string>();
function thumbFen(c: Course): string {
  let f = thumbCache.get(c.id);
  if (!f) {
    const g = new Chess();
    c.line.slice(0, c.thumb).forEach((m) => g.move(typeof m === 'string' ? m : m[0]));
    f = g.fen();
    thumbCache.set(c.id, f);
  }
  return f;
}

const icon = (n: string) => `<i class="ph ph-${n}"></i>`;
const stats = () => load<Record<string, { runs: number; clean: number }>>('courseStats', {});

export function mount(root: HTMLElement): () => void {
  root.innerHTML = `
  <div class="page-head">
    <div>
      <h1>Openingen</h1>
      <p class="lead">Leer een opening stap voor stap, snap waarom elke zet gespeeld wordt en oefen daarna tot je hem kent.</p>
    </div>
    <div class="seg" id="modeTabs">
      <button data-m="learn" class="on">${icon('graduation-cap')} Cursussen</button>
      <button data-m="explore">${icon('compass')} Verkennen</button>
      <button data-m="rep">${icon('books')} Repertoire</button>
    </div>
  </div>
  <div id="screen"></div>`;

  const screen = $(root, '#screen');
  let board: Board | null = null;
  let panel: HTMLElement;
  let nameEl: HTMLElement;
  let trailEl: HTMLElement;

  let book: Book | null = null;
  let disposed = false;
  let mode: Mode = 'learn';
  let timer: number | undefined;

  const chess = new Chess();
  let hist: string[] = [];
  let orient: 'white' | 'black' = 'white';

  // cursus
  let cSide: 'white' | 'black' = 'black';
  let cVs = 'all';
  let course: Course | null = null;
  let ctree: TNode | null = null;
  let stage: Stage = 'intro';
  let path: TNode[] = [];
  let studyMistakes = 0;
  let studyHint: { from: string; to: string } | null = null;
  let showNotes = true;
  let deviate = load<boolean>('deviate', true);
  let pDeviated = false;
  let pFree: { left: number; fails: number; busy: boolean; best: string | null } | null = null;
  let practiceActive = false;
  let pMistakes = 0;
  let pTotal = 0;
  let pIntro = '';
  let pMine = '';
  let pOpp = '';
  let pErr = '';
  let pHint: { from: string; to: string } | null = null;

  // repertoire-oefenen (oude systeem)
  let rtree = new Map<string, Map<string, TreeMove>>();
  let rside: 'white' | 'black' = 'white';
  let rActive = false;
  let rMistakes = 0;
  let rTotal = 0;
  let rSource = 'all-white';
  let rMsg = '';
  let rHint: { from: string; to: string } | null = null;

  const startSrc = load<string | null>('openingsStart', null);
  if (startSrc) {
    save('openingsStart', null);
    mode = 'rep';
    rSource = startSrc;
  }

  void loadBook().then((b) => {
    book = b;
    if (disposed) return;
    syncTabs();
    renderMode();
  });

  /* ---------- gedeelde bordlogica ---------- */
  function replay(moves: string[]) {
    chess.reset();
    for (const s of moves) {
      try {
        chess.move(s);
      } catch {
        break;
      }
    }
    hist = chess.history();
  }

  function ensureStage() {
    if (board) return;
    screen.innerHTML = `
    <div class="layout">
      <div class="left">
        <div class="boardrow"><div class="board"></div></div>
        <div class="controls" id="ctl">
          <button data-a="undo" title="Een zet terug">${icon('caret-left')}</button>
          <button data-a="reset" title="Opnieuw beginnen">${icon('arrow-counter-clockwise')}</button>
          <button data-a="flip" title="Draai het bord">${icon('arrows-down-up')}</button>
        </div>
        <div class="comment" id="opname"></div>
        <div class="trail muted" id="trail"></div>
      </div>
      <div class="right"><section class="card" id="panel"></section></div>
    </div>`;
    board = new Board($(screen, '.board'), (m) => onUserMove(m));
    panel = $(screen, '#panel');
    nameEl = $(screen, '#opname');
    trailEl = $(screen, '#trail');
    $(screen, '#ctl').addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('button')?.dataset.a;
      if (a === 'flip') {
        orient = orient === 'white' ? 'black' : 'white';
        board?.flip();
      } else if (a === 'undo') undo();
      else if (a === 'reset') restart();
    });
  }

  function leaveStage() {
    window.clearTimeout(timer);
    board?.destroy();
    board = null;
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

  function movableNow(): 'white' | 'black' | 'both' | null {
    if (mode === 'explore') return 'both';
    if (mode === 'learn' && course) {
      if (stage === 'study') return chess.turn() === course.side[0] ? course.side : null;
      if (stage === 'practice') return practiceActive && chess.turn() === course.side[0] ? course.side : null;
      return null;
    }
    if (mode === 'rep') return rActive && chess.turn() === rside[0] ? rside : null;
    return null;
  }

  function refresh() {
    if (!board) return;
    const h = chess.history({ verbose: true });
    const last = h[h.length - 1];
    const hint = mode === 'learn' ? (stage === 'practice' ? pHint : studyHint) : rHint;
    board.show(chess.fen(), {
      orientation: orient,
      lastMove: last ? [last.from, last.to] : null,
      movable: movableNow(),
      arrows: hint ? [hint] : [],
    });
    const op = openingName();
    nameEl.innerHTML = op
      ? `<b>${esc(op.name)}</b> <span class="muted">${op.eco}</span>`
      : hist.length
        ? '<span class="muted">Buiten de bekende theorie</span>'
        : '<span class="muted">Beginstelling</span>';
    trailEl.textContent = h.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m.san}` : m.san)).join(' ');
  }

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
      renderExplore();
    } else if (mode === 'learn') {
      if (stage === 'study') studyMove(m);
      else if (stage === 'practice') practiceMove(m);
    } else if (mode === 'rep') repMove(m);
  }

  function undo() {
    if (mode === 'explore') {
      replay(hist.slice(0, -1));
      refresh();
      renderExplore();
    } else if (mode === 'learn' && course && stage === 'study') {
      back();
    }
  }

  function restart() {
    if (mode === 'explore') {
      replay([]);
      refresh();
      renderExplore();
    } else if (mode === 'learn' && course) {
      if (stage === 'study') {
        path = [];
        studyHint = null;
        studyMistakes = 0;
        replay([]);
        refresh();
        renderStudy();
      } else if (stage === 'practice') startPractice();
    } else if (mode === 'rep') startRepPractice();
  }

  /* ---------- tabbladen ---------- */
  function syncTabs() {
    $(root, '#modeTabs')
      .querySelectorAll('button')
      .forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.m === mode));
  }

  $(root, '#modeTabs').addEventListener('click', (e) => {
    const m = (e.target as HTMLElement).closest('button')?.dataset.m as Mode | undefined;
    if (!m || m === mode) return;
    window.clearTimeout(timer);
    practiceActive = false;
    rActive = false;
    mode = m;
    syncTabs();
    renderMode();
  });

  function renderMode() {
    if (disposed) return;
    window.clearTimeout(timer);
    if (mode === 'learn') {
      if (course) openCourse(course, stage === 'practice' ? 'practice' : stage);
      else {
        leaveStage();
        renderCatalog();
      }
    } else {
      if (!book) {
        screen.innerHTML = '<p class="muted">Openingsboek laden...</p>';
        return;
      }
      ensureStage();
      if (mode === 'explore') {
        orient = 'white';
        replay(hist);
        refresh();
        renderExplore();
      } else {
        orient = 'white';
        replay([]);
        refresh();
        renderRep();
      }
    }
  }

  /* =====================================================
     CURSUSSEN
     ===================================================== */
  function renderCatalog() {
    const st = stats();
    const list = COURSES.filter((c) => c.side === cSide && (cVs === 'all' || c.vs === cVs || (cVs === 'other' && (c.vs === '1.c4' || c.vs === '1.Nf3'))));
    const chipsBlack = [
      ['all', 'Alles'],
      ['1.e4', '1.e4'],
      ['1.d4', '1.d4'],
      ['other', '1.c4 / 1.Nf3'],
    ];
    const chipsWhite = [
      ['all', 'Alles'],
      ['1.e4', 'Ik open met 1.e4'],
      ['1.d4', 'Ik open met 1.d4'],
    ];
    const chips = cSide === 'black' ? chipsBlack : chipsWhite;
    screen.innerHTML = `
    <div class="chooser">
      <div class="choose-row">
        <span class="choose-label">Ik speel met</span>
        <div class="seg" id="sideSeg">
          <button data-s="white" class="${cSide === 'white' ? 'on' : ''}"><span class="dot w"></span> Wit</button>
          <button data-s="black" class="${cSide === 'black' ? 'on' : ''}"><span class="dot b"></span> Zwart</button>
        </div>
      </div>
      <div class="choose-row">
        <span class="choose-label">${cSide === 'black' ? 'Wit opent met' : 'Mijn eerste zet'}</span>
        <div class="chips" id="vsChips">${chips.map(([v, l]) => `<button class="chip-btn ${cVs === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
      </div>
    </div>
    <div class="cards">
      ${list
        .map((c, i) => {
          const s = st[c.id];
          return `<button class="course-card" style="--i:${i}" data-c="${c.id}">
            <div class="thumb">${miniBoard(thumbFen(c), c.side === 'black')}</div>
            <div class="cc-body">
              <div class="cc-top"><span class="tag">${c.vs}</span><span class="level l${c.level}">${LEVEL[c.level]}</span></div>
              <h3>${esc(c.name)}</h3>
              <p>${esc(c.tagline)}</p>
              <div class="cc-foot">${s?.runs ? `${icon('check-circle')} ${s.clean} foutloos van ${s.runs}` : `<span class="muted">Nog niet geoefend</span>`}</div>
            </div>
          </button>`;
        })
        .join('')}
    </div>
    ${list.length ? '' : '<p class="muted">Nog geen cursussen voor deze keuze.</p>'}`;
    $(screen, '#sideSeg').addEventListener('click', (e) => {
      const s = (e.target as HTMLElement).closest('button')?.dataset.s as 'white' | 'black' | undefined;
      if (!s) return;
      cSide = s;
      cVs = 'all';
      renderCatalog();
    });
    $(screen, '#vsChips').addEventListener('click', (e) => {
      const v = (e.target as HTMLElement).closest('button')?.dataset.v;
      if (!v) return;
      cVs = v;
      renderCatalog();
    });
    screen.querySelectorAll<HTMLElement>('[data-c]').forEach((b) => {
      b.onclick = () => openCourse(COURSES.find((c) => c.id === b.dataset.c)!, 'intro');
    });
  }

  function openCourse(c: Course, st: Stage) {
    course = c;
    ctree = buildTree(c);
    stage = st;
    path = [];
    studyMistakes = 0;
    studyHint = null;
    practiceActive = false;
    ensureStage();
    orient = c.side;
    replay([]);
    refresh();
    if (st === 'intro') renderIntro();
    else if (st === 'study') renderStudy();
    else startPractice();
  }

  const kidsNow = (): TNode[] => (path.length ? path[path.length - 1] : ctree!).kids;
  const nodeNow = (): TNode => (path.length ? path[path.length - 1] : ctree!);

  function exitCourse() {
    course = null;
    ctree = null;
    path = [];
    practiceActive = false;
    window.clearTimeout(timer);
    leaveStage();
    renderCatalog();
  }

  function courseHead(sub: string): string {
    const c = course!;
    return `<div class="phead">
      <button class="link-btn" id="allBack">${icon('caret-left')} Alle openingen</button>
      <div class="seg small" id="stageSeg">
        <button data-st="study" class="${stage !== 'practice' ? 'on' : ''}">${icon('book-open')} Uitleg</button>
        <button data-st="practice" class="${stage === 'practice' ? 'on' : ''}">${icon('target')} Oefenen</button>
      </div>
    </div>
    <h2 class="ctitle">${esc(c.name)}</h2>
    <p class="muted">${sub}</p>`;
  }

  function wireHead() {
    $(panel, '#allBack').onclick = exitCourse;
    $(panel, '#stageSeg').addEventListener('click', (e) => {
      const s = (e.target as HTMLElement).closest('button')?.dataset.st as Stage | undefined;
      if (!s || !course) return;
      window.clearTimeout(timer);
      practiceActive = false;
      stage = s;
      if (s === 'study') {
        path = [];
        studyHint = null;
        replay([]);
        refresh();
        renderStudy();
      } else startPractice();
    });
  }

  /* ---------- intro ---------- */
  function renderIntro() {
    const c = course!;
    stage = 'intro';
    panel.innerHTML = `
      <div class="phead"><button class="link-btn" id="allBack">${icon('caret-left')} Alle openingen</button></div>
      <div class="tags"><span class="tag">${c.vs}</span><span class="tag">ECO ${c.eco}</span><span class="level l${c.level}">${LEVEL[c.level]}</span>
        <span class="tag">${c.side === 'white' ? 'Jij speelt wit' : 'Jij speelt zwart'}</span></div>
      <h2 class="ctitle">${esc(c.name)}</h2>
      <p class="lead2">${esc(c.tagline)}</p>
      <h4>Het idee</h4>
      <ul class="bul">${c.ideas.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <h4>Let op</h4>
      <ul class="bul warn">${c.pitfalls.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <h4>Varianten die je leert</h4>
      <ul class="bul">${c.branches.filter((b) => b.steps.length).map((b) => `<li>${esc(b.title)}</li>`).join('')}</ul>
      <div class="actions">
        <button class="primary" id="learn">${icon('book-open')} Begin met leren</button>
        <button id="skip">Ik snap het, direct oefenen</button>
      </div>`;
    $(panel, '#allBack').onclick = exitCourse;
    $(panel, '#learn').onclick = () => {
      stage = 'study';
      refresh();
      renderStudy();
    };
    $(panel, '#skip').onclick = () => startPractice();
  }

  /* ---------- uitleg (study) ---------- */
  function noteBlock(n: TNode | null): string {
    if (!n) {
      return `<div class="explain"><div class="who muted">Beginstelling</div><p>Je gaat de ${esc(course!.name)} leren. ${course!.side === 'white' ? 'Jij begint.' : 'Wit begint, jij antwoordt.'} Klik op de volgende zet of speel zelf de juiste zet op het bord.</p></div>`;
    }
    const num = Math.ceil(n.ply / 2);
    const white = n.ply % 2 === 1;
    const mine = (course!.side === 'white') === white;
    const label = `${num}${white ? '.' : '...'} ${n.san}`;
    return `<div class="explain ${mine ? 'mine' : 'theirs'}">
      <div class="who">${mine ? 'Jouw zet' : 'Tegenstander'}<span class="mvtag">${esc(label)}</span></div>
      <p>${esc(n.note ?? 'Een gangbare theoriezet.')}</p>
    </div>`;
  }

  function branchPath(bi: number): TNode[] | null {
    const c = course!;
    const b = c.branches[bi];
    if (!b.steps.length) return null;
    const out: TNode[] = [];
    let p = ctree!;
    for (let i = 0; i < b.from; i++) {
      p = p.kids.find((k) => k.main)!;
      out.push(p);
    }
    const first = typeof b.steps[0] === 'string' ? b.steps[0] : b.steps[0][0];
    const n = p.kids.find((k) => k.san === first);
    if (!n) return null;
    out.push(n);
    return out;
  }

  function renderStudy() {
    const c = course!;
    stage = 'study';
    const last = path.length ? path[path.length - 1] : null;
    const kids = kidsNow();
    const myTurn = chess.turn() === c.side[0];
    const num = (n: TNode) => `${Math.ceil(n.ply / 2)}${n.ply % 2 === 1 ? '.' : '...'}${n.san}`;

    let next = '';
    if (!kids.length) {
      next = `<div class="end"><b>Einde van deze lijn.</b> Bekijk hieronder een variant, of probeer het nu zelf.</div>`;
    } else if (!myTurn) {
      const ordered = [...kids].sort((a, b) => Number(b.main) - Number(a.main));
      next = `<h4>Wat speelt je tegenstander?</h4>
        <div class="opts">${ordered
          .map((k) => `<button class="opt ${k.main ? 'main' : ''}" data-k="${kids.indexOf(k)}"><b>${esc(num(k))}</b><span>${k.main ? 'Meest gespeeld' : esc(k.label ?? 'Variant')}</span></button>`)
          .join('')}</div>`;
    } else {
      next = `<h4>Jouw zet</h4>
        <p class="muted">Speel de juiste zet op het bord, of laat hem zien.</p>
        <div class="actions"><button class="primary" id="show">${icon('lightbulb')} Toon de zet</button></div>
        ${studyMistakes ? `<p class="err small">Dat is niet de theoriezet${studyMistakes > 1 ? ', de pijl laat de zet zien' : ''}.</p>` : ''}`;
    }

    const variants = c.branches
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.steps.length)
      .map(({ b, i }) => `<button class="vitem" data-b="${i}">${icon('path')} <span>${esc(b.title)}</span></button>`)
      .join('');

    panel.innerHTML = `${courseHead(path.length ? `Zet ${path.length}` : 'Begin van de lijn')}
      ${noteBlock(last)}
      ${next}
      <div class="nav2">
        <button id="b" ${path.length ? '' : 'disabled'}>${icon('caret-left')} Terug</button>
        ${kids.length && !myTurn ? `<button id="f">Hoofdzet ${icon('caret-right')}</button>` : ''}
        <button class="grow" id="prac">${icon('target')} Ik snap het, oefenen</button>
      </div>
      ${variants ? `<h4>Varianten</h4><div class="vlist">${variants}</div>` : ''}`;
    wireHead();
    $(panel, '#b').onclick = back;
    $(panel, '#prac').onclick = () => startPractice();
    panel.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => (b.onclick = () => playNode(kids[+b.dataset.k!])));
    const f = panel.querySelector<HTMLElement>('#f');
    if (f) f.onclick = () => playNode(kids.find((k) => k.main) ?? kids[0]);
    const show = panel.querySelector<HTMLElement>('#show');
    if (show) show.onclick = () => playNode(kids.find((k) => k.main) ?? kids[0]);
    panel.querySelectorAll<HTMLElement>('[data-b]').forEach((b) => {
      b.onclick = () => {
        const p = branchPath(+b.dataset.b!);
        if (!p) return;
        path = p;
        studyHint = null;
        studyMistakes = 0;
        replay(path.map((n) => n.san));
        refresh();
        renderStudy();
      };
    });
  }

  function playNode(n: TNode) {
    try {
      chess.move(n.san);
    } catch {
      return;
    }
    path.push(n);
    hist = chess.history();
    studyMistakes = 0;
    studyHint = null;
    refresh();
    renderStudy();
  }

  function back() {
    if (!path.length) return;
    path.pop();
    studyHint = null;
    studyMistakes = 0;
    replay(path.map((n) => n.san));
    refresh();
    renderStudy();
  }

  function studyMove(m: UserMove) {
    const kids = kidsNow();
    const test = new Chess(chess.fen());
    let san: string;
    try {
      san = test.move(m).san;
    } catch {
      refresh();
      return;
    }
    const k = kids.find((x) => x.san === san);
    if (k) return playNode(k);
    studyMistakes++;
    board?.shake();
    const main = kids.find((x) => x.main) ?? kids[0];
    if (studyMistakes >= 2 && main) {
      const g = new Chess(chess.fen());
      const mv = g.move(main.san);
      studyHint = { from: mv.from, to: mv.to };
    }
    refresh();
    renderStudy();
  }

  /* ---------- oefenen (cursus) ---------- */
  function startPractice() {
    window.clearTimeout(timer);
    const c = course!;
    stage = 'practice';
    path = [];
    pMistakes = 0;
    pTotal = 0;
    pHint = null;
    pDeviated = false;
    pFree = null;
    pIntro = `Jij speelt ${c.side === 'white' ? 'wit' : 'zwart'}. ${c.side === 'white' ? 'Begin met de juiste zet.' : 'Wit begint, wacht op zijn zet.'}`;
    pMine = '';
    pOpp = '';
    pErr = '';
    practiceActive = true;
    orient = c.side;
    replay([]);
    refresh();
    renderPractice();
    stepPractice();
  }

  function renderPractice(done = false) {
    const c = course!;
    const st = stats()[c.id];
    panel.innerHTML = `${courseHead('Oefenmodus: speel de juiste zetten uit je hoofd.')}
      <label class="switch"><input type="checkbox" id="notes" ${showNotes ? 'checked' : ''}/><span>Uitleg tonen na elke zet</span></label>
      <label class="switch"><input type="checkbox" id="dev" ${deviate ? 'checked' : ''}/><span>Tegenstander mag afwijken van de theorie</span></label>
      <div class="feedback" id="fb">${pErr || pMine || pOpp ? `${pErr}${pErr ? '' : pMine}${pErr ? '' : pOpp}` : pIntro}</div>
      ${
        done
          ? `<div class="actions"><button class="primary" id="again">${icon('arrow-counter-clockwise')} Nog een keer</button>
              <button id="study2">${icon('book-open')} Terug naar uitleg</button></div>`
          : `<div class="actions"><button id="hint" ${practiceActive ? '' : 'disabled'}>${icon('lightbulb')} Hint</button>
              <button id="giveup" ${practiceActive ? '' : 'disabled'}>Toon de zet</button></div>`
      }
      <p class="muted small">${st?.runs ? `Tot nu toe: ${st.runs} rondes, ${st.clean} foutloos.` : 'Elke ronde kiest je tegenstander een andere variant.'}</p>`;
    wireHead();
    $<HTMLInputElement>(panel, '#notes').onchange = (e) => (showNotes = (e.target as HTMLInputElement).checked);
    $<HTMLInputElement>(panel, '#dev').onchange = (e) => {
      deviate = (e.target as HTMLInputElement).checked;
      save('deviate', deviate);
    };
    panel.querySelector<HTMLElement>('#again')?.addEventListener('click', startPractice);
    panel.querySelector<HTMLElement>('#study2')?.addEventListener('click', () => {
      stage = 'study';
      path = [];
      replay([]);
      refresh();
      renderStudy();
    });
    panel.querySelector<HTMLElement>('#hint')?.addEventListener('click', () => showPracticeHint());
    panel.querySelector<HTMLElement>('#giveup')?.addEventListener('click', () => {
      pTotal++;
      showPracticeHint();
    });
  }

  function showPracticeHint() {
    if (pFree) {
      if (pFree.best) pHint = { from: pFree.best.slice(0, 2), to: pFree.best.slice(2, 4) };
      refresh();
      return;
    }
    const kids = kidsNow();
    const main = kids.find((k) => k.main) ?? kids[0];
    if (!main) return;
    const g = new Chess(chess.fen());
    const mv = g.move(main.san);
    pHint = { from: mv.from, to: mv.to };
    refresh();
  }

  function stepPractice() {
    if (!practiceActive || !course || pFree) return;
    const kids = kidsNow();
    if (!kids.length) return finishPractice();
    if (chess.turn() === course.side[0]) {
      refresh();
      return;
    }
    // soms speelt de tegenstander geen theorie
    if (deviate && !pDeviated && chess.history().length <= 8 && Math.random() < 0.3) {
      void tryDeviate(kids);
      return;
    }
    playBookReply(kids);
  }

  function playBookReply(kids: TNode[]) {
    // tegenstander: hoofdlijn weegt zwaarder
    const weights = kids.map((k) => (k.main ? 3 : 1));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    let pick = kids[0];
    for (let i = 0; i < kids.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        pick = kids[i];
        break;
      }
    }
    timer = window.setTimeout(() => {
      if (disposed || !practiceActive) return;
      chess.move(pick.san);
      path.push(pick);
      hist = chess.history();
      pHint = null;
      const num = `${Math.ceil(pick.ply / 2)}${pick.ply % 2 === 1 ? '.' : '...'}${pick.san}`;
      pOpp = `<div class="explain theirs"><div class="who">Tegenstander<span class="mvtag">${esc(num)}</span></div>
        ${pick.label ? `<p class="tagline">${esc(pick.label)}</p>` : ''}
        ${showNotes && pick.note ? `<p>${esc(pick.note)}</p>` : ''}
        <p class="muted small">Jij bent aan zet.</p></div>`;
      refresh();
      renderPractice();
      stepPractice();
    }, 650);
  }

  /** Een speelbare zet buiten de theorie kiezen met de engine. */
  async function tryDeviate(kids: TNode[]) {
    const fen = chess.fen();
    const white = chess.turn() === 'w';
    const lines = await liveEngine().analyse(fen, { depth: 10, multipv: 8 });
    if (disposed || !practiceActive || fen !== chess.fen()) return;
    const bookSans = new Set(kids.map((k) => k.san));
    const top = lines[0];
    const cands = lines.filter((l) => {
      if (!top || l.mate != null || top.mate != null) return false;
      const san = uciToSan(fen, l.pv[0]);
      const diff = ((top.cp ?? 0) - (l.cp ?? 0)) * (white ? 1 : -1);
      return !!san && !bookSans.has(san) && diff <= 70;
    });
    if (!cands.length) return playBookReply(kids);
    const pick = cands[Math.floor(Math.random() * cands.length)].pv[0];
    const mainKid = kids.find((k) => k.main) ?? kids[0];
    const san = uciToSan(fen, pick)!;
    timer = window.setTimeout(() => {
      if (disposed || !practiceActive) return;
      chess.move({ from: pick.slice(0, 2), to: pick.slice(2, 4), promotion: pick[4] });
      hist = chess.history();
      pHint = null;
      pDeviated = true;
      pFree = { left: 4, fails: 0, busy: false, best: null };
      const num = `${Math.ceil(chess.history().length / 2)}${chess.history().length % 2 === 1 ? '.' : '...'}${san}`;
      pOpp = `<div class="explain theirs"><div class="who">Tegenstander<span class="mvtag">${esc(num)}</span></div>
        <p class="tagline">Buiten de theorie</p>
        <p>Je tegenstander speelt ${esc(san)}${mainKid ? ` in plaats van ${esc(mainKid.san)}` : ''}. Dat is geen theoriezet van deze opening, maar het is wel speelbaar.
        Denk aan de basis: pak het centrum, ontwikkel je stukken en zet je koning veilig.</p></div>`;
      pMine = '';
      pErr = '';
      refresh();
      renderPractice();
      void prepareFree();
    }, 650);
  }

  async function prepareFree() {
    if (!pFree) return;
    const fen = chess.fen();
    const l = (await liveEngine().analyse(fen, { depth: 12, multipv: 1 }))[0];
    if (pFree && fen === chess.fen()) pFree.best = l?.pv[0] ?? null;
  }

  function whyGood(san: string, mv: { piece: string; captured?: string; from: string; flags: string }): string {
    if (mv.flags.includes('k') || mv.flags.includes('q')) return 'Je zet je koning veilig en brengt je toren in het spel.';
    if (mv.piece === 'p' && ['d4', 'e4', 'd5', 'e5'].some((x) => san.startsWith(x))) return 'Je pakt of betwist het centrum met een pion.';
    if ((mv.piece === 'n' || mv.piece === 'b') && (mv.from[1] === '1' || mv.from[1] === '8')) return 'Je ontwikkelt een stuk naar een actief veld.';
    if (mv.captured) return 'Je ruilt of wint materiaal, en je hebt op de gevolgen gelet.';
    return 'Een sterke, logische voortzetting volgens de engine.';
  }

  async function freeMove(m: UserMove) {
    const f = pFree;
    if (!f || f.busy || !practiceActive || chess.turn() !== course!.side[0]) return;
    const fen = chess.fen();
    const test = new Chess(fen);
    let mv;
    try {
      mv = test.move(m);
    } catch {
      refresh();
      return;
    }
    const uci = m.from + m.to + (m.promotion ?? '');
    f.busy = true;
    const ok = f.best ? await sameStrength(fen, f.best, uci, 6) : true;
    f.busy = false;
    if (disposed || !practiceActive || fen !== chess.fen()) return;
    if (!ok) {
      pTotal++;
      f.fails++;
      board?.shake();
      pErr = `<div class="explain bad"><div class="who">Dat is niet de beste reactie</div><p>De engine vindt hier een sterkere zet. Denk aan centrum, ontwikkeling en rokade.${f.fails >= 2 ? ' De pijl laat de zet zien.' : ''}</p></div>`;
      if (f.fails >= 2) showPracticeHint();
      renderPractice();
      refresh();
      return;
    }
    chess.move(m);
    hist = chess.history();
    pHint = null;
    f.fails = 0;
    f.left--;
    pErr = '';
    pOpp = '';
    pMine = `<div class="explain mine"><div class="who"><span class="okmark">${icon('check-circle')}</span> Goede reactie<span class="mvtag">${esc(mv.san)}</span></div><p>${esc(whyGood(mv.san, mv))}</p></div>`;
    refresh();
    renderPractice();
    if (f.left <= 0 || chess.isGameOver()) return finishFree();
    // de engine speelt terug
    f.busy = true;
    const l = (await liveEngine().analyse(chess.fen(), { depth: 10, multipv: 1 }))[0];
    f.busy = false;
    if (disposed || !practiceActive || !l) return finishFree();
    const san = uciToSan(chess.fen(), l.pv[0]);
    chess.move({ from: l.pv[0].slice(0, 2), to: l.pv[0].slice(2, 4), promotion: l.pv[0][4] });
    hist = chess.history();
    pOpp = `<div class="explain theirs"><div class="who">Tegenstander<span class="mvtag">${esc(san ?? l.pv[0])}</span></div><p class="muted small">Jij bent aan zet.</p></div>`;
    refresh();
    renderPractice();
    if (chess.isGameOver()) return finishFree();
    void prepareFree();
  }

  function finishFree() {
    practiceActive = false;
    pHint = null;
    const c = course!;
    const all = stats();
    const s = (all[c.id] ??= { runs: 0, clean: 0 });
    s.runs++;
    if (pTotal === 0) s.clean++;
    save('courseStats', all);
    pFree = null;
    pErr = '';
    pOpp = '';
    pMine = `<div class="explain mine"><div class="who"><span class="okmark">${icon('check-circle')}</span> Afwijking afgehandeld</div>
      <p>Je speelde vier zetten lang goed tegen een zet buiten de theorie. ${pTotal === 0 ? 'Zonder een enkele fout.' : `Je maakte ${pTotal} fout${pTotal === 1 ? '' : 'en'}.`} Houd je aan de principes als de theorie ophoudt.</p></div>`;
    refresh();
    renderPractice(true);
  }

  function practiceMove(m: UserMove) {
    if (pFree) {
      void freeMove(m);
      return;
    }
    if (!practiceActive || !course || chess.turn() !== course.side[0]) return;
    const kids = kidsNow();
    const test = new Chess(chess.fen());
    let san: string;
    try {
      san = test.move(m).san;
    } catch {
      refresh();
      return;
    }
    const k = kids.find((x) => x.san === san);
    if (k) {
      chess.move(k.san);
      path.push(k);
      hist = chess.history();
      pHint = null;
      pMistakes = 0;
      const num = `${Math.ceil(k.ply / 2)}${k.ply % 2 === 1 ? '.' : '...'}${k.san}`;
      pErr = '';
      pOpp = '';
      pMine = `<div class="explain mine"><div class="who"><span class="okmark">${icon('check-circle')}</span> Goed<span class="mvtag">${esc(num)}</span></div>${showNotes && k.note ? `<p>${esc(k.note)}</p>` : ''}</div>`;
      refresh();
      renderPractice();
      stepPractice();
      return;
    }
    pTotal++;
    pMistakes++;
    board?.shake();
    const main = kids.find((x) => x.main) ?? kids[0];
    pErr = `<div class="explain bad"><div class="who">Niet de theoriezet</div><p>Probeer het nog eens${pMistakes === 2 ? '. De pijl laat de zet zien.' : '.'}</p>${
      pMistakes >= 3 && main?.note ? `<p class="muted small">Denk hieraan: ${esc(main.note)}</p>` : ''
    }</div>`;
    if (pMistakes >= 2) showPracticeHint();
    renderPractice();
    refresh();
  }

  function finishPractice() {
    practiceActive = false;
    pHint = null;
    const c = course!;
    const all = stats();
    const s = (all[c.id] ??= { runs: 0, clean: 0 });
    s.runs++;
    if (pTotal === 0) s.clean++;
    save('courseStats', all);
    const op = openingName();
    pErr = '';
    pOpp = '';
    pMine = `<div class="explain mine"><div class="who"><span class="okmark">${icon('check-circle')}</span> Lijn afgerond</div>
      <p>${op ? `<b>${esc(op.name)}</b>. ` : ''}${pTotal === 0 ? 'Zonder een enkele fout. Sterk.' : `Je maakte ${pTotal} fout${pTotal === 1 ? '' : 'en'}. Probeer nog een ronde.`}</p></div>`;
    refresh();
    renderPractice(true);
  }

  /* =====================================================
     VERKENNEN
     ===================================================== */
  let query = '';
  let repMsg = '';

  function renderExplore() {
    const moves = bookMoves(book!, chess.fen());
    const q = query.trim().toLowerCase();
    const results = q ? book!.list.filter((o) => q.split(/\s+/).every((w) => o.name.toLowerCase().includes(w) || o.eco.toLowerCase() === w)).slice(0, 80) : [];
    panel.innerHTML = `
      <h2 class="ctitle">Verken de theorie</h2>
      <p class="muted">Speel zetten op het bord of zoek een opening. Je ziet welke zetten in de boeken staan.</p>
      <input id="q" class="search" placeholder="Zoek een opening, bijvoorbeeld Najdorf of Londen" value="${esc(query)}" />
      ${
        q
          ? `<div class="row small"><span class="muted">${results.length}${results.length === 80 ? '+' : ''} resultaten</span>
             <button id="addAllW">Alles aan wit toevoegen</button><button id="addAllB">Alles aan zwart toevoegen</button></div>
             <div class="gamelist" id="res">${results
               .map(
                 (o, i) => `<div class="opitem"><button data-view="${i}"><b>${esc(o.name)}</b><span>${o.eco}, ${esc(o.san.slice(0, 8).join(' '))}${o.san.length > 8 ? '...' : ''}</span></button>
               <button class="mini-btn" data-w="${i}" title="Voeg toe aan repertoire als wit">+ Wit</button><button class="mini-btn" data-b="${i}" title="Voeg toe aan repertoire als zwart">+ Zwart</button></div>`,
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
      <div class="actions">
        <button id="addW" ${hist.length ? '' : 'disabled'}>Deze lijn aan wit toevoegen</button>
        <button id="addB" ${hist.length ? '' : 'disabled'}>Deze lijn aan zwart toevoegen</button>
      </div>
      <p class="muted small">${esc(repMsg)}</p>`;
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
      addLines([{ eco: op?.eco ?? '', name: op ? `${op.name} (+${hist.length - op.san.length})`.replace(' (+0)', '') : 'Eigen lijn', san: hist }], s);
    };
    $(panel, '#addW').onclick = cur('white');
    $(panel, '#addB').onclick = cur('black');
  }

  /* =====================================================
     REPERTOIRE (eigen lijnen) + oefenen
     ===================================================== */
  function sourceLines(): { san: string[]; side: 'white' | 'black'; name: string }[] {
    const rep = repertoire();
    if (rSource === 'all-white') return rep.filter((l) => l.side === 'white');
    if (rSource === 'all-black') return rep.filter((l) => l.side === 'black');
    const l = rep.find((x) => x.id === rSource);
    return l ? [l] : [];
  }

  function renderRep() {
    const rep = repertoire();
    const group = (s: 'white' | 'black') => {
      const ls = rep.filter((l) => l.side === s);
      return `<h4>${s === 'white' ? 'Met wit' : 'Met zwart'} (${ls.length})</h4>${
        ls.length
          ? ls.map((l) => `<div class="opitem"><button data-show="${esc(l.id)}"><b>${esc(l.name)}</b><span>${esc(l.eco)} ${esc(l.san.join(' '))}</span></button><button class="mini-btn" data-del="${esc(l.id)}" title="Verwijderen">${icon('x-circle')}</button></div>`).join('')
          : '<p class="muted small">Nog leeg.</p>'
      }`;
    };
    const st = load<{ runs: number; clean: number }>('openstats', { runs: 0, clean: 0 });
    panel.innerHTML = `
      <h2 class="ctitle">Mijn repertoire</h2>
      <p class="muted">Eigen lijnen uit Verkennen en je Dagtraining. Oefen ze met een willekeurige tegenstander.</p>
      ${
        rep.length
          ? `<div class="row"><select id="src">
              <option value="all-white" ${rSource === 'all-white' ? 'selected' : ''}>Alles als wit (${rep.filter((l) => l.side === 'white').length})</option>
              <option value="all-black" ${rSource === 'all-black' ? 'selected' : ''}>Alles als zwart (${rep.filter((l) => l.side === 'black').length})</option>
              ${rep.map((l) => `<option value="${esc(l.id)}" ${rSource === l.id ? 'selected' : ''}>${l.side === 'white' ? 'Wit' : 'Zwart'}: ${esc(l.name)}</option>`).join('')}
            </select><button class="primary" id="start">${icon('play')} Start</button></div>
            <div class="feedback" id="pstat">${rMsg}</div>
            <div class="actions"><button id="hint" ${rActive ? '' : 'disabled'}>${icon('lightbulb')} Hint</button><button id="skip" ${rActive ? '' : 'disabled'}>Toon de zet</button></div>
            <p class="muted small">Totaal: ${st.runs} rondes, ${st.clean} foutloos.</p>`
          : '<p>Je repertoire is nog leeg. Zoek bij Verkennen een opening en voeg die toe.</p>'
      }
      ${group('white')}${group('black')}`;
    if (rep.length) {
      $(panel, '#src').onchange = (e) => (rSource = (e.target as HTMLSelectElement).value);
      $(panel, '#start').onclick = () => {
        rSource = ($(panel, '#src') as HTMLSelectElement).value;
        startRepPractice();
      };
      $(panel, '#hint').onclick = showRepHint;
      $(panel, '#skip').onclick = () => {
        rTotal++;
        showRepHint();
      };
    }
    panel.querySelectorAll<HTMLElement>('[data-show]').forEach((b) => {
      b.onclick = () => {
        const l = rep.find((x) => x.id === b.dataset.show) as RepLine;
        rActive = false;
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

  function startRepPractice() {
    window.clearTimeout(timer);
    const lines = sourceLines();
    if (!lines.length) {
      rMsg = '<span class="err">Geen lijnen voor deze keuze.</span>';
      renderRep();
      return;
    }
    rside = rSource === 'all-black' ? 'black' : rSource === 'all-white' ? 'white' : lines[0].side;
    rtree = buildRepTree(lines);
    orient = rside;
    rActive = true;
    rMistakes = 0;
    rTotal = 0;
    rHint = null;
    rMsg = `Jij speelt ${rside === 'white' ? 'wit' : 'zwart'}. Speel de juiste theoriezet.`;
    replay([]);
    refresh();
    renderRep();
    stepRep();
  }

  const rExpected = () => rtree.get(fenKey(chess.fen()));

  function stepRep() {
    if (!rActive) return;
    const exp = rExpected();
    if (!exp || !exp.size) return finishRep();
    if (chess.turn() === rside[0]) {
      refresh();
      return;
    }
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
      if (disposed || !rActive) return;
      const [uci] = pick;
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      hist = chess.history();
      rHint = null;
      refresh();
      stepRep();
    }, 450);
  }

  function repMove(m: UserMove) {
    if (!rActive || chess.turn() !== rside[0]) return;
    const exp = rExpected();
    const uci = m.from + m.to + (m.promotion ?? '');
    if (exp?.has(uci)) {
      chess.move(m);
      hist = chess.history();
      rHint = null;
      rMistakes = 0;
      refresh();
      stepRep();
      return;
    }
    rTotal++;
    rMistakes++;
    board?.shake();
    const bm = book && bookMoves(book, chess.fen()).find((b) => b.uci === uci);
    const extra = bm ? ` (wel theorie: <i>${esc(bm.sample.name)}</i>, maar niet in jouw repertoire)` : '';
    rMsg = `<span class="err">Niet de repertoirezet${extra}. Probeer opnieuw.</span>`;
    if (rMistakes >= 2) showRepHint();
    renderRep();
    refresh();
  }

  function showRepHint() {
    const exp = rExpected();
    if (!exp) return;
    const [uci] = [...exp.entries()].sort((a, b) => b[1].weight - a[1].weight)[0];
    rHint = { from: uci.slice(0, 2), to: uci.slice(2, 4) };
    refresh();
  }

  function finishRep() {
    rActive = false;
    rHint = null;
    const st = load<{ runs: number; clean: number }>('openstats', { runs: 0, clean: 0 });
    st.runs++;
    if (rTotal === 0) st.clean++;
    save('openstats', st);
    const op = openingName();
    rMsg = `<span class="ok">Lijn afgerond${op ? `: <b>${esc(op.name)}</b>` : ''}. ${rTotal === 0 ? 'Foutloos.' : `${rTotal} fout(en).`}</span> Druk op Start voor een volgende lijn.`;
    renderRep();
    refresh();
  }

  /* ---------- start ---------- */
  syncTabs();
  if (mode === 'learn') renderCatalog();

  return () => {
    disposed = true;
    window.clearTimeout(timer);
    board?.destroy();
  };
}

import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/fill';
import './style.css';
import { $ } from './util';

type View = { mount: (root: HTMLElement) => () => void };
const views: Record<string, () => Promise<View>> = {
  analyse: () => import('./views/analyse'),
  day: () => import('./views/day'),
  openings: () => import('./views/openings'),
  theory: () => import('./views/theory'),
  settings: () => import('./views/settings'),
};

const root = $(document, '#view');
let cleanup: (() => void) | null = null;
let seq = 0;

async function go(tab: string) {
  if (!views[tab]) tab = 'analyse';
  const my = ++seq;
  cleanup?.();
  cleanup = null;
  root.innerHTML = '';
  document.querySelectorAll<HTMLElement>('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  const v = await views[tab]();
  if (my !== seq) return;
  cleanup = v.mount(root);
}

$(document, '#nav').addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('button')?.dataset.tab;
  if (t) location.hash = t;
});
window.addEventListener('hashchange', () => void go(location.hash.slice(1)));
void go(location.hash.slice(1) || 'analyse');

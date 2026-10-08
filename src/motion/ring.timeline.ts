import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { RING_CLICK_MODE } from '../config/ring';
import { EASE, MOBILE_QUERY, SCROLL, SMOOTH } from '../config/scroll';
import { sections } from '../data/sections';
import { clamp, query } from './util';

export interface RingController {
  trigger: ScrollTrigger;
  indexOf(sectionId: string): number;
  goTo(index: number): void;
}

/** Scene 3: pinned ring, rotation tied to scroll progress. */
export function buildRing(): RingController {
  const scene = query<HTMLElement>('[data-ring-scene]');
  const ring = query<HTMLElement>('[data-ring]', scene);
  const orbit = query<HTMLElement>('[data-ring-orbit]', scene);
  const title = query<HTMLElement>('[data-ring-title]', scene);
  const blurb = query<HTMLElement>('[data-ring-blurb]', scene);
  const boxes = [...scene.querySelectorAll<HTMLButtonElement>('[data-ring-box]')];

  const n = boxes.length;
  const step = (Math.PI * 2) / n;
  const hold = SCROLL.ringHold;
  const span = 1 - hold * 2;
  const state = { p: 0 };

  let rx = 0;
  let ry = 0;
  let focused = -1;
  let trigger: ScrollTrigger;

  const progressOfIndex = (i: number) => hold + (i / (n - 1)) * span;
  const mapProgress = (p: number) => clamp((p - hold) / span);

  const setFocus = (i: number) => {
    if (i === focused) return;
    focused = i;
    boxes.forEach((box, k) => {
      const front = k === i;
      box.classList.toggle('is-front', front);
      box.setAttribute('aria-label', front ? `Go to ${sections[k].label}` : `Rotate the ring to ${sections[k].label}`);
      if (front) box.setAttribute('aria-current', 'true');
      else box.removeAttribute('aria-current');
    });
    title.textContent = sections[i].label;
    blurb.textContent = sections[i].blurb;
  };

  const render = (p: number) => {
    const rot = mapProgress(p) * (n - 1) * step;
    boxes.forEach((box, i) => {
      const theta = i * step - rot; // 0 is the front of the ring
      const depth = Math.cos(theta); // 1 front, -1 back
      const d01 = (depth + 1) / 2;
      gsap.set(box, {
        x: Math.sin(theta) * rx,
        y: depth * ry,
        scale: 0.55 + 0.5 * d01,
        opacity: 0.55 + 0.45 * d01 ** 1.5,
        zIndex: Math.round(d01 * 100),
      });
    });
    setFocus(Math.round(mapProgress(p) * (n - 1)));
  };

  const layout = () => {
    const w = ring.clientWidth;
    const h = ring.clientHeight;
    const small = window.matchMedia(MOBILE_QUERY).matches;
    rx = small ? w * 0.3 : Math.min(w * 0.34, 480);
    ry = small ? h * 0.13 : Math.min(h * 0.17, 170);
    orbit.style.setProperty('--ow', `${rx * 2}px`);
    orbit.style.setProperty('--oh', `${ry * 2}px`);
    render(state.p);
  };

  const snapPoints = [0, ...boxes.map((_, i) => progressOfIndex(i)), 1];

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: scene,
      start: 'top top',
      end: `+=${SCROLL.ringLen}%`,
      pin: true,
      scrub: SMOOTH.ringScrub,
      anticipatePin: 1,
      snap: { snapTo: snapPoints, inertia: false, delay: 0.12, duration: { min: 0.2, max: 0.7 }, ease: 'power2.inOut' },
      onRefresh: layout,
    },
  });
  tl.to(state, { p: 1, duration: 1, onUpdate: () => render(state.p) }, 0);
  trigger = tl.scrollTrigger!;

  const goTo = (index: number) => {
    const i = clamp(index, 0, n - 1);
    const y = trigger.start + progressOfIndex(i) * (trigger.end - trigger.start);
    gsap.to(window, { scrollTo: { y, autoKill: true }, duration: 0.9, ease: EASE.jump, overwrite: true });
  };

  const goToSection = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    gsap.to(window, {
      scrollTo: { y: target, autoKill: true },
      duration: 1.4,
      ease: EASE.jump,
      overwrite: true,
      onComplete: () => {
        const heading = target.querySelector<HTMLElement>('h2');
        heading?.setAttribute('tabindex', '-1');
        heading?.focus({ preventScroll: true });
      },
    });
  };

  // pointer drag (touch swipe or mouse) maps to scroll, which turns the ring
  let startX = 0;
  let dragging = false;
  let moved = false;
  const onDown = (e: PointerEvent) => {
    startX = e.clientX;
    dragging = true;
    moved = false;
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 8) moved = true;
    if (moved) {
      window.scrollBy(0, -dx * 1.6);
      startX = e.clientX;
    }
  };
  const onUp = () => {
    dragging = false;
  };
  ring.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  boxes.forEach((box, i) => {
    box.addEventListener('click', () => {
      if (moved) {
        moved = false;
        return;
      }
      if (RING_CLICK_MODE === 'one-click' || i === focused) goToSection(box.dataset.target!);
      else goTo(i);
    });
  });

  ring.addEventListener('keydown', (e) => {
    const next = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 0;
    if (next) {
      e.preventDefault();
      goTo(focused + next);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      goTo(e.key === 'Home' ? 0 : n - 1);
    }
  });

  layout();

  return {
    trigger,
    indexOf: (id) => sections.findIndex((s) => s.id === id),
    goTo,
  };
}

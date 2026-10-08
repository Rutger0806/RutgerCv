import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EASE } from '../config/scroll';
import type { RingController } from './ring.timeline';

/** Scene 4 and 5: scroll-triggered reveals, timeline lines, and the way back to the ring. */
export function buildSections(ring: RingController) {
  document.querySelectorAll<HTMLElement>('[data-tl]').forEach((tl) => {
    const line = tl.querySelector<HTMLElement>('[data-tl-line]');
    if (!line) return;
    gsap.fromTo(
      line,
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: { trigger: tl, start: 'top 70%', end: 'bottom 70%', scrub: true },
      },
    );
  });

  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => {
      els.forEach((el) => el.classList.add('is-in'));
      gsap.to(els, { opacity: 1, y: 0, duration: 1, stagger: 0.12, ease: EASE.reveal, overwrite: true });
    },
  });

  // each section's "back to the ring" control returns to that section's own box
  document.querySelectorAll<HTMLAnchorElement>('[data-back-to-ring]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = link.closest('section')?.id ?? '';
      const index = Math.max(ring.indexOf(id), 0);
      const t = ring.trigger;
      const y = t.start + (0.1 + (index / 4) * 0.8) * (t.end - t.start);
      gsap.to(window, { scrollTo: { y, autoKill: true }, duration: 1.6, ease: EASE.jump, overwrite: true });
    });
  });
}

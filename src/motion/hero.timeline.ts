import gsap from 'gsap';
import { EASE, SCROLL, SMOOTH } from '../config/scroll';
import { query } from './util';

/** Scene 1: the summit image is pinned and zooms out to reveal a range. */
export function buildHero() {
  const hero = query<HTMLElement>('[data-hero]');
  const frame = query<HTMLElement>('[data-hero-frame]', hero);
  const range = query<HTMLElement>('[data-hero-range]', hero);
  const text = query<HTMLElement>('[data-hero-text]', hero);

  gsap.set(range, { opacity: 0, scale: 1.12, transformOrigin: '50% 100%' });

  // intro on load, time based because nothing has been scrolled yet
  gsap.from(text.children, { opacity: 0, y: 24, duration: 1.2, stagger: 0.18, delay: 0.2, ease: EASE.reveal });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: `+=${SCROLL.heroLen}%`,
      pin: true,
      scrub: SMOOTH.scrub,
      anticipatePin: 1,
    },
  });

  tl.to(text, { opacity: 0, y: -48, ease: 'none', duration: 0.22 }, 0)
    .to(frame, { scale: 0.3, ease: 'power2.inOut', duration: 1 }, 0)
    .to(range, { opacity: 1, scale: 1, ease: 'none', duration: 0.65 }, 0.3);

  return tl.scrollTrigger!;
}

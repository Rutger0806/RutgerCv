import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { buildFlight } from './flight.timeline';
import { buildHero } from './hero.timeline';
import { setupProjects } from './projects';
import { buildRing } from './ring.timeline';
import { buildSections } from './sections';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const mm = gsap.matchMedia();

// full scroll story, only when the visitor has not asked for reduced motion
mm.add('(prefers-reduced-motion: no-preference)', () => {
  // order matters: pins are created top to bottom so spacing stacks correctly
  buildHero();
  buildFlight();
  const ring = buildRing();
  buildSections(ring);
  setupProjects(true);

  window.addEventListener('load', () => ScrollTrigger.refresh());
});

// reduced motion: everything is static, only the project dialog stays interactive
mm.add('(prefers-reduced-motion: reduce)', () => {
  setupProjects(false);
});

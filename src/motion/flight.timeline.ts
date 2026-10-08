import gsap from 'gsap';
import { SCROLL, SMOOTH } from '../config/scroll';
import { catmull, clamp, lerp, lerpKeys, query, smoothstep, type Pt } from './util';

/** Waypoints as fractions of the scene, a loop away from the range, then up and out. */
const PATH: Pt[] = [
  [0.08, 0.8],
  [0.22, 0.42],
  [0.42, 0.66],
  [0.64, 0.3],
  [0.8, 0.48],
  [0.6, 0.52],
  [0.5, 0.3],
  [0.5, -0.3],
];
const SIDE_UNTIL = 0.62; // side view frames end here, the back view takes over
const FLAPS = 14; // full wing cycles while the side view is showing
const SCALE_KEYS: Pt[] = [
  [0, 0.7],
  [0.3, 1],
  [0.55, 1.15],
  [0.7, 1],
  [1, 0.3],
];

/** Scene 2: wing frame, position and cloud drift are all driven by scroll progress. */
export function buildFlight() {
  const scene = query<HTMLElement>('[data-flight]');
  const bird = query<HTMLElement>('[data-bird]', scene);
  const frames = [...scene.querySelectorAll<HTMLImageElement>('[data-bird-frame]')];
  const back = query<HTMLImageElement>('[data-bird-back]', scene);
  const range = query<HTMLElement>('[data-flight-range]', scene);
  const clouds = [...scene.querySelectorAll<HTMLElement>('[data-cloud]')];

  let W = scene.clientWidth;
  let H = scene.clientHeight;
  const state = { t: 0 };

  const at = (t: number) => {
    const [x, y] = catmull(PATH, t);
    return [x * W, y * H] as Pt;
  };

  const render = (t: number) => {
    const [x, y] = at(t);
    const [x2, y2] = at(Math.min(t + 0.01, 1));
    const sideAngle = clamp((Math.atan2(y2 - y, x2 - x) * 180) / Math.PI, -35, 35) * 0.6;
    const bank = clamp(((x2 - x) / Math.max(W, 1)) * -900, -14, 14);
    const blend = smoothstep(0.5, SIDE_UNTIL, t);

    const frameIndex = Math.floor((Math.min(t, SIDE_UNTIL) / SIDE_UNTIL) * FLAPS * frames.length) % frames.length;
    frames.forEach((img, i) => {
      img.style.opacity = i === frameIndex ? String(1 - blend) : '0';
    });
    back.style.opacity = String(blend);

    gsap.set(bird, {
      x,
      y,
      xPercent: -50,
      yPercent: -50,
      rotation: lerp(sideAngle, bank, blend),
      scale: lerpKeys(SCALE_KEYS, t),
    });
  };

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: scene,
      start: 'top top',
      end: `+=${SCROLL.flightLen}%`,
      pin: true,
      scrub: SMOOTH.scrub,
      anticipatePin: 1,
      onRefresh: () => {
        W = scene.clientWidth;
        H = scene.clientHeight;
        render(state.t);
      },
    },
  });

  tl.to(state, { t: 1, duration: 1, onUpdate: () => render(state.t) }, 0);

  // clouds drift at three speeds, far to near
  const speed = [0, 0.14, 0.3, 0.55];
  clouds.forEach((cloud) => {
    const depth = Number(cloud.dataset.depth ?? 1);
    tl.to(cloud, { x: () => -window.innerWidth * speed[depth], duration: 1 }, 0);
  });

  // camera climbs, so the ridge drops away
  tl.to(range, { yPercent: 38, duration: 1 }, 0);

  render(0);
  return tl.scrollTrigger!;
}

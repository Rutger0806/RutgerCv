/** Scroll length budget. Pinned lengths are percentages of the viewport height. */
export const SCROLL = {
  heroLen: 250,
  flightLen: 400,
  ringLen: 500,
  /** share of the ring scene held still at the start and at the end */
  ringHold: 0.1,
} as const;

export const SMOOTH = {
  /** seconds of catch-up for scrubbed timelines */
  scrub: 0.6,
  ringScrub: 0.5,
} as const;

export const EASE = {
  jump: 'power2.inOut',
  reveal: 'power3.out',
} as const;

export const MOBILE_QUERY = '(max-width: 640px)';

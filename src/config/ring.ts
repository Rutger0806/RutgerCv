/**
 * 'two-click': clicking a box that is not in front rotates it to the front,
 *              clicking the front box jumps to its section.
 * 'one-click': any click jumps straight to the section.
 */
export type RingClickMode = 'two-click' | 'one-click';
export const RING_CLICK_MODE: RingClickMode = 'two-click';

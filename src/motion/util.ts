export type Pt = [number, number];

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Piecewise linear interpolation through [t, value] keys, sorted by t. */
export function lerpKeys(keys: Pt[], t: number): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      return lerp(v0, v1, (t - t0) / (t1 - t0));
    }
  }
  return keys[keys.length - 1][1];
}

/** Catmull-Rom spline through points, t in 0..1 over the whole path. */
export function catmull(pts: Pt[], t: number): Pt {
  const n = pts.length - 1;
  const f = clamp(t) * n;
  const i = Math.min(Math.floor(f), n - 1);
  const u = f - i;
  const p0 = pts[Math.max(i - 1, 0)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(i + 2, n)];
  const calc = (k: 0 | 1): number =>
    0.5 *
    (2 * p1[k] +
      (-p0[k] + p2[k]) * u +
      (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u +
      (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u);
  return [calc(0), calc(1)];
}

export function query<T extends Element>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}

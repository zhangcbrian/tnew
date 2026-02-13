export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Exponential smoothing factor in [0,1] where `lambda` is the "snappiness".
 * Unlike `t = dt * k`, this remains stable across varying frame times.
 */
export function expDampFactor(lambda: number, dt: number): number {
  if (dt <= 0) return 0;
  return 1 - Math.exp(-lambda * dt);
}

export function damp(a: number, b: number, lambda: number, dt: number): number {
  return lerp(a, b, expDampFactor(lambda, dt));
}

/** Smallest signed difference (b - a) wrapped to [-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function dampAngle(a: number, b: number, lambda: number, dt: number): number {
  const d = angleDiff(a, b);
  return a + d * expDampFactor(lambda, dt);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function inverseLerp(a: number, b: number, v: number): number {
  return (v - a) / (b - a);
}

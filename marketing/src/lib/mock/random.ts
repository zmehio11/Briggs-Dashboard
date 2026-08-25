// Deterministic PRNG (mulberry32) so mock data is stable across page loads
// and server restarts instead of reshuffling every request.
export function createRng(seed: number) {
  let a = seed;
  return function rng(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function between(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function round(n: number, decimals = 0): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

/** Days ago -> YYYY-MM-DD, anchored to "today" at module load. */
export function dateDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export function dayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0 = Sunday
}

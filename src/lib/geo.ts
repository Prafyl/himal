export type LngLat = [number, number];

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function haversineKm(a: LngLat, b: LngLat) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearingDeg(a: LngLat, b: LngLat) {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x =
    Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** A polyline with cumulative chainage, so we can ask "where is the flood front at km X?" */
export class Route {
  readonly pts: LngLat[];
  readonly cum: number[];
  readonly length: number;

  constructor(pts: LngLat[]) {
    this.pts = pts;
    this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + haversineKm(pts[i - 1], pts[i]));
    this.length = this.cum[this.cum.length - 1];
  }

  private index(km: number) {
    let lo = 0;
    let hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= km) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  at(km: number): LngLat {
    const k = Math.max(0, Math.min(this.length, km));
    const i = this.index(k);
    const j = Math.min(i + 1, this.pts.length - 1);
    const seg = this.cum[j] - this.cum[i] || 1;
    const t = (k - this.cum[i]) / seg;
    return [this.pts[i][0] + (this.pts[j][0] - this.pts[i][0]) * t, this.pts[i][1] + (this.pts[j][1] - this.pts[i][1]) * t];
  }

  heading(km: number, ahead = 1.2) {
    return bearingDeg(this.at(km), this.at(km + ahead));
  }

  /** Coordinates from the start up to km (for the flooded stretch). */
  slice(km: number): LngLat[] {
    const k = Math.max(0, Math.min(this.length, km));
    const i = this.index(k);
    return [...this.pts.slice(0, i + 1), this.at(k)];
  }
}

export function centroid(ring: LngLat[]): LngLat {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  return [x / ring.length, y / ring.length];
}

export function scaleRing(ring: LngLat[], s: number): LngLat[] {
  const c = centroid(ring);
  return ring.map((p) => [c[0] + (p[0] - c[0]) * s, c[1] + (p[1] - c[1]) * s]);
}

export function lerpAngle(a: number, b: number, t: number) {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}

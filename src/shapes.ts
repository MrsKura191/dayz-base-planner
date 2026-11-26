import { GRID } from './constants';

export type V2 = [number, number];

const H_TRI = (GRID * Math.sqrt(3)) / 2;

/** Floor outlines in local (x, z), all wound the same way. */
export function shapeVerts(shape: 'square' | 'tri' | 'walkway'): V2[] {
  const h = GRID / 2;
  switch (shape) {
    case 'square':
      return [[-h, -h], [h, -h], [h, h], [-h, h]];
    case 'tri':
      return [[-h, -H_TRI / 3], [h, -H_TRI / 3], [0, (2 * H_TRI) / 3]];
    case 'walkway':
      return [[-h, -h / 2], [h, -h / 2], [h, h / 2], [-h, h / 2]];
  }
}

/** Rotate a local (x, z) vector by yaw, matching three.js rotation.y. */
export function rot(x: number, z: number, yaw: number): V2 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [x * c + z * s, -x * s + z * c];
}

export function worldVerts(shape: 'square' | 'tri' | 'walkway', x: number, z: number, yaw: number): V2[] {
  return shapeVerts(shape).map(([lx, lz]) => {
    const [wx, wz] = rot(lx, lz, yaw);
    return [wx + x, wz + z] as V2;
  });
}

export function centroid(pts: V2[]): V2 {
  let x = 0;
  let z = 0;
  for (const p of pts) {
    x += p[0];
    z += p[1];
  }
  return [x / pts.length, z / pts.length];
}

/** Separating-axis overlap test for convex polygons, shrunk slightly so shared edges don't count. */
export function polysOverlap(a: V2[], b: V2[]): boolean {
  const shrink = (p: V2[]) => {
    const c = centroid(p);
    return p.map(([x, z]) => [c[0] + (x - c[0]) * 0.94, c[1] + (z - c[1]) * 0.94] as V2);
  };
  const A = shrink(a);
  const B = shrink(b);
  for (const poly of [A, B]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const nx = p2[1] - p1[1];
      const nz = p1[0] - p2[0];
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const p of A) {
        const d = p[0] * nx + p[1] * nz;
        minA = Math.min(minA, d);
        maxA = Math.max(maxA, d);
      }
      for (const p of B) {
        const d = p[0] * nx + p[1] * nz;
        minB = Math.min(minB, d);
        maxB = Math.max(maxB, d);
      }
      if (maxA < minB || maxB < minA) return false;
    }
  }
  return true;
}

export function distPointSeg(px: number, pz: number, a: V2, b: V2): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz || 1;
  let t = ((px - a[0]) * dx + (pz - a[1]) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + dx * t - px;
  const cz = a[1] + dz * t - pz;
  return Math.hypot(cx, cz);
}

export const normAngle = (a: number) => {
  let r = a % (Math.PI * 2);
  if (r < 0) r += Math.PI * 2;
  return r;
};

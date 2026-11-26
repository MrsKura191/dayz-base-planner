import { DOOR_LIMIT, levelTop, TERRITORY_RADIUS, WALL_H } from './constants';
import { PARTS, type PartDef } from './data';
import { distPointSeg, polysOverlap, rot, shapeVerts, worldVerts, type V2 } from './shapes';
import type { Piece } from './store';

export interface Placement {
  x: number;
  y: number;
  z: number;
  r: number;
  l: number;
  snapped: boolean;
}

export interface Cursor {
  /** intersection with the horizontal plane of the active storey */
  plane: { x: number; z: number } | null;
  /** first surface under the mouse (for free-standing objects) */
  hit: { x: number; y: number; z: number } | null;
}

export interface PlaceCtx {
  pieces: Piece[];
  level: number;
  /** cycles snap variants (flip, stair direction, palisade angle) */
  rotIndex: number;
  /** yaw used in free placement */
  freeYaw: number;
  snap: boolean;
}

const def = (p: Piece) => PARTS[p.t];
const isFullWall = (p: Piece) => def(p).kind === 'wall' && (def(p).height ?? WALL_H) >= WALL_H - 0.01;
const wallWidth = (d: PartDef) => d.width ?? 3;
const wallHeight = (d: PartDef) => d.height ?? WALL_H;

export function wallSeg(p: { x: number; z: number; r: number }, width: number): [V2, V2] {
  const [dx, dz] = rot(1, 0, p.r);
  const h = width / 2;
  return [
    [p.x - dx * h, p.z - dz * h],
    [p.x + dx * h, p.z + dz * h],
  ];
}

export function floorPoly(p: Piece): V2[] {
  return worldVerts(def(p).shape ?? 'square', p.x, p.z, p.r);
}

const round = (v: number, s: number) => Math.round(v / s) * s;

// ---------------------------------------------------------------- snapping
function snapFloor(d: PartDef, cur: { x: number; z: number }, ctx: PlaceCtx): Placement | null {
  const L = ctx.level;
  const shape = d.shape ?? 'square';
  const nv = shapeVerts(shape);
  const sameLevel = ctx.pieces.filter((p) => p.l === L && def(p).kind === 'floor');
  const below = ctx.pieces.filter((p) => p.l === L - 1);
  const cands: { x: number; z: number; r: number }[] = [];

  const attach = (A: V2, B: V2) => {
    const tl = Math.hypot(B[0] - A[0], B[1] - A[1]);
    for (let i = 0; i < nv.length; i++) {
      const a = nv[i];
      const b = nv[(i + 1) % nv.length];
      if (Math.abs(Math.hypot(b[0] - a[0], b[1] - a[1]) - tl) > 0.02) continue;
      const yaw = Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.atan2(A[1] - B[1], A[0] - B[0]);
      const [ax, az] = rot(a[0], a[1], yaw);
      cands.push({ x: B[0] - ax, z: B[1] - az, r: yaw });
    }
  };

  for (const f of sameLevel) {
    const poly = floorPoly(f);
    for (let i = 0; i < poly.length; i++) attach(poly[i], poly[(i + 1) % poly.length]);
  }
  for (const p of below) {
    const pd = def(p);
    if (pd.kind === 'floor' && (pd.shape ?? 'square') === shape) cands.push({ x: p.x, z: p.z, r: p.r });
    if (isFullWall(p)) {
      const [A, B] = wallSeg(p, wallWidth(pd));
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      // a 6 m wall offers two 3 m edges
      const n = Math.max(1, Math.round(len / 3));
      for (let k = 0; k < n; k++) {
        const s: V2 = [A[0] + ((B[0] - A[0]) * k) / n, A[1] + ((B[1] - A[1]) * k) / n];
        const e: V2 = [A[0] + ((B[0] - A[0]) * (k + 1)) / n, A[1] + ((B[1] - A[1]) * (k + 1)) / n];
        attach(s, e);
        attach(e, s);
      }
    }
  }

  let best: { x: number; z: number; r: number } | null = null;
  let bestD = 3.5;
  for (const c of cands) {
    const cv = worldVerts(shape, c.x, c.z, c.r);
    const cx = cv.reduce((s, v) => s + v[0], 0) / cv.length;
    const cz = cv.reduce((s, v) => s + v[1], 0) / cv.length;
    const dist = Math.hypot(cx - cur.x, cz - cur.z);
    if (dist >= bestD) continue;
    if (sameLevel.some((f) => polysOverlap(cv, floorPoly(f)))) continue;
    best = c;
    bestD = dist;
  }
  if (!best) return null;
  return { ...best, y: levelTop(L), l: L, snapped: true };
}

interface Seg {
  A: V2;
  B: V2;
  y: number;
}

function snapWall(d: PartDef, cur: { x: number; z: number }, ctx: PlaceCtx): Placement | null {
  const L = ctx.level;
  const segs: Seg[] = [];
  const y0 = levelTop(L);
  for (const p of ctx.pieces) {
    const pd = def(p);
    if (p.l === L && pd.kind === 'floor') {
      const poly = floorPoly(p);
      for (let i = 0; i < poly.length; i++) segs.push({ A: poly[i], B: poly[(i + 1) % poly.length], y: y0 });
    } else if (p.l === L - 1 && isFullWall(p)) {
      const [A, B] = wallSeg(p, wallWidth(pd));
      segs.push({ A, B, y: y0 });
    } else if (p.l === L && pd.kind === 'wall' && wallHeight(pd) < WALL_H - 0.01) {
      // half/third walls stack on top of each other
      const top = p.y + wallHeight(pd);
      if (top - y0 + wallHeight(d) <= WALL_H + 0.02) {
        const [A, B] = wallSeg(p, wallWidth(pd));
        segs.push({ A, B, y: top });
      }
    }
  }
  let best: Seg | null = null;
  let bestD = 2;
  for (const s of segs) {
    const dd = distPointSeg(cur.x, cur.z, s.A, s.B);
    if (dd < bestD) {
      bestD = dd;
      best = s;
    }
  }
  if (!best) return null;
  const { A, B } = best;
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const dir: V2 = [(B[0] - A[0]) / len, (B[1] - A[1]) / len];
  const W = wallWidth(d);
  let cx = (A[0] + B[0]) / 2;
  let cz = (A[1] + B[1]) / 2;
  if (W > len + 0.01) {
    const c1: V2 = [A[0] + (dir[0] * W) / 2, A[1] + (dir[1] * W) / 2];
    const c2: V2 = [B[0] - (dir[0] * W) / 2, B[1] - (dir[1] * W) / 2];
    const pick = Math.hypot(c1[0] - cur.x, c1[1] - cur.z) < Math.hypot(c2[0] - cur.x, c2[1] - cur.z) ? c1 : c2;
    [cx, cz] = pick;
  }
  const r = -Math.atan2(dir[1], dir[0]) + (ctx.rotIndex % 2 ? Math.PI : 0);
  return { x: cx, y: best.y, z: cz, r, l: L, snapped: true };
}

function snapBars(cur: { x: number; z: number }, ctx: PlaceCtx): Placement | null {
  let best: Piece | null = null;
  let bestD = 2.5;
  for (const p of ctx.pieces) {
    const op = def(p).opening;
    if (p.l !== ctx.level || def(p).kind !== 'wall' || (op !== 'window' && op !== 'glasswindow')) continue;
    const dd = Math.hypot(p.x - cur.x, p.z - cur.z);
    if (dd < bestD) {
      bestD = dd;
      best = p;
    }
  }
  if (!best) return null;
  const T = def(best).look === 'cinder' ? 0.25 : 0.2;
  const side = ctx.rotIndex % 2 ? -1 : 1;
  const [nx, nz] = rot(0, 1, best.r);
  const off = (T / 2 + 0.04) * side;
  return { x: best.x + nx * off, y: best.y, z: best.z + nz * off, r: best.r, l: best.l, snapped: true };
}

function snapStairs(d: PartDef, cur: { x: number; z: number }, ctx: PlaceCtx): Placement | null {
  const L = ctx.level;
  let best: Piece | null = null;
  let bestD = 2.5;
  for (const p of ctx.pieces) {
    const pd = def(p);
    const ok =
      (p.l === L && pd.kind === 'floor' && (pd.shape ?? 'square') === 'square') ||
      (d.kind === 'spiral' && p.l === L - 1 && pd.kind === 'spiral');
    if (!ok) continue;
    const dd = Math.hypot(p.x - cur.x, p.z - cur.z);
    if (dd < bestD) {
      bestD = dd;
      best = p;
    }
  }
  if (!best) return null;
  return { x: best.x, y: levelTop(L), z: best.z, r: best.r + (ctx.rotIndex % 4) * (Math.PI / 2), l: L, snapped: true };
}

function snapPalisade(d: PartDef, cur: { x: number; z: number }, ctx: PlaceCtx): Placement | null {
  let best: { end: V2; start: boolean; r: number } | null = null;
  let bestD = 3;
  for (const p of ctx.pieces) {
    if (def(p).kind !== 'palisade') continue;
    const [A, B] = wallSeg(p, wallWidth(def(p)));
    for (const [pt, start] of [[A, true], [B, false]] as [V2, boolean][]) {
      const dd = Math.hypot(pt[0] - cur.x, pt[1] - cur.z);
      if (dd < bestD) {
        bestD = dd;
        best = { end: pt, start, r: p.r };
      }
    }
  }
  if (!best) return null;
  const r = best.r + ctx.rotIndex * (Math.PI / 12);
  const [dx, dz] = rot(1, 0, r);
  const W = wallWidth(d);
  const s = best.start ? -1 : 1;
  const x = best.end[0] + (dx * W * s) / 2;
  const z = best.end[1] + (dz * W * s) / 2;
  // skip the spot the source palisade already occupies
  if (ctx.pieces.some((p) => def(p).kind === 'palisade' && Math.hypot(p.x - x, p.z - z) < 0.3)) return null;
  return { x, y: 0, z, r, l: 0, snapped: true };
}

export function computePlacement(d: PartDef, cur: Cursor, ctx: PlaceCtx): Placement | null {
  const plane = cur.plane;
  const ground = cur.hit ?? (plane ? { x: plane.x, y: levelTop(ctx.level), z: plane.z } : null);
  if (ctx.snap) {
    let s: Placement | null = null;
    const p = d.kind === 'palisade' || d.kind === 'plotpole' ? ground : plane;
    if (p) {
      if (d.kind === 'floor') s = snapFloor(d, p, ctx);
      else if (d.kind === 'wall') s = snapWall(d, p, ctx);
      else if (d.kind === 'stairs' || d.kind === 'spiral') s = snapStairs(d, p, ctx);
      else if (d.kind === 'bars') s = snapBars(p, ctx);
      else if (d.kind === 'palisade') s = snapPalisade(d, p, ctx);
    }
    if (s) return s;
    if (d.kind === 'bars') return null;
  }
  // free placement
  if (d.kind === 'object' || d.kind === 'plotpole' || d.kind === 'palisade') {
    if (!ground) return null;
    const step = ctx.snap ? 0.25 : 0.05;
    const onGround = d.kind !== 'object';
    return {
      x: round(ground.x, step),
      y: onGround ? 0 : ground.y,
      z: round(ground.z, step),
      r: ctx.freeYaw,
      l: onGround ? 0 : ctx.level,
      snapped: false,
    };
  }
  if (!plane) return null;
  const step = ctx.snap ? 0.5 : 0.05;
  return { x: round(plane.x, step), y: levelTop(ctx.level), z: round(plane.z, step), r: ctx.freeYaw, l: ctx.level, snapped: false };
}

// -------------------------------------------------------------- validation
export function extentOf(d: PartDef): number {
  switch (d.kind) {
    case 'floor': return 1.75;
    case 'wall':
    case 'palisade': return wallWidth(d) / 2;
    case 'stairs':
    case 'spiral': return 2.1;
    case 'bars': return 0.7;
    default: {
      const [w, , dd] = d.size ?? [1, 1, 1];
      return Math.hypot(w, dd) / 2;
    }
  }
}

export interface Verdict {
  ok: boolean;
  reason?: string;
}

export function validate(d: PartDef, pl: Placement, pieces: Piece[], partLimit: number): Verdict {
  if (pieces.length >= partLimit) return { ok: false, reason: `Teile-Limit erreicht (${partLimit})` };
  const pole = pieces.find((p) => def(p).kind === 'plotpole');
  if (d.kind === 'plotpole') {
    if (pole) return { ok: false, reason: 'Nur eine Plot Pole pro Territorium' };
    const out = pieces.some((p) => Math.hypot(p.x - pl.x, p.z - pl.z) + extentOf(def(p)) > TERRITORY_RADIUS);
    if (out) return { ok: false, reason: 'Bestehende Teile lägen außerhalb des Territoriums' };
  } else if (pole && Math.hypot(pl.x - pole.x, pl.z - pole.z) + extentOf(d) > TERRITORY_RADIUS) {
    return { ok: false, reason: `Außerhalb des Territoriums (${TERRITORY_RADIUS} m)` };
  }
  if (d.countsAsDoor) {
    const doors = pieces.filter((p) => def(p).countsAsDoor);
    if (doors.length >= DOOR_LIMIT) return { ok: false, reason: `Türlimit erreicht (${DOOR_LIMIT})` };
    if (doors.some((p) => p.l === pl.l && Math.hypot(p.x - pl.x, p.z - pl.z) < 1.6))
      return { ok: false, reason: 'Tür zu nah an einer anderen Tür' };
  }
  if (d.kind === 'floor') {
    const poly = worldVerts(d.shape ?? 'square', pl.x, pl.z, pl.r);
    if (pieces.some((p) => p.l === pl.l && def(p).kind === 'floor' && polysOverlap(poly, floorPoly(p))))
      return { ok: false, reason: 'Überlappt einen vorhandenen Boden' };
  }
  if (d.kind === 'wall' || d.kind === 'palisade') {
    const Wn = wallWidth(d);
    for (const p of pieces) {
      const pd = def(p);
      if (pd.kind !== d.kind || p.l !== pl.l || Math.abs(p.y - pl.y) > 0.05) continue;
      if (Math.abs(Math.sin(p.r - pl.r)) > 0.05) continue;
      const [dx, dz] = rot(1, 0, p.r);
      const ox = pl.x - p.x;
      const oz = pl.z - p.z;
      const perp = Math.abs(-ox * dz + oz * dx);
      if (perp > 0.15) continue;
      const along = ox * dx + oz * dz;
      const overlap = Math.min(along + Wn / 2, wallWidth(pd) / 2) - Math.max(along - Wn / 2, -wallWidth(pd) / 2);
      if (overlap > 0.2) return { ok: false, reason: 'Hier steht schon eine Wand' };
    }
  }
  if (d.kind === 'stairs' || d.kind === 'spiral') {
    if (pieces.some((p) => p.l === pl.l && ['stairs', 'spiral'].includes(def(p).kind) && Math.hypot(p.x - pl.x, p.z - pl.z) < 0.5))
      return { ok: false, reason: 'Hier steht schon eine Treppe' };
  }
  if (d.kind === 'bars') {
    if (pieces.some((p) => def(p).kind === 'bars' && Math.hypot(p.x - pl.x, p.z - pl.z) < 0.3 && Math.abs(p.y - pl.y) < 0.1))
      return { ok: false, reason: 'Gitter ist schon montiert' };
  }
  return { ok: true };
}

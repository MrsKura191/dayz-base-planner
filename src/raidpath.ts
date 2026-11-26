// Cheapest way in: Dijkstra over a 0.5 m grid per storey. Walls block,
// doors and palisades cost breaching charges / fuel (the only raidable parts
// on Aftermath), stairs and floor holes connect storeys, open edges let you
// drop down. Assumptions are reported alongside the result.
import { floorTop, LEVEL_H, MAX_LEVEL } from './constants';
import { PARTS } from './data';
import { floorPoly, wallSeg } from './placement';
import { rot, type V2 } from './shapes';
import type { Piece } from './store';

export type Metric = 'charges' | 'fuel';

export interface RaidTarget {
  x: number;
  z: number;
  l: number;
}

export interface RaidStep {
  pieceId: number;
  name: string;
  level: number;
  charges: number;
  fuel: number;
  kind: 'door' | 'palisade' | 'window' | 'low';
}

export interface RaidResult {
  reachable: boolean;
  steps: RaidStep[];
  charges: number;
  fuel: number;
  path: { x: number; y: number; z: number }[];
}

const CELL = 0.5;
const CLIMB_MAX = 1.6;

type BarrierKind = 'wall' | 'door' | 'window' | 'low';
interface Barrier {
  a: V2;
  b: V2;
  kind: BarrierKind;
  piece: Piece;
  charges: number;
  fuel: number;
}

function segCross(p1: V2, p2: V2, q1: V2, q2: V2) {
  const d = (a: V2, b: V2, c: V2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(q1, q2, p1), d2 = d(q1, q2, p2), d3 = d(p1, p2, q1), d4 = d(p1, p2, q2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function inConvex(poly: V2[], x: number, z: number) {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (Math.abs(c) < 1e-9) continue;
    const s = Math.sign(c);
    if (!sign) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function inRect(x: number, z: number, cx: number, cz: number, r: number, w: number, d: number) {
  const [lx, lz] = rot(x - cx, z - cz, -r);
  return Math.abs(lx) <= w / 2 && Math.abs(lz) <= d / 2;
}

class Heap {
  private a: [number, number][] = [];
  push(k: number, v: number) {
    const a = this.a;
    a.push([k, v]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): [number, number] | undefined {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}

export function analyseRaid(pieces: Piece[], target: RaidTarget, metric: Metric): RaidResult {
  const none: RaidResult = { reachable: false, steps: [], charges: 0, fuel: 0, path: [] };
  if (!pieces.length) return none;

  // ---- grid extents
  let minX = target.x, maxX = target.x, minZ = target.z, maxZ = target.z;
  let maxL = target.l;
  for (const p of pieces) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    maxL = Math.max(maxL, p.l + 2);
  }
  maxL = Math.min(maxL, MAX_LEVEL);
  const M = 8;
  minX -= M; minZ -= M; maxX += M; maxZ += M;
  const NX = Math.ceil((maxX - minX) / CELL);
  const NZ = Math.ceil((maxZ - minZ) / CELL);
  const NL = maxL + 1;
  const NC = NX * NZ;
  const cx = (i: number) => minX + (i + 0.5) * CELL;
  const cz = (j: number) => minZ + (j + 0.5) * CELL;
  const idx = (l: number, i: number, j: number) => l * NC + j * NX + i;

  // ---- cell classification
  const walk = new Uint8Array(NL * NC); // solid floor (or ground on storey 0)
  const hatch = new Int32Array(NL * NC).fill(-1); // piece id of a closed floor door
  const hole = new Uint8Array(NL * NC); // porthole or hatch opening
  const stairUp = new Uint8Array(NL * NC);
  const stairTop = new Uint8Array(NL * NC);
  walk.fill(1, 0, NC);
  const byId = new Map(pieces.map((p) => [p.id, p]));

  const cover = (fn: (x: number, z: number) => boolean, l: number, x0: number, x1: number, z0: number, z1: number, cb: (k: number) => void) => {
    const i0 = Math.max(0, Math.floor((x0 - minX) / CELL)), i1 = Math.min(NX - 1, Math.ceil((x1 - minX) / CELL));
    const j0 = Math.max(0, Math.floor((z0 - minZ) / CELL)), j1 = Math.min(NZ - 1, Math.ceil((z1 - minZ) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (fn(cx(i), cz(j))) cb(idx(l, i, j));
  };

  for (const p of pieces) {
    const d = PARTS[p.t];
    if (d.kind !== 'floor' || p.l >= NL) continue;
    const poly = floorPoly(p);
    const xs = poly.map((v) => v[0]), zs = poly.map((v) => v[1]);
    const hasHole = d.hole === 'porthole' || d.hole === 'hatch';
    cover((x, z) => inConvex(poly, x, z), p.l, Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs), (k) => {
      const x = cx(k % NX), z = cz(Math.floor((k % NC) / NX));
      if (hasHole && inRect(x, z, p.x, p.z, p.r, 1.1, 2.55)) {
        hole[k] = 1;
        if (d.hole === 'hatch') hatch[k] = p.id;
        if (p.l > 0) walk[k] = 0;
      } else walk[k] = 1;
    });
  }
  for (const p of pieces) {
    const d = PARTS[p.t];
    if ((d.kind !== 'stairs' && d.kind !== 'spiral') || p.l + 1 >= NL) continue;
    const fn = d.kind === 'stairs' ? (x: number, z: number) => inRect(x, z, p.x, p.z, p.r, 1.5, 2.9) : (x: number, z: number) => Math.hypot(x - p.x, z - p.z) <= 1.9;
    cover(fn, p.l, p.x - 2, p.x + 2, p.z - 2, p.z + 2, (k) => {
      stairUp[k] = 1;
      const up = k + NC;
      if (!walk[up] || hole[up]) stairTop[up] = 1;
    });
  }

  // ---- barriers per storey
  const barriers: Barrier[] = [];
  for (const p of pieces) {
    const d = PARTS[p.t];
    if (d.kind !== 'wall' && d.kind !== 'palisade') continue;
    const [A, B] = wallSeg(p, d.width ?? 4.46);
    const ext = 0.06;
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const ux = (B[0] - A[0]) / len, uz = (B[1] - A[1]) / len;
    const a: V2 = [A[0] - ux * ext, A[1] - uz * ext];
    const b: V2 = [B[0] + ux * ext, B[1] + uz * ext];
    const op = d.opening ?? 'none';
    let kind: BarrierKind = 'wall';
    if (d.raid) kind = 'door';
    else if (op === 'window') {
      const barred = pieces.some((q) => PARTS[q.t].kind === 'bars' && Math.hypot(q.x - p.x, q.z - p.z) < 0.4 && q.l === p.l);
      kind = barred ? 'wall' : 'window';
    } else if (op === 'none' && (d.height ?? LEVEL_H) < CLIMB_MAX) {
      // stacked low walls add up
      const same = pieces.filter((q) => q.l === p.l && PARTS[q.t].kind === 'wall' && Math.hypot(q.x - p.x, q.z - p.z) < 0.2);
      const bottom = Math.min(...same.map((q) => q.y));
      const top = Math.max(...same.map((q) => q.y + (PARTS[q.t].height ?? LEVEL_H)));
      kind = top - bottom < CLIMB_MAX ? 'low' : 'wall';
    }
    barriers.push({ a, b, kind, piece: p, charges: d.raid?.charges ?? 0, fuel: d.raid?.fuel ?? 0 });
  }
  // edge -> barrier indices (edges: 2 per cell: +x and +z)
  const edgeBar = new Map<number, number[]>();
  barriers.forEach((bar, bi) => {
    const d = PARTS[bar.piece.t];
    const levels = Math.max(1, Math.ceil(((d.height ?? LEVEL_H) - 0.05) / LEVEL_H));
    const x0 = Math.min(bar.a[0], bar.b[0]), x1 = Math.max(bar.a[0], bar.b[0]);
    const z0 = Math.min(bar.a[1], bar.b[1]), z1 = Math.max(bar.a[1], bar.b[1]);
    const i0 = Math.max(0, Math.floor((x0 - minX) / CELL) - 1), i1 = Math.min(NX - 1, Math.ceil((x1 - minX) / CELL) + 1);
    const j0 = Math.max(0, Math.floor((z0 - minZ) / CELL) - 1), j1 = Math.min(NZ - 1, Math.ceil((z1 - minZ) / CELL) + 1);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const c: V2 = [cx(i), cz(j)];
        for (const dir of [0, 1]) {
          const n: V2 = dir === 0 ? [cx(i + 1), cz(j)] : [cx(i), cz(j + 1)];
          if (!segCross(c, n, bar.a, bar.b)) continue;
          for (let k = 0; k < levels; k++) {
            const l = bar.piece.l + k;
            if (l >= NL) break;
            const key = (idx(l, i, j) << 1) | dir;
            const list = edgeBar.get(key) ?? [];
            list.push(bi);
            edgeBar.set(key, list);
          }
        }
      }
    }
  });

  const weight = (charges: number, fuel: number) => (metric === 'charges' ? charges * 1e6 + fuel : fuel * 100 + charges);
  const hatchCost = (id: number) => {
    const r = PARTS[byId.get(id)!.t].raid!;
    return { c: r.charges, f: r.fuel };
  };

  // ---- Dijkstra
  const N = NL * NC;
  const dist = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const via = new Map<number, number[]>(); // node -> crossed barrier indices / -hatchId-1
  const heap = new Heap();
  for (let i = 0; i < NX; i++) {
    for (const j of [0, NZ - 1]) {
      const k = idx(0, i, j);
      dist[k] = 0;
      heap.push(0, k);
    }
  }
  for (let j = 0; j < NZ; j++) {
    for (const i of [0, NX - 1]) {
      const k = idx(0, i, j);
      dist[k] = 0;
      heap.push(0, k);
    }
  }
  const ti = Math.floor((target.x - minX) / CELL), tj = Math.floor((target.z - minZ) / CELL);
  const goal = idx(Math.min(target.l, NL - 1), Math.max(0, Math.min(NX - 1, ti)), Math.max(0, Math.min(NZ - 1, tj)));

  const relax = (from: number, to: number, w: number, tags: number[]) => {
    const nd = dist[from] + w + 1;
    if (nd < dist[to]) {
      dist[to] = nd;
      prev[to] = from;
      via.set(to, tags);
      heap.push(nd, to);
    }
  };
  const standable = (k: number) => walk[k] || stairTop[k];

  while (heap.size) {
    const [dk, k] = heap.pop()!;
    if (dk > dist[k]) continue;
    if (k === goal) break;
    const l = Math.floor(k / NC);
    const c = k % NC;
    const i = c % NX, j = Math.floor(c / NX);
    const nbrs: [number, number, number][] = [];
    if (i + 1 < NX) nbrs.push([i + 1, j, (k << 1) | 0]);
    if (i > 0) nbrs.push([i - 1, j, (idx(l, i - 1, j) << 1) | 0]);
    if (j + 1 < NZ) nbrs.push([i, j + 1, (k << 1) | 1]);
    if (j > 0) nbrs.push([i, j - 1, (idx(l, i, j - 1) << 1) | 1]);
    for (const [ni, nj, edge] of nbrs) {
      const bars = edgeBar.get(edge) ?? [];
      let blocked = false;
      let ch = 0, fu = 0;
      for (const bi of bars) {
        const b = barriers[bi];
        if (b.kind === 'wall') blocked = true;
        else if (b.kind === 'door') {
          ch += b.charges;
          fu += b.fuel;
        }
      }
      if (blocked) continue;
      const n = idx(l, ni, nj);
      if (standable(n) || (l === 0)) {
        relax(k, n, weight(ch, fu), bars);
      } else if (l > 0) {
        // step off an edge or into a hole: fall to the first surface below
        let tags = bars;
        if (hatch[n] >= 0) {
          const h = hatchCost(hatch[n]);
          ch += h.c;
          fu += h.f;
          tags = [...bars, -hatch[n] - 1];
        }
        for (let ll = l - 1; ll >= 0; ll--) {
          const m = idx(ll, ni, nj);
          if (ll === 0 || standable(m)) {
            relax(k, m, weight(ch, fu), tags);
            break;
          }
        }
      }
    }
    // climb the stairs
    if (stairUp[k] && l + 1 < NL) {
      const up = k + NC;
      if (stairTop[up]) {
        if (hatch[up] >= 0) {
          const h = hatchCost(hatch[up]);
          relax(k, up, weight(h.c, h.f), [-hatch[up] - 1]);
        } else relax(k, up, 0, []);
      }
    }
  }

  if (!isFinite(dist[goal])) return none;

  // ---- reconstruct
  const nodes: number[] = [];
  for (let k = goal; k >= 0; k = prev[k]) nodes.push(k);
  nodes.reverse();
  const steps: RaidStep[] = [];
  const seen = new Set<number>();
  let charges = 0, fuel = 0;
  for (const n of nodes) {
    for (const tag of via.get(n) ?? []) {
      let piece: Piece;
      let kind: RaidStep['kind'];
      if (tag < 0) {
        piece = byId.get(-tag - 1)!;
        kind = 'door';
      } else {
        const b = barriers[tag];
        piece = b.piece;
        kind = b.kind === 'door' ? (PARTS[piece.t].kind === 'palisade' ? 'palisade' : 'door') : b.kind === 'window' ? 'window' : 'low';
      }
      if (seen.has(piece.id)) continue;
      seen.add(piece.id);
      const r = PARTS[piece.t].raid;
      const st: RaidStep = { pieceId: piece.id, name: PARTS[piece.t].name, level: piece.l, charges: r?.charges ?? 0, fuel: r?.fuel ?? 0, kind };
      if (kind === 'window' || kind === 'low') {
        st.charges = 0;
        st.fuel = 0;
      }
      charges += st.charges;
      fuel += st.fuel;
      steps.push(st);
    }
  }
  // thin out the polyline: keep turns and storey changes
  const pts = nodes.map((k) => {
    const l = Math.floor(k / NC), c = k % NC;
    return { x: cx(c % NX), y: floorTop(l) + 0.35, z: cz(Math.floor(c / NX)) };
  });
  const path = pts.filter((p, i) => {
    if (i === 0 || i === pts.length - 1) return true;
    const a = pts[i - 1], b = pts[i + 1];
    return !(Math.abs((p.x - a.x) * (b.z - p.z) - (p.z - a.z) * (b.x - p.x)) < 1e-6 && a.y === p.y && b.y === p.y);
  });
  // skip the long walk in from the grid border
  let start = 0;
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (p.x > minX + M - 2 && p.x < maxX - M + 2 && p.z > minZ + M - 2 && p.z < maxZ - M + 2) {
      start = Math.max(0, i - 1);
      break;
    }
  }
  return { reachable: true, steps, charges, fuel, path: path.slice(start) };
}

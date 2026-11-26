import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GRID, LEVEL_H, SLAB, WALL_H } from './constants';
import { PARTS, type PartDef, type Opening } from './data';
import { shapeVerts } from './shapes';
import { barkTex, burlapTex, cinderTex, metalTex, netTex, woodTex } from './textures';

// ------------------------------------------------------------------ materials
const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });

export const MAT = {
  wood: std({ map: woodTex() }),
  woodFrame: std({ map: woodTex([70, 60, 50], 9) }),
  woodFloor: std({ map: woodTex([104, 96, 86], 13) }),
  cinder: std({ map: cinderTex(), roughness: 0.95 }),
  metal: std({ map: metalTex(), metalness: 0.35, roughness: 0.7 }),
  metalDark: std({ color: 0x3a3f44, metalness: 0.5, roughness: 0.55 }),
  log: std({ map: barkTex() }),
  burlap: std({ map: burlapTex() }),
  net: std({ map: netTex(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0xa9d3e0, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, depthWrite: false,
  }),
  flag: std({ color: 0xb8432f, side: THREE.DoubleSide }),
  collider: new THREE.MeshBasicMaterial({ visible: false }),
};

const furnitureMats = new Map<string, THREE.MeshStandardMaterial>();
function colorMat(color: string) {
  let m = furnitureMats.get(color);
  if (!m) {
    m = std({ color, roughness: 0.75, metalness: 0.1 });
    furnitureMats.set(color, m);
  }
  return m;
}

function lookMats(def: PartDef) {
  switch (def.look) {
    case 'cinder': return { main: MAT.cinder, frame: MAT.cinder, leaf: MAT.metal, floor: MAT.cinder };
    case 'metal': return { main: MAT.metal, frame: MAT.metalDark, leaf: MAT.metal, floor: MAT.metal };
    case 'log': return { main: MAT.log, frame: MAT.log, leaf: MAT.log, floor: MAT.log };
    default: return { main: MAT.wood, frame: MAT.woodFrame, leaf: MAT.wood, floor: MAT.woodFloor };
  }
}

// ----------------------------------------------------------------- geometry
/** Box whose UVs are in metres so textures keep a constant scale. */
function meterBox(w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]);
    }
  }
  return g;
}

function meterCylinder(r: number, h: number, seg = 10) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r, uv.getY(i) * h);
  return g;
}

interface BoxOpts {
  ry?: number;
  rx?: number;
  noCollide?: boolean;
}

function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, o: BoxOpts = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o.ry) m.rotation.y = o.ry;
  if (o.rx) m.rotation.x = o.rx;
  if (o.noCollide) m.userData.noCollide = true;
  m.castShadow = mat !== MAT.glass && mat !== MAT.collider;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

const box = (p: THREE.Object3D, mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, o?: BoxOpts) =>
  mesh(p, meterBox(w, h, d), mat, x, y, z, o);

type DoorMode = 'hinge' | 'hingeR' | 'hatch' | 'roller';
function pivot(parent: THREE.Object3D, mode: DoorMode, x: number, y: number, z: number, h = 0) {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  p.userData.door = { mode, t: 0, target: 0, baseY: y, h };
  parent.add(p);
  return p;
}

// -------------------------------------------------------------------- walls
interface OpeningSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  glass?: boolean;
  leaf?: 'hinge' | 'double' | 'roller';
}

function openingSpec(op: Opening, W: number, H: number): OpeningSpec | null {
  switch (op) {
    case 'window': return { x: 0, y: 1.0, w: 1.3, h: 0.9 };
    case 'glasswindow': return { x: 0, y: 1.0, w: 1.3, h: 0.9, glass: true };
    case 'glass': return { x: 0, y: 0.35, w: W - 0.5, h: H - 0.7, glass: true };
    case 'door': return { x: 0, y: 0, w: 1.2, h: 2.2, leaf: 'hinge' };
    case 'smalldoor': return { x: 0, y: 0, w: 0.9, h: 1.9, leaf: 'hinge' };
    case 'garage': return { x: 0, y: 0, w: Math.min(W - 0.5, 2.5), h: 2.4, leaf: 'double' };
    case 'shutter': return { x: 0, y: 0, w: 2.5, h: 2.4, leaf: 'roller' };
    case 'hangar': return { x: 0, y: 0, w: W - 0.6, h: 2.6, leaf: 'double' };
    case 'hangarshutter': return { x: 0, y: 0, w: W - 0.6, h: 2.6, leaf: 'roller' };
    default: return null;
  }
}

export function windowSpec() {
  return openingSpec('window', GRID, WALL_H)!;
}

function buildLeaves(g: THREE.Object3D, op: OpeningSpec, T: number, leafMat: THREE.Material, frameMat: THREE.Material) {
  const lt = Math.min(0.08, T * 0.6);
  if (op.leaf === 'hinge') {
    const p = pivot(g, 'hinge', op.x - op.w / 2, op.y, 0);
    box(p, leafMat, op.w - 0.04, op.h - 0.03, lt, op.w / 2, op.h / 2, 0);
    box(p, frameMat, op.w - 0.1, 0.12, lt + 0.02, op.w / 2, op.h * 0.25, 0);
    box(p, frameMat, op.w - 0.1, 0.12, lt + 0.02, op.w / 2, op.h * 0.75, 0);
    box(p, MAT.metalDark, 0.06, 0.06, lt + 0.08, op.w - 0.15, op.h * 0.5, 0);
  } else if (op.leaf === 'double') {
    const hw = op.w / 2;
    const l = pivot(g, 'hinge', op.x - hw, op.y, 0);
    box(l, leafMat, hw - 0.02, op.h - 0.03, lt, hw / 2, op.h / 2, 0);
    box(l, frameMat, hw - 0.1, 0.12, lt + 0.02, hw / 2, op.h * 0.5, 0);
    const r = pivot(g, 'hingeR', op.x + hw, op.y, 0);
    box(r, leafMat, hw - 0.02, op.h - 0.03, lt, -hw / 2, op.h / 2, 0);
    box(r, frameMat, hw - 0.1, 0.12, lt + 0.02, -hw / 2, op.h * 0.5, 0);
  } else if (op.leaf === 'roller') {
    const p = pivot(g, 'roller', op.x, op.y, 0, op.h);
    box(p, MAT.metal, op.w - 0.04, op.h - 0.02, lt, 0, op.h / 2, 0);
    for (let y = 0.3; y < op.h; y += 0.3) box(p, MAT.metalDark, op.w - 0.06, 0.03, lt + 0.02, 0, y, 0);
    box(g, MAT.metalDark, op.w + 0.1, 0.25, T + 0.1, op.x, op.y + op.h + 0.12, 0, { noCollide: true });
  }
}

function buildWall(def: PartDef) {
  const g = new THREE.Group();
  const W = def.width ?? GRID;
  const H = def.height ?? WALL_H;
  const T = def.look === 'cinder' ? 0.25 : 0.2;
  const m = lookMats(def);
  const op = openingSpec(def.opening ?? 'none', W, H);
  if (!op) {
    box(g, m.main, W, H, T, 0, H / 2, 0);
  } else {
    const l = -W / 2, r = W / 2, x0 = op.x - op.w / 2, x1 = op.x + op.w / 2, top = op.y + op.h;
    if (x0 - l > 0.001) box(g, m.main, x0 - l, H, T, (l + x0) / 2, H / 2, 0);
    if (r - x1 > 0.001) box(g, m.main, r - x1, H, T, (x1 + r) / 2, H / 2, 0);
    if (H - top > 0.001) box(g, m.main, op.w, H - top, T, op.x, (top + H) / 2, 0);
    if (op.y > 0.001) box(g, m.main, op.w, op.y, T, op.x, op.y / 2, 0);
    if (op.glass) {
      box(g, MAT.glass, op.w, op.h, 0.03, op.x, op.y + op.h / 2, 0);
      if (op.w > 2) box(g, m.frame, 0.08, op.h, T * 0.6, op.x, op.y + op.h / 2, 0);
    }
    if (def.look === 'wood') {
      const jt = T + 0.04;
      box(g, m.frame, 0.1, op.h, jt, x0 - 0.05, op.y + op.h / 2, 0);
      box(g, m.frame, 0.1, op.h, jt, x1 + 0.05, op.y + op.h / 2, 0);
      box(g, m.frame, op.w + 0.2, 0.1, jt, op.x, top + 0.05, 0);
      if (op.y > 0) box(g, m.frame, op.w + 0.2, 0.1, jt, op.x, op.y - 0.05, 0);
    }
    buildLeaves(g, op, T, m.leaf, m.frame);
  }
  if (def.look === 'wood') {
    const ft = T + 0.06;
    box(g, m.frame, 0.16, H, ft, -W / 2 + 0.08, H / 2, 0);
    box(g, m.frame, 0.16, H, ft, W / 2 - 0.08, H / 2, 0);
    box(g, m.frame, W, 0.14, ft, 0, H - 0.07, 0);
    if (!op || op.y > 0) box(g, m.frame, W, 0.14, ft, 0, 0.07, 0);
    else {
      const seg = (W - op.w) / 2;
      if (seg > 0.2) {
        box(g, m.frame, seg, 0.14, ft, -W / 2 + seg / 2, 0.07, 0);
        box(g, m.frame, seg, 0.14, ft, W / 2 - seg / 2, 0.07, 0);
      }
    }
  } else if (def.look === 'cinder') {
    box(g, MAT.metalDark, W, 0.06, T + 0.04, 0, H - 0.03, 0, { noCollide: true });
  }
  return g;
}

// ------------------------------------------------------------------- floors
function buildFloor(def: PartDef) {
  const g = new THREE.Group();
  const m = lookMats(def);
  const verts = shapeVerts(def.shape ?? 'square');
  const shape = new THREE.Shape(verts.map(([x, z]) => new THREE.Vector2(x, -z)));
  if (def.hole === 'porthole') {
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.55, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  } else if (def.hole === 'hatch') {
    const h = 0.6;
    const hole = new THREE.Path([new THREE.Vector2(-h, -h), new THREE.Vector2(-h, h), new THREE.Vector2(h, h), new THREE.Vector2(h, -h)]);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: SLAB, bevelEnabled: false, curveSegments: 20 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -SLAB, 0);
  mesh(g, geo, m.floor, 0, 0, 0);
  // edge beams give the framed look and make seams readable
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const inv = Math.hypot(mx, mz) || 1;
    const bw = 0.14;
    box(g, m.frame, len - 0.02, SLAB + 0.012, bw, mx - (mx / inv) * (bw / 2), -SLAB / 2 + 0.006, mz - (mz / inv) * (bw / 2), {
      ry: -Math.atan2(dz, dx),
    });
  }
  if (def.hole === 'hatch') {
    const h = 0.6;
    const p = pivot(g, 'hatch', 0, 0, -h);
    box(p, m.leaf, 2 * h - 0.04, 0.07, 2 * h - 0.04, 0, -0.035, h);
    box(p, MAT.metalDark, 0.3, 0.04, 0.06, 0, 0.02, 2 * h - 0.2);
  } else if (def.hole === 'porthole') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.05, 6, 24), MAT.metalDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.005;
    ring.userData.noCollide = true;
    g.add(ring);
  }
  return g;
}

// ------------------------------------------------------------------- stairs
function buildStairs(def: PartDef) {
  const g = new THREE.Group();
  const m = lookMats(def);
  const n = 12;
  const run = GRID;
  const w = 1.3;
  for (let i = 0; i < n; i++) {
    box(g, m.floor, w, 0.06, run / n + 0.03, 0, ((i + 1) * LEVEL_H) / n - 0.03, -run / 2 + ((i + 0.5) * run) / n, { noCollide: true });
  }
  const hyp = Math.hypot(run, LEVEL_H);
  const ang = -Math.atan2(LEVEL_H, run);
  for (const sx of [-1, 1]) {
    box(g, m.frame, 0.07, 0.3, hyp, (sx * (w + 0.07)) / 2, LEVEL_H / 2 - 0.1, 0, { rx: ang, noCollide: true });
    box(g, m.frame, 0.05, 0.05, hyp, (sx * (w + 0.07)) / 2, LEVEL_H / 2 + 0.85, 0, { rx: ang, noCollide: true });
    for (const t of [0.15, 0.5, 0.85]) {
      const z = -run / 2 + t * run;
      const y = t * LEVEL_H;
      box(g, m.frame, 0.05, 0.95, 0.05, (sx * (w + 0.07)) / 2, y + 0.45, z, { noCollide: true });
    }
  }
  box(g, MAT.collider, w, 0.04, hyp, 0, LEVEL_H / 2, 0, { rx: ang });
  return g;
}

function buildSpiral(def: PartDef) {
  const g = new THREE.Group();
  const m = lookMats(def);
  mesh(g, meterCylinder(0.13, LEVEL_H, 12), m.frame, 0, LEVEL_H / 2, 0);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 0.72;
    const s = box(g, m.floor, 1.2, 0.06, 0.5, Math.cos(a) * r, ((i + 1) * LEVEL_H) / n - 0.03, -Math.sin(a) * r, { ry: a });
    s.castShadow = true;
    box(g, m.frame, 0.04, 0.9, 0.04, Math.cos(a) * 1.3, ((i + 1) * LEVEL_H) / n + 0.45, -Math.sin(a) * 1.3, { noCollide: true });
  }
  return g;
}

// ---------------------------------------------------------------- palisade
function buildPalisade(def: PartDef) {
  const g = new THREE.Group();
  const W = def.width ?? 4;
  const H = def.height ?? 4;
  const r = 0.16;
  const gate = def.opening === 'garage';
  const gw = 2.4;
  const logs = Math.round(W / (2 * r));
  const geoLog = meterCylinder(r, H, 9);
  const geoTip = new THREE.ConeGeometry(r, 0.45, 9);
  for (let i = 0; i < logs; i++) {
    const x = -W / 2 + r + i * 2 * r;
    if (gate && Math.abs(x) < gw / 2) continue;
    const hh = H + Math.sin(i * 2.7) * 0.15;
    mesh(g, geoLog, MAT.log, x, hh / 2, 0);
    mesh(g, geoTip, MAT.log, x, hh + 0.22, 0, { noCollide: true });
  }
  const beam = (y: number, x0: number, x1: number) => {
    const b = mesh(g, meterCylinder(0.09, x1 - x0, 8), MAT.log, (x0 + x1) / 2, y, -r - 0.06, { noCollide: true });
    b.rotation.z = Math.PI / 2;
  };
  if (gate) {
    beam(0.8, -W / 2, -gw / 2);
    beam(0.8, gw / 2, W / 2);
    beam(3.0, -W / 2, W / 2);
    box(g, MAT.log, gw + 0.3, 0.35, 0.35, 0, 2.95, 0);
    const half = gw / 2;
    for (const side of [-1, 1]) {
      const p = pivot(g, side < 0 ? 'hinge' : 'hingeR', side * half, 0, 0);
      const n = Math.round(half / (2 * 0.12));
      for (let i = 0; i < n; i++) {
        const x = -side * (0.12 + i * 0.24);
        mesh(p, meterCylinder(0.12, 2.7, 8), MAT.log, x, 1.38, 0);
      }
      box(p, MAT.woodFrame, half - 0.05, 0.14, 0.1, -side * (half / 2), 0.6, 0.12);
      box(p, MAT.woodFrame, half - 0.05, 0.14, 0.1, -side * (half / 2), 2.1, 0.12);
    }
  } else {
    beam(0.8, -W / 2, W / 2);
    beam(3.0, -W / 2, W / 2);
  }
  return g;
}

// -------------------------------------------------------------- window bars
function buildBars() {
  const g = new THREE.Group();
  const op = windowSpec();
  const rod = meterCylinder(0.018, op.h, 6);
  for (let x = -op.w / 2 + 0.1; x <= op.w / 2 - 0.09; x += 0.14) mesh(g, rod, MAT.metalDark, x, op.y + op.h / 2, 0);
  box(g, MAT.metalDark, op.w, 0.04, 0.04, 0, op.y + 0.05, 0);
  box(g, MAT.metalDark, op.w, 0.04, 0.04, 0, op.y + op.h - 0.05, 0);
  box(g, MAT.metalDark, op.w, 0.04, 0.04, 0, op.y + op.h / 2, 0);
  return g;
}

// ------------------------------------------------------------------ objects
function sandbagRow(g: THREE.Object3D, len: number, x: number, z: number, ry: number, rows = 3) {
  for (let r = 0; r < rows; r++) {
    const n = Math.max(1, Math.round(len / 0.55));
    const seg = len / n;
    for (let i = 0; i < n; i++) {
      const off = r % 2 ? seg / 2 : 0;
      const lx = -len / 2 + seg / 2 + i * seg + off;
      if (lx > len / 2) continue;
      const c = Math.cos(ry), s = Math.sin(ry);
      const b = box(g, MAT.burlap, seg - 0.03, 0.28, 0.55, x + lx * c, 0.15 + r * 0.29, z - lx * s, { ry });
      b.scale.set(1, 1, 1);
    }
  }
}

function buildObject(def: PartDef) {
  const g = new THREE.Group();
  const [w, h, d] = def.size ?? [1, 1, 1];
  const m = lookMats(def);
  switch (def.style) {
    case 'workbench': {
      box(g, MAT.woodFrame, w, 0.08, d, 0, h - 0.04, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, MAT.woodFrame, 0.1, h - 0.08, 0.1, sx * (w / 2 - 0.08), (h - 0.08) / 2, sz * (d / 2 - 0.08));
      box(g, MAT.wood, w - 0.2, 0.05, d - 0.2, 0, 0.25, 0, { noCollide: true });
      box(g, MAT.metalDark, 0.25, 0.18, 0.2, w / 2 - 0.25, h + 0.09, -d / 2 + 0.15, { noCollide: true });
      box(g, MAT.wood, w, 0.9, 0.05, 0, h + 0.45, -d / 2 + 0.02, { noCollide: true });
      break;
    }
    case 'storage': {
      box(g, MAT.woodFrame, w, 0.1, d, 0, 0.05, 0);
      for (const sx of [-1, 1]) box(g, MAT.woodFrame, 0.12, h, d, sx * (w / 2 - 0.06), h / 2, 0);
      const lg = meterCylinder(0.14, w - 0.3, 9);
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i < 3; i++) {
          const l = mesh(g, lg, MAT.log, 0, 0.25 + row * 0.27, -d / 2 + 0.2 + i * 0.3, { noCollide: true });
          l.rotation.z = Math.PI / 2;
        }
      }
      break;
    }
    case 'sign': {
      box(g, MAT.woodFrame, 0.08, h, 0.08, 0, h / 2, 0);
      box(g, MAT.wood, w, 0.45, 0.05, 0, h - 0.25, 0.06);
      break;
    }
    case 'greenhouse': {
      const fm = def.look === 'metal' ? MAT.metalDark : MAT.woodFrame;
      for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) box(g, fm, 0.08, h, 0.08, sx * (w / 2 - 0.04), h / 2, sz * (d / 2 - 0.04));
      box(g, fm, w, 0.08, 0.08, 0, h, d / 2 - 0.04);
      box(g, fm, w, 0.08, 0.08, 0, h, -d / 2 + 0.04);
      box(g, fm, 0.08, 0.08, d, 0, h + 0.6, 0);
      for (const sx of [-1, 1]) {
        box(g, MAT.glass, 0.02, h, d, sx * (w / 2 - 0.04), h / 2, 0);
        box(g, MAT.glass, w / 2 + 0.2, 0.02, d, (sx * w) / 4, h + 0.3, 0, { noCollide: true }).rotation.z = sx * -0.38;
      }
      box(g, MAT.glass, w, h, 0.02, 0, h / 2, -d / 2 + 0.04);
      box(g, MAT.burlap, w - 0.6, 0.25, d - 0.6, 0, 0.12, 0);
      break;
    }
    case 'shed': {
      const t = 0.12;
      box(g, MAT.woodFloor, w, 0.12, d, 0, 0.06, 0);
      box(g, MAT.wood, w, h, t, 0, h / 2, -d / 2 + t / 2);
      for (const sx of [-1, 1]) box(g, MAT.wood, t, h, d, sx * (w / 2 - t / 2), h / 2, 0);
      const dw = 1.2;
      const side = (w - dw) / 2;
      box(g, MAT.wood, side, h, t, -w / 2 + side / 2, h / 2, d / 2 - t / 2);
      box(g, MAT.wood, side, h, t, w / 2 - side / 2, h / 2, d / 2 - t / 2);
      box(g, MAT.wood, dw, h - 2.1, t, 0, 2.1 + (h - 2.1) / 2, d / 2 - t / 2);
      const p = pivot(g, 'hinge', -dw / 2, 0.12, d / 2 - t / 2);
      box(p, MAT.wood, dw - 0.03, 1.95, 0.07, dw / 2, 0.98, 0);
      box(g, MAT.metal, w + 0.3, 0.06, d + 0.4, 0, h + 0.1, 0, { rx: 0.12 });
      break;
    }
    case 'sandbag':
      sandbagRow(g, w, 0, 0, 0);
      break;
    case 'sandbag_corner':
      sandbagRow(g, w, 0, -d / 2 + 0.3, 0);
      sandbagRow(g, d - 0.6, -w / 2 + 0.3, 0.3, Math.PI / 2);
      break;
    case 'sandbag_round': {
      const R = w / 2;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const a = (i + 0.5) * (Math.PI / 2 / n);
        sandbagRow(g, ((Math.PI / 2) * R) / n + 0.05, Math.cos(a) * R - R / 2, -Math.sin(a) * R + R / 2, a + Math.PI / 2, 3);
      }
      break;
    }
    case 'hesco': {
      const bw = w / 3;
      for (let i = 0; i < 3; i++) {
        const x = -w / 2 + bw / 2 + i * bw;
        box(g, MAT.burlap, bw - 0.04, h, d, x, h / 2, 0);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, MAT.metalDark, 0.03, h, 0.03, x + sx * (bw / 2 - 0.03), h / 2, sz * (d / 2), { noCollide: true });
      }
      break;
    }
    case 'camonet': {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(g, meterCylinder(0.04, h, 6), MAT.log, sx * (w / 2 - 0.1), h / 2, sz * (d / 2 - 0.1));
      mesh(g, meterCylinder(0.04, h + 0.4, 6), MAT.log, 0, (h + 0.4) / 2, 0);
      const net = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, d + 0.6, 6, 6), MAT.net);
      const pos = net.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        pos.setZ(i, -0.35 * (1 - Math.min(1, Math.hypot(x, y) / (w / 2))));
      }
      net.geometry.computeVertexNormals();
      net.rotation.x = -Math.PI / 2;
      net.position.y = h + 0.05;
      net.userData.noCollide = true;
      net.castShadow = true;
      g.add(net);
      break;
    }
    case 'machine': {
      const cm = colorMat(def.color ?? '#555');
      box(g, cm, w, h, d, 0, h / 2, 0);
      box(g, MAT.metalDark, w * 0.6, h * 0.3, 0.02, 0, h * 0.6, d / 2 + 0.01, { noCollide: true });
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0x6cff9a }));
      led.position.set(w * 0.35, h * 0.85, d / 2 + 0.02);
      led.userData.noCollide = true;
      g.add(led);
      break;
    }
    default: {
      const cm = colorMat(def.color ?? '#555');
      box(g, cm, w, h, d, 0, h / 2, 0);
      box(g, MAT.metalDark, w * 0.9, 0.03, 0.02, 0, h * 0.82, d / 2 + 0.005, { noCollide: true });
      box(g, MAT.metalDark, 0.12, 0.04, 0.04, 0, h * 0.6, d / 2 + 0.02, { noCollide: true });
    }
  }
  void m;
  return g;
}

function buildPlotPole() {
  const g = new THREE.Group();
  box(g, MAT.metalDark, 0.6, 0.15, 0.6, 0, 0.075, 0);
  mesh(g, meterCylinder(0.05, 2.6, 8), MAT.metalDark, 0, 1.3, 0);
  const flag = box(g, MAT.flag, 0.9, 0.55, 0.01, 0.47, 2.25, 0, { noCollide: true });
  flag.castShadow = true;
  return g;
}

// --------------------------------------------------------- template caching
/** Merge static meshes by material so each placed part costs few draw calls. */
function finalize(root: THREE.Group) {
  const buckets = new Map<string, { mat: THREE.Material; noCollide: boolean; geos: THREE.BufferGeometry[]; cast: boolean }>();
  const statics = root.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh && !c.userData.door);
  for (const m of statics) {
    m.updateMatrix();
    const mat = m.material as THREE.Material;
    const key = mat.uuid + (m.userData.noCollide ? ':n' : ':c');
    let b = buckets.get(key);
    if (!b) {
      b = { mat, noCollide: !!m.userData.noCollide, geos: [], cast: m.castShadow };
      buckets.set(key, b);
    }
    let geo = m.geometry.clone().applyMatrix4(m.matrix);
    if (geo.index) geo = geo.toNonIndexed();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    b.geos.push(geo);
    root.remove(m);
  }
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mm = new THREE.Mesh(merged, b.mat);
    mm.castShadow = b.cast;
    mm.receiveShadow = true;
    if (b.noCollide) mm.userData.noCollide = true;
    root.add(mm);
  }
  return root;
}

const templates = new Map<string, THREE.Group>();

export function getTemplate(id: string): THREE.Group {
  let t = templates.get(id);
  if (t) return t;
  const def = PARTS[id];
  let g: THREE.Group;
  switch (def.kind) {
    case 'wall': g = buildWall(def); break;
    case 'floor': g = buildFloor(def); break;
    case 'stairs': g = buildStairs(def); break;
    case 'spiral': g = buildSpiral(def); break;
    case 'palisade': g = buildPalisade(def); break;
    case 'bars': g = buildBars(); break;
    case 'plotpole': g = buildPlotPole(); break;
    default: g = buildObject(def);
  }
  t = finalize(g);
  templates.set(id, t);
  return t;
}

export function createPartObject(id: string): THREE.Group {
  return getTemplate(id).clone(true);
}

// ------------------------------------------------------------ ghost/preview
export const GHOST_OK = new THREE.MeshStandardMaterial({ color: 0xf2b45a, transparent: true, opacity: 0.5, depthWrite: false, emissive: 0x4a2c00 });
export const GHOST_BAD = new THREE.MeshStandardMaterial({ color: 0xff4d4d, transparent: true, opacity: 0.5, depthWrite: false, emissive: 0x400000 });

export function createGhost(id: string) {
  const g = createPartObject(id);
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = false;
      m.receiveShadow = false;
      if ((m.material as THREE.Material).visible === false) m.visible = false;
      else m.material = GHOST_OK;
    }
  });
  return g;
}

export function setGhostValid(g: THREE.Object3D, ok: boolean) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.visible) m.material = ok ? GHOST_OK : GHOST_BAD;
  });
}

const hlCache = new Map<string, THREE.Material>();
export function setHighlight(obj: THREE.Object3D, on: boolean, color = 0x6b4200) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (on) {
      if (!m.userData.origMat) m.userData.origMat = m.material;
      const orig = m.userData.origMat as THREE.Material;
      if (orig.visible === false) return;
      const key = orig.uuid + color;
      let h = hlCache.get(key);
      if (!h) {
        h = orig.clone();
        (h as THREE.MeshStandardMaterial).emissive?.setHex(color);
        hlCache.set(key, h);
      }
      m.material = h;
    } else if (m.userData.origMat) {
      m.material = m.userData.origMat;
      delete m.userData.origMat;
    }
  });
}

// ------------------------------------------------------------- door motion
export function findDoorPivots(obj: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  obj.traverse((o) => {
    if (o.userData.door) out.push(o);
  });
  return out;
}

/** Returns false once the pivot has reached its target. */
export function stepDoor(p: THREE.Object3D, dt: number): boolean {
  const d = p.userData.door;
  const speed = 2.2;
  if (Math.abs(d.t - d.target) < 0.001) return false;
  d.t += Math.sign(d.target - d.t) * Math.min(Math.abs(d.target - d.t), dt * speed);
  switch (d.mode as DoorMode) {
    case 'hinge': p.rotation.y = -d.t * 1.7; break;
    case 'hingeR': p.rotation.y = d.t * 1.7; break;
    case 'hatch': p.rotation.x = -d.t * 1.8; break;
    case 'roller':
      p.position.y = d.baseY + d.t * d.h * 0.92;
      p.scale.y = 1 - d.t * 0.92;
      break;
  }
  return true;
}

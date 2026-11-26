/**
 * Buildings from the player's own DayZ files, shown in the planner to build
 * in and around. The model is read locally (see odol.ts); only its name and
 * placement are stored in the plan, and the model bytes are cached in this
 * browser's IndexedDB so a reload does not need the file again.
 */
import * as THREE from 'three';
import { lodKind, readOdol, readPboFile, readPboIndex, type OdolLod, type OdolModel, type PboIndex } from './odol';

export interface SiteRef {
  id: string;
  /** PBO file name, e.g. structures_residential.pbo */
  pbo: string;
  /** model path inside the PBO */
  path: string;
  name: string;
  x: number;
  y: number;
  z: number;
  /** degrees, clockwise seen from above like the planner's parts */
  r: number;
  /** footprint for the placeholder while the model is not loaded */
  size: [number, number, number];
  center: [number, number, number];
}

export const siteKey = (pbo: string, path: string) => pbo.toLowerCase() + '|' + path.toLowerCase().replace(/\//g, '\\');
export const modelName = (path: string) => path.split('\\').pop()!.replace(/\.p3d$/i, '');

// ---------------------------------------------------------- local cache
const DB = 'abp.houses';
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const q = indexedDB.open(DB, 1);
    q.onupgradeneeded = () => q.result.createObjectStore('models');
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
async function cacheGet(key: string): Promise<Uint8Array | null> {
  try {
    const d = await db();
    return await new Promise((res) => {
      const q = d.transaction('models').objectStore('models').get(key);
      q.onsuccess = () => res(q.result ? new Uint8Array(q.result as ArrayBuffer) : null);
      q.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}
async function cachePut(key: string, bytes: Uint8Array) {
  try {
    const d = await db();
    d.transaction('models', 'readwrite').objectStore('models').put(bytes.slice().buffer, key);
  } catch {
    /* private mode: just no cache */
  }
}

// --------------------------------------------------------- PBO sessions
/** PBO files the player picked in this session, by lower-case file name. */
const pbos = new Map<string, { file: File; index: PboIndex }>();

export async function openPbo(file: File) {
  const index = await readPboIndex(file);
  pbos.set(file.name.toLowerCase(), { file, index });
  return index;
}

export function pboModels(index: PboIndex) {
  return index.entries
    .filter((e) => /\.p3d$/i.test(e.name) && !/(^|\\)proxy(\\|$)|\\proxies?\\/i.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const built = new Map<string, Promise<THREE.Group>>();

/** The model for a site, from the cache or an opened PBO; null if neither has it. */
export async function loadModel(pbo: string, path: string): Promise<THREE.Group | null> {
  const key = siteKey(pbo, path);
  const have = built.get(key);
  if (have) return have;
  let bytes = await cacheGet(key);
  if (!bytes) {
    const src = pbos.get(pbo.toLowerCase());
    if (!src) return null;
    const e = src.index.entries.find((x) => x.name.toLowerCase() === path.toLowerCase());
    if (!e) throw new Error('Modell nicht in der PBO gefunden');
    bytes = await readPboFile(src.file, e);
  }
  const b = bytes;
  const job = (async () => {
    const model = readOdol(b, (res) => res < 1000 || ['memory', 'roadway'].includes(lodKind(res)));
    const g = buildHouse(model);
    void cachePut(key, b);
    return g;
  })();
  built.set(key, job);
  job.catch(() => built.delete(key));
  return job;
}

// ------------------------------------------------------------ geometry
/** model space (left-handed, z forward) to planner space */
const P = (pts: Float32Array, i: number, ground: number) => new THREE.Vector3(pts[i * 3], pts[i * 3 + 1] - ground, -pts[i * 3 + 2]);

interface Look {
  color: number;
  glass?: boolean;
  roughness?: number;
}

function lookFor(texture: string, material: string): Look {
  const s = (texture + ' ' + material).toLowerCase();
  const proc = /color\(([\d.]+),([\d.]+),([\d.]+)/.exec(texture);
  if (/glass|okno|window_glass|sklo/.test(s)) return { color: 0x9fb8c4, glass: true };
  if (proc && !/nohq|smdi|_as|_mc|dt/.test(texture.toLowerCase())) {
    const c = new THREE.Color(+proc[1], +proc[2], +proc[3]);
    return { color: c.getHex() };
  }
  if (/roof|strecha|tiles?_|ceramic|tile_roof/.test(s)) return { color: 0x7a4a3c };
  if (/metal|iron|steel|plech|tin|zinc/.test(s)) return { color: 0x7b8086, roughness: 0.6 };
  if (/wood|drev|plank|door|dvere|prkn/.test(s)) return { color: 0x7a5c40 };
  if (/brick|cihl/.test(s)) return { color: 0x8a5a46 };
  if (/floor|podlah|parket|linoleum|tile/.test(s)) return { color: 0xa39582 };
  if (/concrete|beton|panel/.test(s)) return { color: 0x8f8b84 };
  if (/int_|interior|wall_int|omitka_in/.test(s)) return { color: 0xc4bcae };
  if (/plaster|omitka|wall/.test(s)) return { color: 0xb3a994 };
  return { color: 0xaaa290 };
}

const matCache = new Map<string, THREE.Material>();
function materialFor(look: Look) {
  const k = `${look.color}|${look.glass ? 1 : 0}|${look.roughness ?? 0.9}`;
  let m = matCache.get(k);
  if (!m) {
    m = look.glass
      ? new THREE.MeshStandardMaterial({ color: look.color, transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: look.color, roughness: look.roughness ?? 0.9, side: THREE.DoubleSide });
    matCache.set(k, m);
  }
  return m;
}

/** Triangles of the given faces, grouped by look, as one geometry with groups. */
function meshOf(lod: OdolLod, faceIds: number[], ground: number, origin = new THREE.Vector3()): THREE.Mesh | null {
  const sectionOf = new Int32Array(lod.faces.length).fill(-1);
  lod.sections.forEach((s, i) => {
    for (let f = s.from; f < s.to && f < lod.faces.length; f++) sectionOf[f] = i;
  });
  const byLook = new Map<string, { look: Look; tris: number[] }>();
  for (const f of faceIds) {
    const sec = lod.sections[sectionOf[f]];
    if (sec && !sec.texture && !sec.material) continue; // proxy markers and hidden faces
    const look = sec ? lookFor(sec.texture, sec.material) : { color: 0xaaa290 };
    const k = `${look.color}|${look.glass ? 1 : 0}|${look.roughness ?? 0.9}`;
    let g = byLook.get(k);
    if (!g) byLook.set(k, (g = { look, tris: [] }));
    const v = lod.faces[f];
    // faces are clockwise in the model's left-handed space; mirroring z keeps
    // them counter-clockwise from the front in three.js
    g.tris.push(v[0], v[1], v[2]);
    if (v.length === 4) g.tris.push(v[0], v[2], v[3]);
  }
  if (!byLook.size) return null;
  const used = new Map<number, number>();
  const pos: number[] = [];
  const index: number[] = [];
  const groups: { start: number; count: number; mat: THREE.Material }[] = [];
  for (const { look, tris } of byLook.values()) {
    const start = index.length;
    for (const vi of tris) {
      let k = used.get(vi);
      if (k === undefined) {
        const p = P(lod.points, vi, ground).sub(origin);
        k = pos.length / 3;
        pos.push(p.x, p.y, p.z);
        used.set(vi, k);
      }
      index.push(k);
    }
    groups.push({ start, count: index.length - start, mat: materialFor(look) });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mats: THREE.Material[] = [];
  for (const g of groups) {
    geo.addGroup(g.start, g.count, mats.length);
    mats.push(g.mat);
  }
  const mesh = new THREE.Mesh(geo, mats);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildHouse(model: OdolModel): THREE.Group {
  const visIdx = model.resolutions.findIndex((r, i) => r < 1000 && model.lods[i]);
  if (visIdx < 0) throw new Error('Modell hat keine sichtbare Detailstufe');
  const vis = model.lods[visIdx]!;
  const memory = model.lods.find((l, i) => l && lodKind(model.resolutions[i]) === 'memory') ?? null;
  const roadway = model.lods.find((l, i) => l && lodKind(model.resolutions[i]) === 'roadway') ?? null;

  // ground: the lowest walkable surface when there is one, else the model's bottom
  const minY = (l: OdolLod) => {
    let m = Infinity;
    for (let i = 1; i < l.points.length; i += 3) m = Math.min(m, l.points[i]);
    return m;
  };
  const ground = roadway && roadway.points.length ? minY(roadway) : minY(vis);

  const root = new THREE.Group();
  root.userData.house = true;

  // doors: faces of the visual "doorsN" selections, turned about the memory
  // LOD's "doorsN_axis" points
  const doorFaces = new Set<number>();
  if (memory) {
    for (const sel of vis.selections) {
      if (!/^doors?(twin)?\d+$/i.test(sel.name) || !sel.faces.length) continue;
      const ax = memory.selections.find((s) => s.name.toLowerCase() === sel.name.toLowerCase() + '_axis');
      if (!ax || ax.vertices.length < 2) continue;
      const a = P(memory.points, ax.vertices[0], ground);
      const b = P(memory.points, ax.vertices[1], ground);
      const mesh = meshOf(vis, sel.faces, ground, a);
      if (!mesh) continue;
      for (const f of sel.faces) doorFaces.add(f);
      const pivot = new THREE.Group();
      pivot.position.copy(a);
      const axis = b.clone().sub(a).normalize();
      pivot.userData.door = { t: 0, target: 0, mode: 'axis', axis: [axis.x, axis.y, axis.z], baseY: 0, h: 0 };
      pivot.userData.houseDoor = true;
      pivot.add(mesh);
      root.add(pivot);
    }
  }
  const rest: number[] = [];
  for (let f = 0; f < vis.faces.length; f++) if (!doorFaces.has(f)) rest.push(f);
  const body = meshOf(vis, rest, ground);
  if (body) root.add(body);

  // the roadway LOD is the walkable surface (stairs as ramps): invisible, for walk mode
  if (roadway && roadway.faces.length) {
    const rw = meshOf(roadway, roadway.faces.map((_, i) => i), ground);
    if (rw) {
      rw.material = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
      rw.castShadow = rw.receiveShadow = false;
      rw.userData.walkOnly = true;
      root.add(rw);
    }
  }
  const box = new THREE.Box3().setFromObject(root);
  root.userData.size = box.getSize(new THREE.Vector3()).toArray();
  root.userData.center = box.getCenter(new THREE.Vector3()).toArray();
  return root;
}

/** Wire-box stand-in while a site's model is not available. */
export function placeholder(ref: SiteRef): THREE.Group {
  const g = new THREE.Group();
  const [w, h, d] = ref.size;
  const geo = new THREE.BoxGeometry(Math.max(w, 0.5), Math.max(h, 0.5), Math.max(d, 0.5));
  const box = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xe9a84a, transparent: true, opacity: 0.08, depthWrite: false }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xe9a84a }));
  box.position.fromArray(ref.center);
  edges.position.fromArray(ref.center);
  box.userData.noCollide = true;
  g.add(box, edges);
  g.userData.placeholder = true;
  return g;
}

export function instance(template: THREE.Group): THREE.Group {
  const g = template.clone(true);
  g.traverse((o) => {
    if (o.userData.door) o.userData.door = { ...o.userData.door, t: 0, target: 0 };
  });
  return g;
}

export function placeSite(obj: THREE.Object3D, ref: SiteRef) {
  obj.position.set(ref.x, ref.y, ref.z);
  obj.rotation.y = -THREE.MathUtils.degToRad(ref.r);
}

export function sanitizeSites(raw: unknown): SiteRef[] {
  if (!Array.isArray(raw)) return [];
  const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
  const v3 = (v: unknown): [number, number, number] => (Array.isArray(v) && v.length === 3 ? [n(v[0]), n(v[1]), n(v[2])] : [8, 6, 8]);
  return raw
    .filter((s) => s && typeof s === 'object' && typeof s.pbo === 'string' && typeof s.path === 'string' && /\.p3d$/i.test(s.path))
    .slice(0, 50)
    .map((s) => ({
      id: typeof s.id === 'string' ? s.id.slice(0, 16) : Math.random().toString(36).slice(2, 10),
      pbo: String(s.pbo).slice(0, 120),
      path: String(s.path).slice(0, 260),
      name: String(s.name ?? modelName(s.path)).slice(0, 80),
      x: n(s.x),
      y: n(s.y),
      z: n(s.z),
      r: n(s.r),
      size: v3(s.size),
      center: v3(s.center),
    }));
}

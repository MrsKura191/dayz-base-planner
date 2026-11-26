/**
 * Buildings from the player's own DayZ files, shown in the planner to build
 * in and around. The model is read locally (see odol.ts); only its name and
 * placement are stored in the plan, and the model bytes are cached in this
 * browser's IndexedDB so a reload does not need the file again.
 */
import * as THREE from 'three';
import { lodKind, readOdol, readPboFile, readPboIndex, type OdolLod, type OdolModel, type OdolSection, type PboEntry, type PboIndex } from './odol';
import { paaInfo, readPaa } from './paa';

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
interface Lib {
  file: File;
  index: PboIndex;
  /** path prefix of the archive, lower case, no slashes at the ends */
  prefix: string;
  byName: Map<string, PboEntry>;
}
/** PBO files the player picked in this session, by lower-case file name. */
const pbos = new Map<string, Lib>();

const norm = (p: string) => p.trim().replace(/\//g, '\\').replace(/^\\+/, '').toLowerCase();

export async function openPbo(file: File) {
  const index = await readPboIndex(file);
  const byName = new Map(index.entries.map((e) => [e.name.toLowerCase(), e]));
  pbos.set(file.name.toLowerCase(), { file, index, prefix: norm(index.prefix).replace(/\\+$/, ''), byName });
  return index;
}

/** Open every .pbo among the files (e.g. a picked Addons folder). */
export async function openPbos(files: File[], onProgress?: (done: number, total: number) => void) {
  const list = files.filter((f) => /\.pbo$/i.test(f.name));
  let done = 0;
  let failed = 0;
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const f = list[next++];
      try {
        await openPbo(f);
      } catch {
        failed++;
      }
      onProgress?.(++done, list.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  retryTextures();
  return { opened: list.length - failed, failed };
}

export function openedPbos() {
  return [...pbos.entries()].map(([key, l]) => ({ key, name: l.file.name, index: l.index }));
}

export function pboModels(index: PboIndex) {
  return index.entries
    .filter((e) => /\.p3d$/i.test(e.name) && !/(^|\\)proxy(\\|$)|\\proxies?\\/i.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The archive and entry holding a game path like dz\structures\data\roof\x.paa. */
function resolvePath(path: string): { lib: Lib; entry: PboEntry } | null {
  const p = norm(path);
  let best: { lib: Lib; entry: PboEntry } | null = null;
  let bestLen = -1;
  for (const lib of pbos.values()) {
    if (!lib.prefix || !p.startsWith(lib.prefix + '\\') || lib.prefix.length <= bestLen) continue;
    const entry = lib.byName.get(p.slice(lib.prefix.length + 1));
    if (entry) {
      best = { lib, entry };
      bestLen = lib.prefix.length;
    }
  }
  return best;
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
    const e = src.byName.get(path.toLowerCase().replace(/\//g, '\\'));
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
  /** colour texture of the face */
  map?: string;
  /** texture with cut-out alpha (fences, leaves, frames) */
  cutout?: boolean;
  /** multi-material: four layer textures and the mask; drawn in their mixed average colour for now */
  multi?: string[];
}

const lookKey = (l: Look) => [l.color, l.glass ? 1 : 0, l.roughness ?? 0.9, l.map ?? '', l.cutout ? 1 : 0, (l.multi ?? []).join(';')].join('|');

function colourGuess(s: string): Look {
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

function lookFor(sec: OdolSection): Look {
  const { texture, material } = sec;
  const s = (texture + ' ' + material).toLowerCase();
  const glass = /glass|okno|window_glass|sklo/.test(s);
  const guess = colourGuess(s);
  if (/\.(paa|tga|png)$/i.test(texture)) {
    return { color: glass ? 0x9fb8c4 : guess.color, glass, map: texture, cutout: !glass && /_ca\.paa$/i.test(texture), roughness: glass ? 0.1 : guess.roughness };
  }
  const proc = /color\(([\d.]+),([\d.]+),([\d.]+)/.exec(texture);
  if (proc) return { color: new THREE.Color(+proc[1], +proc[2], +proc[3]).getHex(), glass };
  if (glass) return { color: 0x9fb8c4, glass: true };
  // multi-materials: stages 1-4 are the layers, stage 5 the mask
  const st = sec.stages;
  if (st.length >= 5 && /_mask\.paa$/i.test(st[4]) && st.slice(0, 4).every((x) => /\.paa$/i.test(x) || /color\(/.test(x))) {
    return { ...guess, multi: st.slice(0, 5) };
  }
  return guess;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function materialFor(look: Look) {
  const k = lookKey(look);
  let m = matCache.get(k);
  if (!m) {
    m = look.glass
      ? new THREE.MeshStandardMaterial({ color: look.color, transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: look.color, roughness: look.roughness ?? 0.9, side: THREE.DoubleSide });
    m.userData.look = look;
    matCache.set(k, m);
    void texturize(m);
  }
  return m;
}

// ------------------------------------------------------------ textures
/** paths whose texture was not found in any opened PBO */
export const missingTextures = new Set<string>();
const texBytesJobs = new Map<string, Promise<Uint8Array | null>>();

async function textureBytes(path: string): Promise<Uint8Array | null> {
  const key = 'tex|' + norm(path);
  const have = texBytesJobs.get(key);
  if (have) return have;
  const job = (async () => {
    const cached = await cacheGet(key);
    if (cached) return cached;
    const hit = resolvePath(path);
    if (!hit) return null;
    const b = await readPboFile(hit.lib.file, hit.entry);
    void cachePut(key, b);
    return b;
  })();
  texBytesJobs.set(key, job);
  const b = await job.catch(() => null);
  if (!b) {
    texBytesJobs.delete(key); // try again once more PBOs are open
    missingTextures.add(norm(path));
  } else missingTextures.delete(norm(path));
  return b;
}

const texJobs = new Map<string, Promise<THREE.Texture | null>>();
const tick = () => new Promise((r) => setTimeout(r, 0));

function loadTexture(path: string): Promise<THREE.Texture | null> {
  const key = norm(path);
  const have = texJobs.get(key);
  if (have) return have;
  const job = (async () => {
    const b = await textureBytes(path);
    if (!b) return null;
    await tick(); // decode one texture at a time without freezing the page
    const img = readPaa(b, 1024);
    const tex = new THREE.DataTexture(img.rgba, img.width, img.height, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  })();
  texJobs.set(key, job);
  job.then((t) => {
    if (!t) texJobs.delete(key);
  }, () => texJobs.delete(key));
  return job.catch(() => null);
}

async function averageOf(path: string): Promise<THREE.Color | null> {
  const proc = /color\(([\d.]+),([\d.]+),([\d.]+)/.exec(path);
  if (proc) return new THREE.Color(+proc[1], +proc[2], +proc[3]);
  const b = await textureBytes(path);
  const avg = b ? paaInfo(b).avg : null;
  return avg ? new THREE.Color().setRGB(avg[0], avg[1], avg[2], THREE.SRGBColorSpace) : null;
}

async function texturize(m: THREE.MeshStandardMaterial) {
  const look = m.userData.look as Look;
  if (m.userData.textured) return;
  if (look.map) {
    const tex = await loadTexture(look.map);
    if (!tex) return;
    m.map = tex;
    m.color.set(0xffffff);
    if (look.glass) m.opacity = /_ca\.paa$/i.test(look.map) ? 1 : 0.45;
    if (look.cutout) {
      m.alphaTest = 0.5;
      m.transparent = false;
    }
    m.userData.textured = true;
    m.needsUpdate = true;
  } else if (look.multi) {
    // mixed walls: the layers' average colours, weighted by how much of the mask each covers
    const [layers, mask] = [look.multi.slice(0, 4), look.multi[4]];
    const cols = await Promise.all(layers.map(averageOf));
    const mk = await averageOf(mask);
    if (!mk || cols.some((c) => !c)) return;
    const w = [Math.max(0, 1 - mk.r - mk.g - mk.b), mk.r, mk.g, mk.b];
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    const c = new THREE.Color(0, 0, 0);
    cols.forEach((col, i) => c.add(col!.clone().multiplyScalar(w[i] / sum)));
    m.color.copy(c);
    m.userData.textured = true;
    m.needsUpdate = true;
  }
}

/** After more PBOs were opened: fill in textures that were missing. */
export function retryTextures() {
  for (const m of matCache.values()) if (!m.userData.textured) void texturize(m);
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
    const look: Look = sec ? lookFor(sec) : { color: 0xaaa290 };
    const k = lookKey(look);
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
  const uv: number[] = [];
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
        if (lod.uv) uv.push(lod.uv[vi * 2], lod.uv[vi * 2 + 1]);
        used.set(vi, k);
      }
      index.push(k);
    }
    groups.push({ start, count: index.length - start, mat: materialFor(look) });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
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

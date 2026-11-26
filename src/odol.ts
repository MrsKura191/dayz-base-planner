/**
 * Reader for binarized DayZ models (ODOL) and PBO archives, run locally on the
 * player's own game files. Nothing read here is uploaded or stored remotely.
 *
 * Layout follows the MIT-licensed reference reader in rvost/bis-file-formats
 * (BIS.P3D/ODOL), checked against DayZ's ODOL v56 files.
 */

// ------------------------------------------------------------------ LZO1X
/** Decompress one LZO1X stream starting at `start`; returns the data and where the stream ended. */
export function lzo1x(src: Uint8Array, start: number, outLen: number): { out: Uint8Array; end: number } {
  const dst = new Uint8Array(outLen);
  let ip = start;
  let op = 0;
  const lit = (n: number) => {
    if (op + n > outLen) throw new Error('LZO: output overrun');
    dst.set(src.subarray(ip, ip + n), op);
    ip += n;
    op += n;
  };
  const match = (dist: number, n: number) => {
    let from = op - dist;
    if (from < 0 || op + n > outLen) throw new Error('LZO: bad match');
    while (n-- > 0) dst[op++] = dst[from++];
  };
  let t = src[ip++];
  let state = 0;
  if (t > 17) {
    t -= 17;
    lit(t);
    state = t >= 4 ? 4 : t;
    t = src[ip++];
  }
  for (;;) {
    let n: number;
    if (t < 16) {
      if (state === 0) {
        if (t === 0) {
          let k = 0;
          while (src[ip] === 0) {
            k += 255;
            ip++;
          }
          t = k + 15 + src[ip++];
        }
        lit(t + 3);
        state = 4;
        t = src[ip++];
        continue;
      } else if (state < 4) {
        match(1 + (t >> 2) + (src[ip++] << 2), 2);
      } else {
        match(2049 + (t >> 2) + (src[ip++] << 2), 3);
      }
      n = t & 3;
    } else if (t >= 64) {
      match(1 + ((t >> 2) & 7) + (src[ip++] << 3), (t >> 5) + 1);
      n = t & 3;
    } else if (t >= 32) {
      let ln = t & 31;
      if (ln === 0) {
        while (src[ip] === 0) {
          ln += 255;
          ip++;
        }
        ln += 31 + src[ip++];
      }
      const b0 = src[ip++];
      const b1 = src[ip++];
      match(1 + ((b0 | (b1 << 8)) >> 2), ln + 2);
      n = b0 & 3;
    } else {
      let ln = t & 7;
      if (ln === 0) {
        while (src[ip] === 0) {
          ln += 255;
          ip++;
        }
        ln += 7 + src[ip++];
      }
      const b0 = src[ip++];
      const b1 = src[ip++];
      let dist = ((t & 8) << 11) + ((b0 | (b1 << 8)) >> 2);
      if (dist === 0) break; // end of stream
      dist += 16384;
      match(dist, ln + 2);
      n = b0 & 3;
    }
    state = n;
    if (n) lit(n);
    t = src[ip++];
  }
  if (op !== outLen) throw new Error('LZO: short output');
  return { out: dst, end: ip };
}

// ------------------------------------------------------------------ reader
class R {
  dv: DataView;
  p = 0;
  b: Uint8Array;
  version: number;
  constructor(b: Uint8Array, version = 0) {
    this.b = b;
    this.version = version;
    this.dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  }
  u8() {
    return this.b[this.p++];
  }
  bool() {
    return this.b[this.p++] !== 0;
  }
  u16() {
    const v = this.dv.getUint16(this.p, true);
    this.p += 2;
    return v;
  }
  i16() {
    const v = this.dv.getInt16(this.p, true);
    this.p += 2;
    return v;
  }
  i32() {
    const v = this.dv.getInt32(this.p, true);
    this.p += 4;
    return v;
  }
  u32() {
    const v = this.dv.getUint32(this.p, true);
    this.p += 4;
    return v;
  }
  f32() {
    const v = this.dv.getFloat32(this.p, true);
    this.p += 4;
    return v;
  }
  skip(n: number) {
    if (n < 0 || this.p + n > this.b.length) throw new Error('ODOL: read past end');
    this.p += n;
  }
  asciiz() {
    let e = this.p;
    while (e < this.b.length && this.b[e] !== 0) e++;
    let s = '';
    for (let i = this.p; i < e; i++) s += String.fromCharCode(this.b[i]);
    this.p = e + 1;
    return s;
  }
  count(max = 5_000_000) {
    const n = this.i32();
    if (n < 0 || n > max) throw new Error('ODOL: bad count ' + n);
    return n;
  }
  /** a block that is LZO-compressed when 1024 bytes or more (flag byte from v64) */
  data(size: number): Uint8Array {
    let packed = size >= 1024;
    if (this.version >= 64) packed = this.bool();
    if (!packed) {
      const out = this.b.subarray(this.p, this.p + size);
      this.skip(size);
      return out;
    }
    const { out, end } = lzo1x(this.b, this.p, size);
    this.p = end;
    return out;
  }
  compressedArray(elem: number): { n: number; data: Uint8Array } {
    const n = this.count();
    return { n, data: this.data(n * elem) };
  }
  /** count, default-fill flag, then either one element or a compressed block */
  condensedArray(elem: number): { n: number; data: Uint8Array | null; fill: Uint8Array | null } {
    const n = this.count();
    if (this.bool()) {
      const fill = this.b.subarray(this.p, this.p + elem);
      this.skip(elem);
      return { n, data: null, fill };
    }
    return { n, data: this.data(n * elem), fill: null };
  }
}

// ------------------------------------------------------------------ model
export interface OdolMaterial {
  name: string;
  /** stage textures in order (stage 1 first) */
  textures: string[];
  /** texture generator used by each stage */
  texGens: number[];
  /** per texture generator: UV source and 4x3 matrix */
  uvTransforms: { source: number; m: number[] }[];
}

export interface OdolSection {
  /** first and last face (indices into faces) */
  from: number;
  to: number;
  texture: string;
  material: string;
  /** stage textures of the section's material (empty when it has none) */
  stages: string[];
  /** the material itself (null when the section names it only) */
  mat: OdolMaterial | null;
}

export interface OdolLod {
  resolution: number;
  /** x, y, z per vertex, in model space (left-handed, y up) */
  points: Float32Array;
  /** u, v per vertex (first UV set) */
  uv: Float32Array | null;
  /** all UV sets (index 0 is `uv`); null where a set is one constant value */
  uvSets: (Float32Array | null)[];
  faces: Uint32Array[];
  sections: OdolSection[];
  selections: { name: string; faces: number[]; vertices: number[] }[];
  properties: [string, string][];
  textures: string[];
}

export interface OdolModel {
  version: number;
  resolutions: number[];
  lods: (OdolLod | null)[];
  bboxMin: [number, number, number];
  bboxMax: [number, number, number];
}

const vec = (r: R): [number, number, number] => [r.f32(), r.f32(), r.f32()];

function readIndexArray(r: R): number[] {
  const wide = r.version >= 69;
  const { n, data } = r.compressedArray(wide ? 4 : 2);
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = wide ? dv.getInt32(i * 4, true) : dv.getUint16(i * 2, true);
  return out;
}

function readMaterial(r: R): OdolMaterial {
  const name = r.asciiz();
  const v = r.u32();
  if (v >= 20) {
    // DayZ materials: a longer fixed block of colours and shader settings,
    // then the surface file name
    r.skip(220);
    r.asciiz();
    r.skip(8); // render flags
  } else {
    r.skip(6 * 16 + 4 + 16); // colours, specular power, shaders, light, fog
    if (v === 3) r.skip(1);
    if (v >= 6) r.asciiz();
    if (v >= 4) r.skip(8);
  }
  const stages = v > 6 ? r.count(64) : 0;
  const gens = v > 8 ? r.count(64) : stages;
  const textures: string[] = [];
  const texGens: number[] = [];
  const uvTransforms: { source: number; m: number[] }[] = [];
  const stage = () => {
    if (v >= 5) r.skip(4);
    textures.push(r.asciiz());
    texGens.push(v >= 8 ? r.u32() : textures.length - 1);
    if (v >= 11) r.skip(1);
  };
  const transform = () => {
    const source = r.u32();
    const m: number[] = [];
    for (let i = 0; i < 12; i++) m.push(r.f32());
    uvTransforms.push({ source, m });
  };
  if (v < 8) {
    for (let i = 0; i < stages; i++) {
      transform();
      stage();
    }
  } else {
    for (let i = 0; i < stages; i++) stage();
    for (let i = 0; i < gens; i++) transform();
  }
  if (v >= 10) {
    stage();
    textures.pop(); // the TI stage, not a colour texture
    texGens.pop();
  }
  return { name, textures, texGens, uvTransforms };
}

function readLod(r: R, resolution: number): OdolLod {
  const v = r.version;
  const proxies = r.count(100_000);
  for (let i = 0; i < proxies; i++) {
    r.asciiz();
    r.skip(48 + 12);
    if (v >= 40) r.skip(4);
  }
  r.skip(4 * r.count()); // sub-skeleton to skeleton
  const sets = r.count();
  for (let i = 0; i < sets; i++) r.skip(4 * r.count());
  let vertexCount = -1;
  if (v >= 50) vertexCount = r.u32();
  else r.condensedArray(4);
  if (v >= 51) r.f32();
  r.skip(8 + 12 * 3 + 4); // hints, bounding box, centre, radius
  const nTex = r.count(100_000);
  const textures: string[] = [];
  for (let i = 0; i < nTex; i++) textures.push(r.asciiz());
  const nMat = r.count(100_000);
  const materials: OdolMaterial[] = [];
  for (let i = 0; i < nMat; i++) materials.push(readMaterial(r));
  readIndexArray(r); // point to vertex
  readIndexArray(r); // vertex to point

  const nFaces = r.count();
  r.skip(4 + 2);
  const wide = v >= 69;
  const faces: Uint32Array[] = new Array(nFaces);
  const faceOffset: number[] = new Array(nFaces);
  let off = 0;
  for (let i = 0; i < nFaces; i++) {
    const n = r.u8();
    if (n < 3 || n > 4) throw new Error('ODOL: bad polygon');
    const f = new Uint32Array(n);
    for (let k = 0; k < n; k++) f[k] = wide ? r.u32() : r.u16();
    faces[i] = f;
    faceOffset[i] = off;
    off += wide ? 16 : 8;
    if (n === 4) off += wide ? 4 : 2;
  }
  const firstFaceAt = (o: number) => {
    let lo = 0;
    let hi = nFaces;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (faceOffset[m] < o) lo = m + 1;
      else hi = m;
    }
    return lo;
  };

  const nSec = r.count(100_000);
  const sections: OdolSection[] = [];
  for (let i = 0; i < nSec; i++) {
    const lo = r.i32();
    const hi = r.i32();
    r.skip(12);
    const tex = r.i16();
    r.skip(4);
    const mat = r.i32();
    let matName = mat >= 0 ? (materials[mat]?.name ?? '') : '';
    if (mat === -1) matName = r.asciiz();
    if (v >= 36) {
      r.skip(4 * r.count(1000));
      if (v >= 67 && r.i32() >= 1) r.skip(44);
    } else r.skip(4);
    sections.push({ from: firstFaceAt(lo), to: firstFaceAt(hi), texture: tex >= 0 ? (textures[tex] ?? '') : '', material: matName, stages: mat >= 0 ? (materials[mat]?.textures ?? []) : [], mat: mat >= 0 ? (materials[mat] ?? null) : null });
  }

  const nSel = r.count(100_000);
  const selections: OdolLod['selections'] = [];
  for (let i = 0; i < nSel; i++) {
    const name = r.asciiz();
    const sf = readIndexArray(r);
    r.skip(4 + 1);
    r.compressedArray(4); // sections
    const sv = readIndexArray(r);
    const expected = r.i32();
    r.data(expected); // vertex weights
    selections.push({ name, faces: sf, vertices: sv });
  }
  const nProp = r.count(100_000);
  const properties: [string, string][] = [];
  for (let i = 0; i < nProp; i++) properties.push([r.asciiz(), r.asciiz()]);
  const nFrames = r.count(100_000);
  for (let i = 0; i < nFrames; i++) {
    r.f32();
    r.skip(12 * r.count());
  }
  r.skip(12 + 1); // colours, special, simple bone refs
  r.u32(); // size of the remaining data
  if (v >= 50) r.condensedArray(4); // clip flags

  const uvSet = () => {
    let mm: number[] | null = null;
    if (v >= 45) mm = [r.f32(), r.f32(), r.f32(), r.f32()];
    const n = r.u32();
    const elem = v >= 45 ? 4 : 8;
    if (r.bool()) {
      r.skip(elem);
      return null;
    }
    const d = r.data(n * elem);
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    const uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      if (mm) {
        const su = dv.getInt16(i * 4, true);
        const sv = dv.getInt16(i * 4 + 2, true);
        uv[i * 2] = mm[0] + ((su + 32767) / 65534) * (mm[2] - mm[0]);
        uv[i * 2 + 1] = mm[1] + ((sv + 32767) / 65534) * (mm[3] - mm[1]);
      } else {
        uv[i * 2] = dv.getFloat32(i * 8, true);
        uv[i * 2 + 1] = dv.getFloat32(i * 8 + 4, true);
      }
    }
    return uv;
  };
  const uv = uvSet();
  const sets2 = r.u32();
  const uvSets: (Float32Array | null)[] = [uv];
  for (let i = 1; i < sets2; i++) uvSets.push(uvSet());
  const pts = r.compressedArray(12);
  if (vertexCount >= 0 && pts.n !== vertexCount) throw new Error('ODOL: vertex count mismatch');
  const points = new Float32Array(pts.n * 3);
  const pdv = new DataView(pts.data.buffer, pts.data.byteOffset, pts.data.byteLength);
  for (let i = 0; i < pts.n * 3; i++) points[i] = pdv.getFloat32(i * 4, true);
  for (const f of faces) for (const k of f) if (k >= pts.n) throw new Error('ODOL: face index out of range');
  return { resolution, points, uv: uv && uv.length === pts.n * 2 ? uv : null, uvSets: uvSets.map((u) => (u && u.length === pts.n * 2 ? u : null)), faces, sections, selections, properties, textures };
}

/**
 * Find the LOD address tables: n start offsets, n end offsets, n permanent
 * flags. Rather than walk the skeleton and animation blocks before them, look
 * for the two increasing tables and check that a LOD parses at the first start.
 */
function* findAddresses(b: Uint8Array, from: number, n: number) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const size = b.length;
  const limit = Math.min(size - 8 * n, from + 4_000_000);
  outer: for (let o = from; o < limit; o++) {
    const s0 = dv.getUint32(o, true);
    if (s0 <= o || s0 >= size) continue;
    const e0 = dv.getUint32(o + 4 * n, true);
    if (e0 <= s0 || e0 > size) continue;
    const starts: number[] = [];
    const ends: number[] = [];
    for (let i = 0; i < n; i++) {
      const s = dv.getUint32(o + 4 * i, true);
      const e = dv.getUint32(o + 4 * (n + i), true);
      if (s <= o || e <= s || e > size) continue outer;
      starts.push(s);
      ends.push(e);
    }
    // the LODs must not overlap
    const order = starts.map((_, i) => i).sort((a, c) => starts[a] - starts[c]);
    for (let k = 1; k < n; k++) if (starts[order[k]] < ends[order[k - 1]]) continue outer;
    if (starts[order[0]] < o + 9 * n) continue;
    yield { at: o, starts, ends };
  }
}

/** Visual LODs have resolutions below 1000; special LODs use large codes. */
export const LOD_GEOMETRY = 1e13;
export const LOD_MEMORY = 1e15;
export const LOD_ROADWAY = 3e15;
export const LOD_VIEW_GEOMETRY = 6e15;

export function lodKind(res: number) {
  if (res < 1000) return 'visual';
  const near = (c: number) => Math.abs(res - c) / c < 1e-3;
  if (near(LOD_GEOMETRY)) return 'geometry';
  if (near(LOD_MEMORY)) return 'memory';
  if (near(LOD_ROADWAY)) return 'roadway';
  if (near(LOD_VIEW_GEOMETRY)) return 'viewgeo';
  return 'other';
}

/** Read an ODOL model; `want` picks which LODs to decode (others stay null). */
export function readOdol(bytes: Uint8Array, want: (res: number) => boolean = () => true): OdolModel {
  const head = String.fromCharCode(...bytes.subarray(0, 4));
  if (head === 'MLOD') throw new Error('Unbinarisiertes Modell (MLOD) – wird nicht unterstützt');
  if (head !== 'ODOL') throw new Error('Kein DayZ-Modell (ODOL)');
  const r = new R(bytes);
  r.p = 4;
  const version = r.i32();
  r.version = version;
  if (version < 44 || version > 80) throw new Error('ODOL-Version ' + version + ' wird nicht unterstützt');
  if (version >= 75 && (r.u32() !== 0 || r.u32() !== 0)) throw new Error('Das Modell ist verschlüsselt');
  if (version >= 59) r.u32();
  if (version >= 58) r.asciiz();
  const n = r.count(64);
  const resolutions: number[] = [];
  for (let i = 0; i < n; i++) resolutions.push(r.f32());
  // model info starts here: bounding box at a fixed offset
  const mi = r.p;
  r.p = mi + 4 + 4 + 4 + 12 + 12 + 8 + 4;
  const bboxMin = vec(r);
  const bboxMax = vec(r);
  let lastErr: unknown = null;
  for (const tables of findAddresses(bytes, mi, n)) {
    try {
      const lods: (OdolLod | null)[] = resolutions.map(() => null);
      for (let i = 0; i < n; i++) {
        if (!want(resolutions[i])) continue;
        const lr = new R(bytes, version);
        lr.p = tables.starts[i];
        lods[i] = readLod(lr, resolutions[i]);
      }
      return { version, resolutions, lods, bboxMin, bboxMax };
    } catch (e) {
      lastErr = e; // not the real table: keep looking
    }
  }
  throw new Error('LOD-Tabelle nicht gefunden' + (lastErr ? ' (' + (lastErr as Error).message + ')' : ''));
}

// ------------------------------------------------------------------ PBO
export interface PboEntry {
  name: string;
  offset: number;
  size: number;
  packed: boolean;
}

export interface PboIndex {
  prefix: string;
  entries: PboEntry[];
}

/** Read a PBO's file table from its first bytes (the header is at the start). */
export async function readPboIndex(file: Blob): Promise<PboIndex> {
  let chunk = 1 << 18;
  for (;;) {
    const head = new Uint8Array(await file.slice(0, Math.min(chunk, file.size)).arrayBuffer());
    const res = parsePboHeader(head, chunk >= file.size);
    if (res) return res;
    if (chunk >= file.size) throw new Error('PBO-Kopf unvollständig');
    chunk *= 4;
  }
}

function parsePboHeader(b: Uint8Array, complete: boolean): PboIndex | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 0;
  const str = () => {
    let e = p;
    while (e < b.length && b[e] !== 0) e++;
    if (e >= b.length) return null;
    let s = '';
    for (let i = p; i < e; i++) s += String.fromCharCode(b[i]);
    p = e + 1;
    return s;
  };
  const props: string[] = [];
  const raw: { name: string; method: number; size: number }[] = [];
  let first = true;
  for (;;) {
    const name = str();
    if (name === null || p + 20 > b.length) {
      if (complete) throw new Error('Keine gültige PBO-Datei');
      return null;
    }
    const method = dv.getUint32(p, true);
    const size = dv.getUint32(p + 16, true);
    p += 20;
    if (first && name === '' && method === 0x56657273) {
      for (;;) {
        const s = str();
        if (s === null) {
          if (complete) throw new Error('PBO-Kopf defekt');
          return null;
        }
        if (!s) break;
        props.push(s);
      }
      first = false;
      continue;
    }
    first = false;
    if (!name) break;
    raw.push({ name, method, size });
  }
  let off = p;
  const entries: PboEntry[] = raw.map((e) => {
    const out = { name: e.name.replace(/\//g, '\\'), offset: off, size: e.size, packed: e.method === 0x43707273 };
    off += e.size;
    return out;
  });
  const pi = props.findIndex((s, i) => i % 2 === 0 && s.toLowerCase() === 'prefix');
  return { prefix: pi >= 0 ? props[pi + 1] : '', entries };
}

export async function readPboFile(file: Blob, e: PboEntry): Promise<Uint8Array> {
  if (e.packed) throw new Error('Gepackte PBO-Einträge werden nicht unterstützt');
  return new Uint8Array(await file.slice(e.offset, e.offset + e.size).arrayBuffer());
}

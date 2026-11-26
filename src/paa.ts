/**
 * Reader for DayZ textures (PAA), run locally on the player's own files.
 * Decodes the DXT1/3/5 mip closest to a size limit into RGBA.
 */
import { lzo1x } from './odol';

export interface PaaImage {
  width: number;
  height: number;
  rgba: Uint8Array;
}

export interface PaaInfo {
  type: number;
  /** average colour from the file's AVGC tag, 0..1 */
  avg: [number, number, number, number] | null;
  /** offset of the palette, where mipmaps begin after it */
  dataAt: number;
}

const DXT = { 0xff01: 1, 0xff03: 3, 0xff05: 5 } as Record<number, number>;

/** Header and tags only; works on the first few hundred bytes of a file. */
export function paaInfo(b: Uint8Array): PaaInfo {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const type = dv.getUint16(0, true);
  let p = 2;
  let avg: PaaInfo['avg'] = null;
  while (p + 12 <= b.length && String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]) === 'GGAT') {
    const name = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
    const len = dv.getUint32(p + 8, true);
    if (name === 'CGVA' && len >= 4 && p + 16 <= b.length) {
      // packed ARGB, stored B G R A
      avg = [b[p + 14] / 255, b[p + 13] / 255, b[p + 12] / 255, b[p + 15] / 255];
    }
    p += 12 + len;
  }
  return { type, avg, dataAt: p };
}

function rgb565(c: number, out: Uint8Array, o: number) {
  out[o] = ((c >> 11) & 31) * 255 / 31;
  out[o + 1] = ((c >> 5) & 63) * 255 / 63;
  out[o + 2] = (c & 31) * 255 / 31;
  out[o + 3] = 255;
}

function decodeDxt(kind: number, w: number, h: number, d: Uint8Array): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  const bw = Math.max(1, (w + 3) >> 2);
  const bh = Math.max(1, (h + 3) >> 2);
  const bs = kind === 1 ? 8 : 16;
  const pal = new Uint8Array(16);
  const alpha = new Uint8Array(16);
  const av = new Uint8Array(8);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const o = (by * bw + bx) * bs;
      let co = o;
      if (kind === 5) {
        av[0] = d[o];
        av[1] = d[o + 1];
        if (av[0] > av[1]) for (let i = 1; i < 7; i++) av[i + 1] = ((7 - i) * av[0] + i * av[1]) / 7;
        else {
          for (let i = 1; i < 5; i++) av[i + 1] = ((5 - i) * av[0] + i * av[1]) / 5;
          av[6] = 0;
          av[7] = 255;
        }
        // 48 bits of 3-bit indices
        let bits = 0;
        let nb = 0;
        let q = o + 2;
        for (let i = 0; i < 16; i++) {
          if (nb < 3) {
            bits |= d[q++] << nb;
            nb += 8;
          }
          alpha[i] = av[bits & 7];
          bits >>= 3;
          nb -= 3;
        }
        co = o + 8;
      } else if (kind === 3) {
        for (let i = 0; i < 8; i++) {
          alpha[i * 2] = (d[o + i] & 15) * 17;
          alpha[i * 2 + 1] = (d[o + i] >> 4) * 17;
        }
        co = o + 8;
      }
      const c0 = d[co] | (d[co + 1] << 8);
      const c1 = d[co + 2] | (d[co + 3] << 8);
      rgb565(c0, pal, 0);
      rgb565(c1, pal, 4);
      if (c0 > c1 || kind !== 1) {
        for (let k = 0; k < 3; k++) {
          pal[8 + k] = (2 * pal[k] + pal[4 + k]) / 3;
          pal[12 + k] = (pal[k] + 2 * pal[4 + k]) / 3;
        }
        pal[11] = pal[15] = 255;
      } else {
        for (let k = 0; k < 3; k++) pal[8 + k] = (pal[k] + pal[4 + k]) / 2;
        pal[11] = 255;
        pal[12] = pal[13] = pal[14] = pal[15] = 0;
      }
      let idx = d[co + 4] | (d[co + 5] << 8) | (d[co + 6] << 16) | (d[co + 7] << 24);
      for (let i = 0; i < 16; i++) {
        const x = bx * 4 + (i & 3);
        const y = by * 4 + (i >> 2);
        const s = (idx & 3) * 4;
        idx >>>= 2;
        if (x >= w || y >= h) continue;
        const t = (y * w + x) * 4;
        out[t] = pal[s];
        out[t + 1] = pal[s + 1];
        out[t + 2] = pal[s + 2];
        out[t + 3] = kind === 1 ? pal[s + 3] : alpha[i];
      }
    }
  }
  return out;
}

/** Decode the largest mipmap no bigger than `max` pixels on a side. */
export function readPaa(b: Uint8Array, max = 1024): PaaImage {
  const info = paaInfo(b);
  const kind = DXT[info.type];
  if (!kind) throw new Error('PAA-Format ' + info.type.toString(16) + ' nicht unterstützt');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = info.dataAt;
  const pal = dv.getUint16(p, true);
  p += 2 + pal * 3;
  let pick: { w: number; h: number; at: number; len: number; packed: boolean } | null = null;
  while (p + 7 <= b.length) {
    let w = dv.getUint16(p, true);
    const h = dv.getUint16(p + 2, true);
    if (!w || !h) break;
    const len = b[p + 4] | (b[p + 5] << 8) | (b[p + 6] << 16);
    p += 7;
    const packed = (w & 0x8000) !== 0;
    w &= 0x7fff;
    // mips come largest first: keep the first that fits
    if (!pick || (pick.w > max && w <= pick.w)) pick = { w, h, at: p, len, packed };
    if (w <= max && h <= max) break;
    p += len;
  }
  if (!pick) throw new Error('PAA ohne Bilddaten');
  const size = Math.max(1, (pick.w + 3) >> 2) * Math.max(1, (pick.h + 3) >> 2) * (kind === 1 ? 8 : 16);
  const data = pick.packed ? lzo1x(b, pick.at, size).out : b.subarray(pick.at, pick.at + size);
  return { width: pick.w, height: pick.h, rgba: decodeDxt(kind, pick.w, pick.h, data) };
}

import { PARTS } from './data';
import type { Piece } from './store';
import { sanitizeSites, type SiteRef } from './house';

export interface Design {
  id: string;
  name: string;
  updated: number;
  pieces: Omit<Piece, 'id'>[];
  /** buildings from the game files (model name and placement only) */
  sites?: SiteRef[];
}

const KEY = 'abp.designs.v1';
const CURRENT = 'abp.current.v1';
const SETTINGS = 'abp.settings.v1';

export function listDesigns(): Design[] {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Design[];
    return all.sort((a, b) => b.updated - a.updated);
  } catch {
    return [];
  }
}

function writeAll(list: Design[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function saveDesign(d: Design) {
  const all = listDesigns().filter((x) => x.id !== d.id);
  all.push(d);
  writeAll(all);
  localStorage.setItem(CURRENT, d.id);
}

export function deleteDesign(id: string) {
  writeAll(listDesigns().filter((x) => x.id !== id));
}

export function currentDesignId() {
  return localStorage.getItem(CURRENT);
}

export const newId = () => Math.random().toString(36).slice(2, 10);

export function strip(pieces: Piece[]): Omit<Piece, 'id'>[] {
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return pieces.map((p) => ({ t: p.t, x: r(p.x), y: r(p.y), z: r(p.z), r: r(p.r), l: p.l }));
}

export function sanitize(raw: unknown): Omit<Piece, 'id'>[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && typeof p === 'object' && PARTS[(p as Piece).t])
    .map((p) => {
      const q = p as Piece;
      const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
      return { t: q.t, x: n(q.x), y: n(q.y), z: n(q.z), r: n(q.r), l: Math.max(0, Math.min(7, Math.round(n(q.l)))) };
    });
}

// ----------------------------------------------------------- share links
async function deflate(text: string) {
  const s = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

async function inflate(bytes: Uint8Array) {
  const s = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(s).text();
}

const b64u = (b: Uint8Array) => {
  let s = '';
  for (const c of b) s += String.fromCharCode(c);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export async function encodeShare(name: string, pieces: Piece[], sites: SiteRef[] = []) {
  const ids = [...new Set(pieces.map((p) => p.t))];
  const r = (v: number) => Math.round(v * 100) / 100;
  const payload = { v: 1, n: name, ids, p: pieces.map((p) => [ids.indexOf(p.t), r(p.x), r(p.y), r(p.z), Math.round(p.r * 1000) / 1000, p.l]), ...(sites.length ? { s: sites } : {}) };
  return b64u(await deflate(JSON.stringify(payload)));
}

export async function decodeShare(code: string): Promise<{ name: string; pieces: Omit<Piece, 'id'>[]; sites: SiteRef[] } | null> {
  try {
    const data = JSON.parse(await inflate(unb64u(code)));
    if (data.v !== 1) return null;
    const pieces = (data.p as number[][]).map(([i, x, y, z, r, l]) => ({ t: data.ids[i], x, y, z, r, l }));
    return { name: String(data.n ?? 'Geteilter Plan').slice(0, 60), pieces: sanitize(pieces), sites: sanitizeSites(data.s) };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------- settings
export interface Settings {
  upkeepPrices: Record<string, number>;
  partLimit: number;
  rawNails: boolean;
  rawSheet: boolean;
  rawPlanks: false | 'hand' | 'saw';
}

export function loadSettings(defaults: Settings): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS) ?? '{}') };
  } catch {
    return defaults;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS, JSON.stringify(s));
}

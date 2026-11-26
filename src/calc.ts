import {
  FUEL_PER_BOTTLE, NAILS_PER_SCRAP, PLANKS_PER_LOG_HAND, PLANKS_PER_LOG_SAW, SCRAP_PER_SHEET, WORKBENCH_BATCH,
} from './constants';
import { MATERIALS, PARTS, UPKEEP_CATS, type MatId, type ToolId, type UpkeepCat } from './data';
import type { Piece } from './store';

export type MatTotals = Map<MatId, number>;

function addRecipe(partId: string, qty: number, into: MatTotals) {
  const r = PARTS[partId]?.recipe;
  if (!r) return;
  for (const [k, n] of Object.entries(r)) {
    if (PARTS[k]) addRecipe(k, n * qty, into);
    else into.set(k as MatId, (into.get(k as MatId) ?? 0) + n * qty);
  }
}

export function countByType(pieces: Piece[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of pieces) m.set(p.t, (m.get(p.t) ?? 0) + 1);
  return m;
}

export function materialsFor(pieces: Piece[]): MatTotals {
  const out: MatTotals = new Map();
  for (const [t, n] of countByType(pieces)) addRecipe(t, n, out);
  return sortMats(out);
}

export function sortMats(m: MatTotals): MatTotals {
  return new Map([...m.entries()].sort((a, b) => b[1] - a[1]));
}

export interface RawOptions {
  nailsFromScrap: boolean;
  sheetFromScrap: boolean;
  planksFromLogs: false | 'hand' | 'saw';
}

/** Resolve nails, sheet metal and planks down to scrap and logs, as the wiki's conversions allow. */
export function toRaw(m: MatTotals, o: RawOptions): MatTotals {
  const out: MatTotals = new Map(m);
  const take = (k: MatId) => {
    const v = out.get(k) ?? 0;
    out.delete(k);
    return v;
  };
  const add = (k: MatId, v: number) => v && out.set(k, (out.get(k) ?? 0) + v);
  if (o.nailsFromScrap) add('scrap', Math.ceil(take('nails') / NAILS_PER_SCRAP));
  if (o.sheetFromScrap) add('scrap', take('sheet') * SCRAP_PER_SHEET);
  if (o.planksFromLogs) add('logs', Math.ceil(take('planks') / (o.planksFromLogs === 'saw' ? PLANKS_PER_LOG_SAW : PLANKS_PER_LOG_HAND)));
  return sortMats(out);
}

export function toolsFor(pieces: Piece[]): Map<ToolId, string[]> {
  const out = new Map<ToolId, string[]>();
  const visit = (id: string) => {
    const d = PARTS[id];
    for (const t of d.tools) {
      const l = out.get(t) ?? [];
      if (!l.includes(d.name)) l.push(d.name);
      out.set(t, l);
    }
    for (const k of Object.keys(d.recipe ?? {})) if (PARTS[k]) visit(k);
  };
  for (const t of countByType(pieces).keys()) visit(t);
  return out;
}

export function craftClicks(pieces: Piece[]): number {
  let n = 0;
  for (const [t, c] of countByType(pieces)) {
    const d = PARTS[t];
    if (!d.recipe || d.handCraft) continue;
    n += Math.ceil(c / WORKBENCH_BATCH);
    for (const k of Object.keys(d.recipe)) if (PARTS[k]) n += Math.ceil(c / WORKBENCH_BATCH);
  }
  return n;
}

export function unknownCostParts(pieces: Piece[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const [t, n] of countByType(pieces)) if (!PARTS[t].recipe) out.set(t, n);
  return out;
}

export function matName(id: MatId) {
  return MATERIALS[id]?.name ?? id;
}

// ------------------------------------------------------------------- upkeep
export function upkeepCounts(pieces: Piece[]): Map<UpkeepCat, number> {
  const m = new Map<UpkeepCat, number>(UPKEEP_CATS.map((c) => [c.id, 0]));
  for (const p of pieces) {
    const c = PARTS[p.t].upkeep;
    m.set(c, (m.get(c) ?? 0) + 1);
  }
  return m;
}

// --------------------------------------------------------------------- raid
export interface RaidRow {
  id: string;
  name: string;
  count: number;
  charges: number;
  fuel: number;
  assumed: boolean;
}

export function raidRows(pieces: Piece[]): RaidRow[] {
  const rows: RaidRow[] = [];
  for (const [t, n] of countByType(pieces)) {
    const d = PARTS[t];
    if (!d.raid) continue;
    rows.push({
      id: t, name: d.name, count: n, charges: d.raid.charges, fuel: d.raid.fuel,
      assumed: !!(d.raid.chargesAssumed || d.raid.fuelAssumed),
    });
  }
  return rows.sort((a, b) => a.fuel - b.fuel || a.name.localeCompare(b.name));
}

export function raidTotals(rows: RaidRow[]) {
  const charges = rows.reduce((s, r) => s + r.charges * r.count, 0);
  const fuel = rows.reduce((s, r) => s + r.fuel * r.count, 0);
  return { charges, fuel, bottles: fuel / FUEL_PER_BOTTLE, soloMinutes: (fuel / FUEL_PER_BOTTLE) * 10 };
}

export const fmt = (n: number) => n.toLocaleString('de-DE');

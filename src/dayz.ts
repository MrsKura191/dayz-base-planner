// Export to / import from the DayZ Editor (.dze, as read by "DayZ Editor
// Loader" and Dabs Framework's EditorSaveData). Class names, pivots and the
// stairs direction come from the Aftermath BaseParts config and models.
//
// Coordinates: the planner is right-handed (three.js), DayZ is left-handed
// (x east, y up, z north). Planner (x, y, z) maps to DayZ (x, y, -z); a part's
// DayZ yaw (degrees, clockwise from north) is 180 - r + per-part offset.

import { GRID, LEVEL_H, SLAB } from './constants';
import { PARTS } from './data';
import { rot } from './shapes';
import type { Piece } from './store';

interface ExportSpec {
  cls: string;
  /** extra yaw in degrees (model faces the other way) */
  yaw?: number;
  /** offset from planner centre to model pivot, in planner local (x, z) */
  off?: [number, number];
}

const TRI_H = (GRID * Math.sqrt(3)) / 2;

export const DAYZ_CLASSES: Record<string, ExportSpec> = {
  wood_wall: { cls: 'Wood_Full_Wall' },
  wood_third_wall: { cls: 'Wood_Third_Wall' },
  wood_wall_window: { cls: 'Wood_Window_Wall' },
  wood_glass_wall: { cls: 'Wood_Glass_Wall' },
  wood_glass_window: { cls: 'Wood_Glass_Window' },
  wood_door: { cls: 'Wood_Door' },
  wood_small_door: { cls: 'Wood_Small_Door' },
  wood_garage_door: { cls: 'Wood_Garage_Door' },
  wood_garage_shutter: { cls: 'Wood_Garage_Shutter' },
  wood_floor: { cls: 'Wood_Floor' },
  wood_floor_porthole: { cls: 'Wood_Floor_Porthole' },
  wood_floor_door: { cls: 'Wood_Floor_Door' },
  // pivot on the base edge, apex towards the model's +z
  wood_triangle_floor: { cls: 'Wood_Equal_Triangle', off: [0, -TRI_H / 3] },
  // pivot on a long edge, extends towards +z
  wood_walkway: { cls: 'Wood_Walkway', off: [0, -GRID / 4] },
  // model rises towards -z and its centre sits 0.275 m off the pivot
  wood_stairs: { cls: 'Wood_Stairs', yaw: 180, off: [0, -0.275] },
  wood_spiral_stairs: { cls: 'Wood_Stairs_180' },
  wood_shed: { cls: 'Wood_Shed', off: [0, 0.72] },
  compound_wall: { cls: 'Wood_Palisade_Wall' },
  compound_door: { cls: 'Wood_Palisade_Door' },
  cinder_wall: { cls: 'Cinder_Full_Wall' },
  cinder_half_wall: { cls: 'Cinder_Half_Wall' },
  cinder_wall_window: { cls: 'Cinder_Window_Wall' },
  cinder_door: { cls: 'Cinder_Door' },
  cinder_small_door: { cls: 'Cinder_Small_Door' },
  cinder_garage_door: { cls: 'Cinder_Garage_Door' },
  cinder_hangar_door: { cls: 'Cinder_Hanger_Door' },
  cinder_garage_shutter: { cls: 'Cinder_Garage_Shutter' },
  cinder_hangar_shutter: { cls: 'Cinder_Hanger_Shutter' },
  metal_floor: { cls: 'Metal_Floor' },
  metal_floor_porthole: { cls: 'Metal_Floor_Porthole' },
  metal_floor_door: { cls: 'Metal_Floor_Door' },
  window_bars: { cls: 'Metal_Window_Bars' },
  sandbag_corner: { cls: 'Sandbag_Corner' },
  sandbag_short: { cls: 'Sandbag_Short' },
  sandbag_long: { cls: 'Sandbag_Long' },
  sandbag_round: { cls: 'Sandbag_Round' },
  hesco_triple: { cls: 'HCubeBarrierx3' },
  camonet_east: { cls: 'CamoNet_EAST' },
  camonet_nato: { cls: 'CamoNet_NATO' },
  plot_pole: { cls: 'Aftermath_Plotpole' },
  workbench: { cls: 'Wooden_Workbench' },
  wood_storage: { cls: 'AM_WoodStorage' },
  sign: { cls: 'Aftermath_Sign' },
  wood_greenhouse: { cls: 'GP_GreenhouseWood' },
  metal_greenhouse: { cls: 'GP_Greenhouse' },
  raid_alarm: { cls: 'AM_RaidAlarm' },
  circular_saw: { cls: 'AM_Circular_Machine' },
  repair_bench: { cls: 'AM_Repairbench' },
  sewing_bench: { cls: 'AM_Sewingbench' },
  shredder: { cls: 'AM_Shredder' },
  small_case: { cls: 'Aftermath_Small_Case' },
  medium_case: { cls: 'Aftermath_Medium_Case' },
  large_case: { cls: 'Aftermath_Large_Case' },
  long_case: { cls: 'Aftermath_Long_Case' },
  shelf: { cls: 'Aftermath_Shelf' },
  dresser: { cls: 'Aftermath_Dresser' },
  tools_cabinet: { cls: 'Aftermath_Tools_Cabinet' },
  fridge: { cls: 'Aftermath_Fridge' },
  medic_case: { cls: 'Aftermath_Medic_Case' },
  gun_cabinet: { cls: 'Aftermath_Cabinet' },
  rifle_locker: { cls: 'Aftermath_Cabinet_Small' },
  locker: { cls: 'Aftermath_Locker' },
  dustbin: { cls: 'AM_Dustbin' },
  arcade: { cls: 'Aftermath_Arcade_Machine' },
  trophy_skull: { cls: 'AM_TrophySkull' },
  water_cooler: { cls: 'AM_WaterCooler' },
  bottle_rack: { cls: 'AM_WaterCoolerRack' },
};

/**
 * Model of each class. Base parts spawned by class name run DayZ's construction
 * logic, which fails outside a server ("invalid EntityType or
 * ConstructionDataTypeHolder") and leaves them invisible; as static models
 * they always show fully built.
 */
export const DAYZ_MODELS: Record<string, string> = {
  Wood_Full_Wall: "BaseParts\\wood\\wood_full_wall\\Wood_full_wall.p3d",
  Wood_Third_Wall: "BaseParts\\wood\\wood_Third_wall\\Wood_Third_wall.p3d",
  Wood_Window_Wall: "BaseParts\\wood\\wood_Window_wall\\Wood_Window_wall.p3d",
  Wood_Glass_Wall: "BaseParts\\wood\\wood_glass_wall\\Wood_Glass_Wall.p3d",
  Wood_Glass_Window: "BaseParts\\wood\\wood_glass_window\\Wood_Glass_Window.p3d",
  Wood_Door: "BaseParts\\wood\\wood_door\\wood_door.p3d",
  Wood_Small_Door: "BaseParts\\wood\\wood_small_door\\wood_small_door.p3d",
  Wood_Garage_Door: "BaseParts\\wood\\wood_garage_door\\wood_garage_door.p3d",
  Wood_Garage_Shutter: "BaseParts\\wood\\Wood_Garage_Rolling_Door\\Wood_Garage_Rolling_Door.p3d",
  Wood_Floor: "BaseParts\\wood\\wood_floor\\Wood_floor.p3d",
  Wood_Floor_Porthole: "BaseParts\\wood\\wood_floor_porthole\\Wood_floor_porthole.p3d",
  Wood_Floor_Door: "BaseParts\\wood\\wood_Floor_Door\\wood_floor_door.p3d",
  Wood_Equal_Triangle: "BaseParts\\wood\\Wood_Equal_Triangle\\Wood_Equal_Triangle.p3d",
  Wood_Walkway: "BaseParts\\wood\\wood_walkway\\Wood_walkway.p3d",
  Wood_Stairs: "BaseParts\\wood\\wooden_stairs\\wooden_stairs.p3d",
  Wood_Stairs_180: "BaseParts\\wood\\turning_stairs\\turning_stairs.p3d",
  Wood_Shed: "BaseParts\\WoodShed\\WoodShed.p3d",
  Wood_Palisade_Wall: "BaseParts\\wood\\wood_log_palisade_wall\\wood_log_palisade_wall.p3d",
  Wood_Palisade_Door: "BaseParts\\wood\\wood_log_palisade_door\\wood_log_palisade_door.p3d",
  Cinder_Full_Wall: "BaseParts\\cinder\\cinder_full_wall\\cinder_full_wall.p3d",
  Cinder_Half_Wall: "BaseParts\\cinder\\cinder_half_wall\\cinder_half_wall.p3d",
  Cinder_Window_Wall: "BaseParts\\cinder\\cinder_window_wall\\cinder_window_wall.p3d",
  Cinder_Door: "BaseParts\\cinder\\cinder_door\\cinder_door.p3d",
  Cinder_Small_Door: "BaseParts\\cinder\\cinder_small_door\\cinder_small_door.p3d",
  Cinder_Garage_Door: "BaseParts\\cinder\\cinder_garage_door\\cinder_garage_door.p3d",
  Cinder_Hanger_Door: "BaseParts\\cinder\\cinder_hanger_door\\cinder_hanger_door.p3d",
  Cinder_Garage_Shutter: "BaseParts\\cinder\\cinder_garage_rolling_door\\cinder_garage_rolling_door.p3d",
  Cinder_Hanger_Shutter: "BaseParts\\cinder\\Cinder_Hanger_Rolling_Door\\Cinder_Hanger_Rolling_Door.p3d",
  Metal_Floor: "BaseParts\\metal\\metal_floor\\metal_floor.p3d",
  Metal_Floor_Porthole: "BaseParts\\metal\\metal_Floor_Porthole\\metal_floor_Porthole.p3d",
  Metal_Floor_Door: "BaseParts\\metal\\metal_Floor_Door\\metal_floor_door.p3d",
  Metal_Window_Bars: "BaseParts\\metal\\metal_window_bars\\metal_window_bars.p3d",
  Sandbag_Corner: "aftermath_licenced\\arma2\\BagFenceCorner.p3d",
  Sandbag_Short: "aftermath_licenced\\arma2\\BagFenceShort.p3d",
  Sandbag_Long: "aftermath_licenced\\arma2\\BagFenceLong.p3d",
  Sandbag_Round: "aftermath_licenced\\arma2\\BagFenceRound.p3d",
  HCubeBarrierx3: "Aftermath_Licenced\\materials\\hcube\\hbarrier3.p3d",
  CamoNet_EAST: "aftermath_licenced\\arma2\\CamoNet_EAST_var1.p3d",
  CamoNet_NATO: "aftermath_licenced\\arma2\\CamoNet_NATO.p3d",
  Aftermath_Plotpole: "Aftermath_Licenced\\plotpole\\am_plotpole.p3d",
  Wooden_Workbench: "BaseParts\\workbench\\workbench.p3d",
  AM_WoodStorage: "BaseParts\\furniture\\WoodStorage\\woodstorage.p3d",
  Aftermath_Sign: "BaseParts\\furniture\\Sign\\Sign.p3d",
  GP_GreenhouseWood: "GreenhousePack\\data\\garden\\greenhouse_wood\\greenhousewood.p3d",
  GP_Greenhouse: "GreenhousePack\\data\\garden\\greenhouse\\greenhouse.p3d",
  AM_RaidAlarm: "AftermathTerminals\\quest_radio.p3d",
  AM_Circular_Machine: "AftermathBaseItems\\circular_machine.p3d",
  AM_Repairbench: "AM_Recycling\\RepairBench\\repairbench.p3d",
  AM_Sewingbench: "AM_Recycling\\SewingBench\\sewingbench.p3d",
  AM_Shredder: "AftermathBaseItems\\shredder.p3d",
  Aftermath_Small_Case: "BaseParts\\furniture\\case\\Small.p3d",
  Aftermath_Medium_Case: "BaseParts\\furniture\\case\\Medium.p3d",
  Aftermath_Large_Case: "BaseParts\\furniture\\case\\large.p3d",
  Aftermath_Long_Case: "BaseParts\\furniture\\case\\Long.p3d",
  Aftermath_Shelf: "BaseParts\\furniture\\Shelf\\Shelf.p3d",
  Aftermath_Dresser: "BaseParts\\furniture\\dresser\\dresser.p3d",
  Aftermath_Tools_Cabinet: "BaseParts\\furniture\\tools_cabinet\\Tools_Cabinet.p3d",
  Aftermath_Fridge: "BaseParts\\furniture\\Fridge\\Fridge.p3d",
  Aftermath_Medic_Case: "BaseParts\\furniture\\medic_case\\medic_case.p3d",
  Aftermath_Cabinet: "BaseParts\\furniture\\cabinet\\gunrack.p3d",
  Aftermath_Cabinet_Small: "BaseParts\\furniture\\cabinet\\cabinet.p3d",
  Aftermath_Locker: "BaseParts\\furniture\\locker\\locker.p3d",
  AM_Dustbin: "AM_Dustbin\\dustbin.p3d",
  Aftermath_Arcade_Machine: "BaseParts\\furniture\\ArcadeMachine\\arcademachine.p3d",
  AM_TrophySkull: "AM_HeadOnSpike\\data\\TrophySkull.p3d",
  AM_WaterCooler: "AftermathCollectables\\data\\Plastic\\water_cooler.p3d",
  AM_WaterCoolerRack: "AftermathCollectables\\data\\Plastic\\bottle_rack.p3d",
};

const BY_CLASS = new Map(Object.entries(DAYZ_CLASSES).map(([id, s]) => [s.cls.toLowerCase(), id]));
for (const [id, s] of Object.entries(DAYZ_CLASSES)) {
  const m = DAYZ_MODELS[s.cls];
  if (m) BY_CLASS.set(normModel(m), id);
}

function normModel(p: string) {
  return p.trim().replace(/\//g, '\\').replace(/^\\+/, '').toLowerCase();
}

const typeKey = (t: string) => (/\.p3d$/i.test(t.trim()) ? normModel(t) : t.toLowerCase());

export const MAPS = [
  { id: 'chernarusplus', name: 'Chernarus' },
  { id: 'enoch', name: 'Livonia' },
  { id: 'sakhal', name: 'Sakhal' },
  { id: 'namalsk', name: 'Namalsk' },
  { id: 'deerisle', name: 'Deer Isle' },
];

export interface Anchor {
  map: string;
  /** DayZ world position of the base centre at ground level */
  x: number;
  y: number;
  z: number;
  /** heading of the base in degrees (0 = as in the planner, north up) */
  yaw: number;
}

const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;
const wrap = (d: number) => {
  let a = ((d + 180) % 360 + 360) % 360 - 180;
  if (Object.is(a, -0)) a = 0;
  return a;
};
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Centre of the base footprint in planner coordinates. */
export function baseCentre(pieces: Piece[]) {
  if (!pieces.length) return { x: 0, z: 0 };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of pieces) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
}

export interface ExportResult {
  json: string;
  /** the same save in the editor's own binary format (what it writes itself) */
  binary: Uint8Array;
  count: number;
  skipped: string[];
}

export type ExportMode = 'model' | 'class';

export function exportDze(pieces: Piece[], anchor: Anchor, mode: ExportMode = 'model'): ExportResult {
  const c = baseCentre(pieces);
  const A = rad(anchor.yaw);
  const objects: unknown[] = [];
  const skipped: string[] = [];
  for (const p of pieces) {
    const spec = DAYZ_CLASSES[p.t];
    if (!spec) {
      skipped.push(PARTS[p.t]?.name ?? p.t);
      continue;
    }
    const [ox, oz] = spec.off ? rot(spec.off[0], spec.off[1], p.r) : [0, 0];
    const lx = p.x + ox - c.x;
    const lz = -(p.z + oz - c.z); // mirror into DayZ's left-handed frame
    const wx = lx * Math.cos(A) + lz * Math.sin(A);
    const wz = -lx * Math.sin(A) + lz * Math.cos(A);
    const yaw = wrap(180 - deg(p.r) + (spec.yaw ?? 0) + anchor.yaw);
    const model = DAYZ_MODELS[spec.cls];
    const type = mode === 'model' && model ? model : spec.cls;
    objects.push({
      Type: type,
      DisplayName: spec.cls,
      Position: [r3(anchor.x + wx), r3(anchor.y + p.y), r3(anchor.z + wz)],
      Orientation: [r3(yaw), 0, 0],
      Scale: 1,
      Model: model ?? '',
      Flags: 30,
    });
  }
  const now = Math.floor(Date.now() / 1000);
  const save = {
    MapName: anchor.map,
    AuthorId: '',
    CreditIds: [],
    LastModified: now,
    CreationDate: now,
    CameraPosition: [r3(anchor.x - 15), r3(anchor.y + 18), r3(anchor.z - 15)],
    EditorObjects: objects,
    EditorHiddenObjects: [],
    CameraTracks: [],
  };
  return { json: JSON.stringify(save, null, 1), binary: encodeBinary(save), count: objects.length, skipped };
}

interface SaveObject {
  Type: string;
  DisplayName: string;
  Position: number[];
  Orientation: number[];
  Scale: number;
  Model: string;
  Flags: number;
}

/**
 * EditorSaveData version 8, binned. Layout verified against a save written by
 * DayZ Editor: strings are int32 length + bytes, vectors int32 count (3) +
 * three floats, bools four bytes.
 */
export function encodeBinary(save: { MapName: string; CameraPosition: number[]; LastModified: number; CreationDate: number; EditorObjects: unknown[] }) {
  const parts: Uint8Array[] = [];
  const te = new TextEncoder();
  const int = (v: number) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setInt32(0, v, true);
    parts.push(b);
  };
  const float = (v: number) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setFloat32(0, v, true);
    parts.push(b);
  };
  const str = (t: string) => {
    const e = te.encode(t);
    int(e.length);
    parts.push(e);
  };
  const vec = (v: number[]) => {
    int(3);
    float(v[0]);
    float(v[1]);
    float(v[2]);
  };
  str('EditorBinned');
  int(8);
  str(save.MapName);
  vec(save.CameraPosition);
  str(''); // author
  int(0); // credits
  int(save.LastModified | 0);
  int(save.CreationDate | 0);
  const objs = save.EditorObjects as SaveObject[];
  int(objs.length);
  for (const o of objs) {
    str(o.Type);
    str(o.DisplayName);
    vec(o.Position);
    vec(o.Orientation);
    float(o.Scale);
    int(o.Flags);
    int(0); // parameters
    int(0); // editor only
    int(0); // locked
    int(1); // allow damage
    int(0); // simulate
    str(o.Model);
    int(0); // attachments
  }
  int(0); // hidden objects
  int(0); // camera tracks
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

// ------------------------------------------------------------------ reading
export interface DzeObject {
  type: string;
  pos: [number, number, number];
  ori: [number, number, number];
}

export interface DzeFile {
  map: string;
  objects: DzeObject[];
  /** true when only part of a binary file could be read */
  partial: boolean;
}

function readBinary(buf: ArrayBuffer): DzeFile {
  const dv = new DataView(buf);
  let o = 0;
  const td = new TextDecoder();
  const int = () => {
    const v = dv.getInt32(o, true);
    o += 4;
    return v;
  };
  const float = () => {
    const v = dv.getFloat32(o, true);
    o += 4;
    return v;
  };
  const str = () => {
    const n = int();
    if (n < 0 || n > 4096 || o + n > buf.byteLength) throw new Error('bad string');
    const s = td.decode(new Uint8Array(buf, o, n));
    o += n;
    return s;
  };
  // vectors are written as an element count (3) followed by the floats
  const vec = (): [number, number, number] => {
    const n = int();
    if (n !== 3) throw new Error('bad vector');
    return [float(), float(), float()];
  };
  if (str() !== 'EditorBinned') throw new Error('not a binned .dze');
  const version = int();
  const map = str();
  vec(); // camera
  if (version >= 7) {
    str();
    const credits = int();
    for (let i = 0; i < credits; i++) str();
    int();
    int();
  }
  const count = int();
  const objects: DzeObject[] = [];
  let partial = false;
  for (let i = 0; i < count; i++) {
    try {
      const type = str();
      str(); // display name
      const pos = vec();
      const ori = vec();
      float(); // scale
      int(); // flags
      objects.push({ type, pos, ori });
      if (version < 2) continue;
      if (version < 8) {
        const n = int();
        for (let k = 0; k < n; k++) str();
      }
      if (int() !== 0) {
        // object parameters have their own types; stop here rather than guess
        partial = i + 1 < count;
        break;
      }
      if (version < 3) continue;
      o += 4 * 4; // EditorOnly, Locked, AllowDamage, Simulate
      if (version < 5) continue;
      str(); // model
      if (int() !== 0) {
        partial = i + 1 < count;
        break;
      }
    } catch {
      partial = true;
      break;
    }
  }
  return { map, objects, partial };
}

export async function readDze(file: File): Promise<DzeFile> {
  const buf = await file.arrayBuffer();
  const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(64, buf.byteLength))).trimStart();
  if (head.startsWith('{')) {
    const data = JSON.parse(new TextDecoder().decode(buf));
    const objects: DzeObject[] = (data.EditorObjects ?? []).map((e: { Type: string; Position: number[]; Orientation: number[] }) => ({
      type: String(e.Type ?? ''),
      pos: [Number(e.Position?.[0]) || 0, Number(e.Position?.[1]) || 0, Number(e.Position?.[2]) || 0],
      ori: [Number(e.Orientation?.[0]) || 0, Number(e.Orientation?.[1]) || 0, Number(e.Orientation?.[2]) || 0],
    }));
    return { map: String(data.MapName ?? ''), objects, partial: false };
  }
  return readBinary(buf);
}

/** The first object in the file marks where (and which way) the base goes. */
export function anchorFrom(f: DzeFile): Anchor | null {
  const o = f.objects[0];
  if (!o) return null;
  return { map: f.map || 'chernarusplus', x: o.pos[0], y: o.pos[1], z: o.pos[2], yaw: o.ori[0] };
}

/** Turn Aftermath parts found in a .dze back into planner pieces, around their centre. */
export function piecesFromDze(f: DzeFile): { pieces: Omit<Piece, 'id'>[]; unknown: number } {
  const known = f.objects.filter((o) => BY_CLASS.has(typeKey(o.type)));
  if (!known.length) return { pieces: [], unknown: f.objects.length };
  const floors = known.filter((o) => PARTS[BY_CLASS.get(typeKey(o.type))!].kind === 'floor');
  const ground = floors.length ? Math.min(...floors.map((o) => o.pos[1])) - SLAB / 2 : Math.min(...known.map((o) => o.pos[1]));
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const o of known) {
    minX = Math.min(minX, o.pos[0]); maxX = Math.max(maxX, o.pos[0]);
    minZ = Math.min(minZ, o.pos[2]); maxZ = Math.max(maxZ, o.pos[2]);
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const pieces = known.map((o) => {
    const id = BY_CLASS.get(typeKey(o.type))!;
    const spec = DAYZ_CLASSES[id];
    const r = rad(180 + (spec.yaw ?? 0) - o.ori[0]);
    const [ox, oz] = spec.off ? rot(spec.off[0], spec.off[1], r) : [0, 0];
    const x = o.pos[0] - cx - ox;
    const z = -(o.pos[2] - cz) - oz;
    const y = o.pos[1] - ground;
    const kind = PARTS[id].kind;
    const l = Math.max(0, Math.round((kind === 'floor' || kind === 'wall' ? y - SLAB / 2 : y - 0.3) / LEVEL_H));
    return { t: id, x: r3(x), y: r3(y), z: r3(z), r: Math.round(r * 1e4) / 1e4, l: Math.min(7, l) };
  });
  return { pieces, unknown: f.objects.length - known.length };
}

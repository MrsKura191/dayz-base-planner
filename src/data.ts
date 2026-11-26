// Aftermath base building data, transcribed from the public wiki
// (https://aftermath-gaming.com/wiki/base-building/building-recipes and the
// raiding pages), as of 14 Nov 2026. Values marked `assumed` are not in the
// wiki and are planner estimates.

export type MatId =
  | 'logs' | 'planks' | 'nails' | 'scrap' | 'sheet' | 'glass' | 'cinder' | 'mortar'
  | 'sand' | 'burlap' | 'hesco' | 'camonet' | 'longstick' | 'erk';

export const MATERIALS: Record<MatId, { name: string; color: string }> = {
  logs: { name: 'Logs', color: '#8a6a45' },
  planks: { name: 'Wooden Planks', color: '#b08c5e' },
  nails: { name: 'Nails', color: '#9aa3ab' },
  scrap: { name: 'Scrap Metal', color: '#a0724f' },
  sheet: { name: 'Sheet Metal', color: '#7d8a94' },
  glass: { name: 'Box of Glass', color: '#8fc3d4' },
  cinder: { name: 'Cinder Blocks', color: '#9c9c96' },
  mortar: { name: 'Mortar', color: '#c9c2b0' },
  sand: { name: 'Bag of Sand', color: '#cbb48a' },
  burlap: { name: 'Burlap Sack', color: '#a8916a' },
  hesco: { name: 'Hesco Box', color: '#a89a72' },
  camonet: { name: 'Camo Net', color: '#6b7a4a' },
  longstick: { name: 'Long Stick', color: '#7a6040' },
  erk: { name: 'Electronic Repair Kit', color: '#5f9a7a' },
};

export type ToolId = 'hammer' | 'crowbar' | 'hacksaw' | 'screwdriver' | 'pliers' | 'sledgehammer' | 'shovel';
export const TOOLS: Record<ToolId, string> = {
  hammer: 'Hammer',
  crowbar: 'Crowbar',
  hacksaw: 'Hacksaw',
  screwdriver: 'Screwdriver',
  pliers: 'Pliers',
  sledgehammer: 'Sledgehammer',
  shovel: 'Shovel',
};

export type Category = 'wood' | 'cinder' | 'metal' | 'fort' | 'general' | 'furniture';
export const CATEGORIES: { id: Category; name: string }[] = [
  { id: 'wood', name: 'Holz' },
  { id: 'cinder', name: 'Cinder' },
  { id: 'metal', name: 'Metall' },
  { id: 'fort', name: 'Befestigung' },
  { id: 'general', name: 'Allgemein' },
  { id: 'furniture', name: 'Möbel & Lager' },
];

export type UpkeepCat = 'build' | 'door' | 'storage' | 'furniture' | 'alarm' | 'other';
export const UPKEEP_CATS: { id: UpkeepCat; name: string }[] = [
  { id: 'build', name: 'Wände, Böden & Treppen' },
  { id: 'door', name: 'Türen & Tore' },
  { id: 'storage', name: 'Lager' },
  { id: 'furniture', name: 'Möbel & Maschinen' },
  { id: 'alarm', name: 'Raid-Alarm' },
  { id: 'other', name: 'Befestigung & Sonstiges' },
];

export type Look = 'wood' | 'cinder' | 'metal' | 'log' | 'sand' | 'net' | 'furniture';
export type Opening =
  | 'none' | 'window' | 'glass' | 'glasswindow' | 'door' | 'smalldoor'
  | 'garage' | 'shutter' | 'hangar' | 'hangarshutter';
export type Kind = 'floor' | 'wall' | 'stairs' | 'spiral' | 'palisade' | 'bars' | 'object' | 'plotpole';
export type ObjStyle =
  | 'box' | 'workbench' | 'storage' | 'sign' | 'greenhouse' | 'shed' | 'sandbag'
  | 'sandbag_corner' | 'sandbag_round' | 'hesco' | 'camonet' | 'machine';

export interface RaidInfo {
  charges: number;
  chargesAssumed?: boolean;
  fuel: number;
  fuelAssumed?: boolean;
}

export interface PartDef {
  id: string;
  name: string;
  cat: Category;
  kind: Kind;
  look: Look;
  /** Materials; a key that is a part id means "one kit of that part" */
  recipe: Record<string, number> | null;
  tools: ToolId[];
  /** Crafted by hand rather than at the workbench */
  handCraft?: boolean;
  note?: string;
  upkeep: UpkeepCat;
  countsAsDoor?: boolean;
  raid?: RaidInfo;
  // floors
  shape?: 'square' | 'tri' | 'walkway';
  hole?: 'none' | 'porthole' | 'hatch';
  // walls
  width?: number;
  height?: number;
  opening?: Opening;
  // objects
  size?: [number, number, number];
  style?: ObjStyle;
  color?: string;
}

const WOOD_DOOR: RaidInfo = { charges: 1, fuel: 3750 };
const CINDER_DOOR: RaidInfo = { charges: 2, fuel: 7500 };

const list: PartDef[] = [
  // ---------------------------------------------------------------- Holz
  { id: 'wood_wall', name: 'Wood Wall', cat: 'wood', kind: 'wall', look: 'wood', opening: 'none',
    recipe: { logs: 4, planks: 15, nails: 35 }, tools: ['hammer', 'crowbar', 'hacksaw'], upkeep: 'build' },
  { id: 'wood_third_wall', name: 'Third Wood Wall', cat: 'wood', kind: 'wall', look: 'wood', opening: 'none', height: 0.97,
    recipe: { logs: 2, planks: 5, nails: 15 }, tools: ['screwdriver', 'crowbar'], upkeep: 'build' },
  { id: 'wood_wall_window', name: 'Wood Wall With Window', cat: 'wood', kind: 'wall', look: 'wood', opening: 'window',
    recipe: { logs: 4, planks: 15, nails: 35, scrap: 1 }, tools: ['screwdriver', 'crowbar', 'hacksaw'], upkeep: 'build' },
  { id: 'wood_glass_wall', name: 'Wood Glass Wall', cat: 'wood', kind: 'wall', look: 'wood', opening: 'glass',
    recipe: { logs: 4, nails: 35, glass: 3 }, tools: ['screwdriver', 'crowbar', 'hacksaw'], upkeep: 'build' },
  { id: 'wood_glass_window', name: 'Wood Glass Window', cat: 'wood', kind: 'wall', look: 'wood', opening: 'glasswindow',
    recipe: { logs: 4, planks: 10, nails: 35, glass: 1 }, tools: ['screwdriver', 'crowbar', 'hacksaw'], upkeep: 'build' },
  { id: 'wood_door', name: 'Wood Door', cat: 'wood', kind: 'wall', look: 'wood', opening: 'door', countsAsDoor: true, raid: WOOD_DOOR,
    recipe: { logs: 4, planks: 15, nails: 35, scrap: 1 }, tools: ['screwdriver', 'pliers', 'hacksaw'], upkeep: 'door' },
  { id: 'wood_small_door', name: 'Wood Small Door', cat: 'wood', kind: 'wall', look: 'wood', opening: 'smalldoor', width: 1.6, height: 2.43, countsAsDoor: true,
    raid: { ...WOOD_DOOR, chargesAssumed: true },
    recipe: { logs: 4, planks: 15, nails: 35, scrap: 1 }, tools: ['screwdriver', 'pliers', 'hacksaw'], upkeep: 'door' },
  { id: 'wood_garage_door', name: 'Wood Garage Door', cat: 'wood', kind: 'wall', look: 'wood', opening: 'garage', countsAsDoor: true, raid: WOOD_DOOR,
    recipe: { logs: 4, planks: 15, nails: 35, scrap: 2 }, tools: ['screwdriver', 'pliers', 'hacksaw'], upkeep: 'door' },
  { id: 'wood_garage_shutter', name: 'Wood Garage Shutter Door', cat: 'wood', kind: 'wall', look: 'wood', opening: 'shutter', countsAsDoor: true,
    raid: { ...WOOD_DOOR, chargesAssumed: true },
    recipe: { wood_garage_door: 1, erk: 1, scrap: 2 }, tools: ['screwdriver', 'pliers', 'hacksaw'], upkeep: 'door',
    note: 'Braucht ein fertiges Wood Garage Door Kit.' },
  { id: 'wood_floor', name: 'Wood Floor', cat: 'wood', kind: 'floor', look: 'wood', shape: 'square', hole: 'none',
    recipe: { logs: 4, planks: 20, nails: 30 }, tools: ['hammer', 'crowbar', 'hacksaw'], upkeep: 'build' },
  { id: 'wood_floor_porthole', name: 'Wood Floor Porthole', cat: 'wood', kind: 'floor', look: 'wood', shape: 'square', hole: 'porthole',
    recipe: { logs: 4, planks: 15, nails: 20 }, tools: ['hammer', 'crowbar', 'hacksaw'], upkeep: 'build' },
  { id: 'wood_floor_door', name: 'Wood Floor Door', cat: 'wood', kind: 'floor', look: 'wood', shape: 'square', hole: 'hatch', countsAsDoor: true,
    raid: { ...WOOD_DOOR, chargesAssumed: true },
    recipe: { logs: 4, planks: 15, nails: 35, scrap: 1 }, tools: ['screwdriver', 'pliers', 'hacksaw'], upkeep: 'door' },
  { id: 'wood_triangle_floor', name: 'Wood Triangle Floor', cat: 'wood', kind: 'floor', look: 'wood', shape: 'tri', hole: 'none',
    recipe: { logs: 3, planks: 15, nails: 20 }, tools: ['hammer', 'crowbar', 'hacksaw'], upkeep: 'build' },
  { id: 'wood_walkway', name: 'Wood Walkway', cat: 'wood', kind: 'floor', look: 'wood', shape: 'walkway', hole: 'none',
    recipe: { logs: 2, planks: 10, nails: 15 }, tools: ['hammer', 'crowbar', 'hacksaw'], upkeep: 'build' },
  { id: 'wood_stairs', name: 'Wood Stairs', cat: 'wood', kind: 'stairs', look: 'wood',
    recipe: { logs: 2, planks: 10, nails: 15 }, tools: ['hammer', 'screwdriver', 'crowbar'], upkeep: 'build' },
  { id: 'wood_spiral_stairs', name: 'Wood Spiral Stairs', cat: 'wood', kind: 'spiral', look: 'wood',
    recipe: { logs: 4, planks: 15, nails: 20 }, tools: ['hammer', 'screwdriver', 'crowbar'], upkeep: 'build' },
  { id: 'wood_shed', name: 'Wood Shed', cat: 'wood', kind: 'object', look: 'wood', style: 'shed', size: [4.6, 3.3, 5.8],
    raid: { charges: 1, fuel: 3750 },
    recipe: { logs: 6, planks: 20, nails: 35 }, tools: ['hammer', 'hacksaw'], upkeep: 'storage' },
  { id: 'compound_wall', name: 'Compound Wall (Palisade)', cat: 'wood', kind: 'palisade', look: 'log', width: 9.37, height: 7,
    raid: { charges: 1, chargesAssumed: true, fuel: 375, fuelAssumed: true },
    recipe: { logs: 20, planks: 20, nails: 50 }, tools: ['hammer', 'crowbar', 'hacksaw'], upkeep: 'build' },
  { id: 'compound_door', name: 'Compound Door (Palisade)', cat: 'wood', kind: 'palisade', look: 'log', width: 9.37, height: 7, opening: 'garage',
    raid: { charges: 1, chargesAssumed: true, fuel: 375, fuelAssumed: true },
    recipe: { logs: 20, planks: 20, nails: 50, scrap: 8 }, tools: ['hammer', 'screwdriver', 'pliers', 'hacksaw'], upkeep: 'door',
    note: 'Zählt nicht zum Türlimit.' },

  // -------------------------------------------------------------- Cinder
  { id: 'cinder_wall', name: 'Cinder Wall', cat: 'cinder', kind: 'wall', look: 'cinder', opening: 'none',
    recipe: { cinder: 6, mortar: 2 }, tools: ['shovel', 'hammer'], upkeep: 'build' },
  { id: 'cinder_half_wall', name: 'Cinder Half Wall', cat: 'cinder', kind: 'wall', look: 'cinder', opening: 'none', height: 1.46,
    recipe: { cinder: 3, mortar: 1 }, tools: ['shovel', 'hammer'], upkeep: 'build' },
  { id: 'cinder_wall_window', name: 'Cinder Wall With Window', cat: 'cinder', kind: 'wall', look: 'cinder', opening: 'window',
    recipe: { cinder: 5, mortar: 2, sheet: 1, scrap: 1 }, tools: ['sledgehammer', 'hacksaw'], upkeep: 'build' },
  { id: 'cinder_door', name: 'Cinder Door', cat: 'cinder', kind: 'wall', look: 'cinder', opening: 'door', countsAsDoor: true, raid: CINDER_DOOR,
    recipe: { cinder: 6, mortar: 2, scrap: 3 }, tools: ['screwdriver', 'sledgehammer', 'pliers'], upkeep: 'door' },
  { id: 'cinder_small_door', name: 'Cinder Small Door', cat: 'cinder', kind: 'wall', look: 'cinder', opening: 'smalldoor', width: 1.6, height: 2.43, countsAsDoor: true,
    raid: { ...CINDER_DOOR, chargesAssumed: true },
    recipe: { cinder: 6, mortar: 2, scrap: 3 }, tools: ['screwdriver', 'sledgehammer', 'pliers'], upkeep: 'door' },
  { id: 'cinder_garage_door', name: 'Cinder Garage Door', cat: 'cinder', kind: 'wall', look: 'cinder', opening: 'garage', countsAsDoor: true, raid: CINDER_DOOR,
    recipe: { cinder: 3, mortar: 1, scrap: 6 }, tools: ['screwdriver', 'sledgehammer', 'pliers'], upkeep: 'door' },
  { id: 'cinder_hangar_door', name: 'Cinder Hangar Door', cat: 'cinder', kind: 'wall', look: 'cinder', opening: 'hangar', width: 8.92, height: 5.84, countsAsDoor: true, raid: CINDER_DOOR,
    recipe: { cinder: 6, mortar: 2, sheet: 10, scrap: 8 }, tools: ['screwdriver', 'sledgehammer', 'pliers'], upkeep: 'door',
    note: 'Zwei Rasterfelder breit und zwei Ebenen hoch.' },
  { id: 'cinder_garage_shutter', name: 'Cinder Garage Shutter Door', cat: 'cinder', kind: 'wall', look: 'cinder', opening: 'shutter', countsAsDoor: true,
    raid: { ...CINDER_DOOR, chargesAssumed: true },
    recipe: { cinder_garage_door: 1, erk: 1, scrap: 2 }, tools: ['screwdriver', 'pliers', 'hacksaw'], upkeep: 'door',
    note: 'Braucht ein fertiges Cinder Garage Door Kit.' },
  { id: 'cinder_hangar_shutter', name: 'Cinder Hangar Shutter Door', cat: 'cinder', kind: 'wall', look: 'cinder', opening: 'hangarshutter', width: 8.92, height: 5.84, countsAsDoor: true,
    raid: { ...CINDER_DOOR, chargesAssumed: true },
    recipe: { cinder_hangar_door: 1, erk: 1, scrap: 2 }, tools: ['screwdriver', 'pliers', 'hacksaw'], upkeep: 'door',
    note: 'Braucht ein fertiges Cinder Hangar Door Kit.' },

  // --------------------------------------------------------------- Metall
  { id: 'metal_floor', name: 'Metal Floor', cat: 'metal', kind: 'floor', look: 'metal', shape: 'square', hole: 'none',
    recipe: { sheet: 6, nails: 35 }, tools: ['sledgehammer', 'crowbar', 'hacksaw'], upkeep: 'build' },
  { id: 'metal_floor_porthole', name: 'Metal Floor Porthole', cat: 'metal', kind: 'floor', look: 'metal', shape: 'square', hole: 'porthole',
    recipe: { sheet: 4, nails: 20, scrap: 2 }, tools: ['sledgehammer', 'crowbar', 'hacksaw'], upkeep: 'build' },
  { id: 'metal_floor_door', name: 'Metal Floor Door', cat: 'metal', kind: 'floor', look: 'metal', shape: 'square', hole: 'hatch', countsAsDoor: true,
    raid: { ...CINDER_DOOR, chargesAssumed: true },
    recipe: { sheet: 4, nails: 35, scrap: 6 }, tools: ['screwdriver', 'sledgehammer', 'pliers'], upkeep: 'door' },
  { id: 'window_bars', name: 'Window Bars', cat: 'metal', kind: 'bars', look: 'metal',
    recipe: { scrap: 2, nails: 10 }, tools: ['crowbar', 'hacksaw', 'hammer'], upkeep: 'other',
    note: 'Rastet an Wänden mit Fenster ein.' },

  // ---------------------------------------------------------- Befestigung
  { id: 'sandbag_corner', name: 'Corner Sandbag', cat: 'fort', kind: 'object', look: 'sand', style: 'sandbag_corner', size: [1.6, 0.9, 1.6],
    recipe: { sand: 1, burlap: 3 }, tools: ['shovel'], upkeep: 'other' },
  { id: 'sandbag_short', name: 'Short Sandbag', cat: 'fort', kind: 'object', look: 'sand', style: 'sandbag', size: [1.4, 0.9, 0.6],
    recipe: { sand: 1, burlap: 3 }, tools: ['shovel'], upkeep: 'other' },
  { id: 'sandbag_long', name: 'Long Sandbag', cat: 'fort', kind: 'object', look: 'sand', style: 'sandbag', size: [3, 0.9, 0.6],
    recipe: { sand: 1, burlap: 5 }, tools: ['shovel'], upkeep: 'other' },
  { id: 'sandbag_round', name: 'Round Sandbag', cat: 'fort', kind: 'object', look: 'sand', style: 'sandbag_round', size: [3, 0.9, 3],
    recipe: { sand: 1, burlap: 5 }, tools: ['shovel'], upkeep: 'other' },
  { id: 'hesco_triple', name: 'Triple Hesco Box', cat: 'fort', kind: 'object', look: 'sand', style: 'hesco', size: [3.3, 1.4, 1.1],
    recipe: { sand: 1, hesco: 3 }, tools: ['shovel'], upkeep: 'other' },
  { id: 'camonet_east', name: 'Camo Net (East)', cat: 'fort', kind: 'object', look: 'net', style: 'camonet', size: [4, 2.6, 4], color: '#5d6b3c',
    recipe: { camonet: 2, longstick: 5 }, tools: ['shovel', 'hammer', 'crowbar'], upkeep: 'other' },
  { id: 'camonet_nato', name: 'Camo Net (NATO)', cat: 'fort', kind: 'object', look: 'net', style: 'camonet', size: [4, 2.6, 4], color: '#4f5c36',
    recipe: { camonet: 2, longstick: 5 }, tools: ['shovel', 'hammer', 'crowbar'], upkeep: 'other' },

  // ------------------------------------------------------------ Allgemein
  { id: 'plot_pole', name: 'Plot Pole', cat: 'general', kind: 'plotpole', look: 'metal', size: [0.4, 2.6, 0.4],
    recipe: { scrap: 1, longstick: 1 }, tools: [], upkeep: 'other', note: 'Beansprucht das Territorium (25 m Radius). Nur eine pro Basis.' },
  { id: 'workbench', name: 'Workbench', cat: 'general', kind: 'object', look: 'wood', style: 'workbench', size: [2, 1, 0.9],
    recipe: { planks: 10, nails: 40 }, tools: [], handCraft: true, upkeep: 'furniture', note: 'Wird von Hand gecraftet.' },
  { id: 'wood_storage', name: 'Wood Storage', cat: 'general', kind: 'object', look: 'wood', style: 'storage', size: [1.6, 1.7, 1.2],
    recipe: { planks: 10, nails: 30, scrap: 4 }, tools: ['hammer', 'crowbar', 'hacksaw'], upkeep: 'storage',
    note: 'Inhalt zählt als Werkbank-Material, wenn höchstens 4 m entfernt.' },
  { id: 'sign', name: 'Sign', cat: 'general', kind: 'object', look: 'wood', style: 'sign', size: [0.8, 1.2, 0.1],
    recipe: { planks: 1, nails: 5 }, tools: ['hammer', 'hacksaw'], upkeep: 'other' },
  { id: 'wood_greenhouse', name: 'Wood Greenhouse', cat: 'general', kind: 'object', look: 'wood', style: 'greenhouse', size: [3, 2.4, 4],
    recipe: { sand: 1, glass: 3, planks: 10, nails: 30 }, tools: ['shovel', 'hammer'], upkeep: 'furniture' },
  { id: 'metal_greenhouse', name: 'Glass Greenhouse', cat: 'general', kind: 'object', look: 'metal', style: 'greenhouse', size: [3, 2.4, 4],
    recipe: { sand: 1, glass: 3, scrap: 8 }, tools: ['shovel', 'hammer'], upkeep: 'furniture' },
  { id: 'raid_alarm', name: 'Raid Alarm', cat: 'general', kind: 'object', look: 'furniture', style: 'machine', size: [0.4, 0.6, 0.3], color: '#7a2f2f',
    recipe: null, tools: [], upkeep: 'alarm', note: 'Kosten nicht im Wiki. Teuerster Posten beim Unterhalt.' },
  { id: 'circular_saw', name: 'Circular Saw', cat: 'general', kind: 'object', look: 'furniture', style: 'machine', size: [1.4, 1, 0.8], color: '#5a5f63',
    recipe: null, tools: [], upkeep: 'furniture', note: 'Kosten nicht im Wiki. 1 Log = 5 Planks.' },
  { id: 'repair_bench', name: 'Repair Bench', cat: 'general', kind: 'object', look: 'furniture', style: 'machine', size: [1.8, 1, 0.8], color: '#4d5a52',
    recipe: null, tools: [], upkeep: 'furniture', note: 'Kosten nicht im Wiki.' },
  { id: 'sewing_bench', name: 'Sewing Bench', cat: 'general', kind: 'object', look: 'furniture', style: 'machine', size: [1.8, 1, 0.8], color: '#5a4d5a',
    recipe: null, tools: [], upkeep: 'furniture', note: 'Kosten nicht im Wiki.' },
  { id: 'shredder', name: 'Shredder', cat: 'general', kind: 'object', look: 'furniture', style: 'machine', size: [1, 1.4, 1], color: '#3f4a55',
    recipe: null, tools: [], upkeep: 'furniture', note: 'Kosten nicht im Wiki.' },
];

// ------------------------------------------------------------- Möbel & Lager
const furniture: [string, string, [number, number, number], string, UpkeepCat][] = [
  ['small_case', 'Small Case', [1, 0.6, 0.6], '#4a4f45', 'storage'],
  ['medium_case', 'Medium Case', [1.4, 0.7, 0.7], '#4a4f45', 'storage'],
  ['large_case', 'Large Case', [1.8, 0.9, 0.9], '#4a4f45', 'storage'],
  ['long_case', 'Long Case', [2, 0.5, 0.5], '#4a4f45', 'storage'],
  ['shelf', 'Shelf', [1.2, 2, 0.5], '#6b5a44', 'storage'],
  ['dresser', 'Dresser', [1.4, 1, 0.6], '#6b5a44', 'storage'],
  ['tools_cabinet', 'Tools Cabinet', [1, 1.9, 0.5], '#7a3d33', 'storage'],
  ['fridge', 'Fridge', [0.8, 1.9, 0.7], '#c9cdd0', 'storage'],
  ['medic_case', 'Medic Case', [1, 0.6, 0.6], '#c9cdd0', 'storage'],
  ['gun_cabinet', 'Gun Cabinet', [1.5, 1.9, 0.5], '#3e4a3a', 'storage'],
  ['rifle_locker', 'Rifle Locker', [0.9, 1.9, 0.5], '#3e4a3a', 'storage'],
  ['locker', 'Locker', [0.6, 1.9, 0.5], '#55606a', 'storage'],
  ['dustbin', 'Dustbin', [0.6, 1, 0.6], '#3d4a3d', 'furniture'],
  ['arcade', 'Arcade Machine', [0.8, 1.8, 0.8], '#2f3a6b', 'furniture'],
  ['trophy_skull', 'Trophy Skull', [0.5, 0.5, 0.4], '#d8d0bd', 'furniture'],
  ['water_cooler', 'Water Cooler', [0.4, 1.2, 0.4], '#6fa3c4', 'furniture'],
  ['bottle_rack', 'Bottle Rack', [0.5, 1, 0.4], '#5d6670', 'furniture'],
];
for (const [id, name, size, color, upkeep] of furniture) {
  list.push({
    id, name, cat: 'furniture', kind: 'object', look: 'furniture', style: 'box', size, color,
    recipe: null, tools: [], upkeep, note: 'Kosten nicht im Wiki (Händler/Loot).',
  });
}

export const PARTS: Record<string, PartDef> = Object.fromEntries(list.map((p) => [p.id, p]));
export const PART_ORDER: string[] = list.map((p) => p.id);

/** Materials needed for one breaching charge (wiki: three hand-crafting steps). */
export const BREACHING_CHARGE_COST = [
  ['Charcoal Powder', 5],
  ['Sulphur Powder', 5],
  ['Burlap Sack', 1],
  ['Mobile Phone', 1],
] as const;

export const CHAINSAW_SOLO_MIN = { wood: 7.5, cinder: 15 };
export const CHAINSAW_TEAM_MIN: Record<number, { wood: number; cinder: number }> = {
  1: { wood: 7.5, cinder: 15 },
  2: { wood: 4, cinder: 7.5 },
  3: { wood: 2.5, cinder: 5 },
  4: { wood: 2, cinder: 4 },
};

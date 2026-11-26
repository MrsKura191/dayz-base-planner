// World dimensions. The wiki publishes no part sizes, so these are planner
// assumptions: a 3 m building grid and 3 m per storey.
export const GRID = 3;
export const SLAB = 0.2;
export const LEVEL_H = 3;
export const WALL_H = LEVEL_H - SLAB;
export const MAX_LEVEL = 7;

/** Height of the walkable top surface of a floor on the given level. */
export const levelTop = (level: number) => SLAB + level * LEVEL_H;

// Rules from the Aftermath wiki (as of 14 Nov 2026)
export const TERRITORY_RADIUS = 25;
export const DOOR_LIMIT = 15;
export const MEMBER_LIMIT = 6;
export const WORKBENCH_BATCH = 10;
export const NAILS_PER_SCRAP = 15;
export const SCRAP_PER_SHEET = 6;
export const PLANKS_PER_LOG_HAND = 4;
export const PLANKS_PER_LOG_SAW = 5;
export const FUEL_PER_BOTTLE = 5000;
export const ABANDON_DAYS = 10;

/** Part limit taken from the reference tool; not confirmed by the wiki. */
export const DEFAULT_PART_LIMIT = 3000;

export const DATA_AS_OF = '14.11.2026';
export const WIKI_URL = 'https://aftermath-gaming.com/wiki';

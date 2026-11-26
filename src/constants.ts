// World dimensions measured from the Aftermath BaseParts models
// (memory-point extents of Wood_Floor, Wood_Full_Wall, Wooden_Stairs).
export const GRID = 4.46;
/** floor slab thickness; slabs are centred on the storey plane */
export const SLAB = 0.24;
/** wall height = distance between storeys */
export const LEVEL_H = 2.92;
export const WALL_H = LEVEL_H;
export const MAX_LEVEL = 7;

/** Height of the storey plane: floor slab centre and wall base. */
export const levelTop = (level: number) => SLAB / 2 + level * LEVEL_H;
/** Walkable top surface of a floor on the given storey. */
export const floorTop = (level: number) => levelTop(level) + SLAB / 2;

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

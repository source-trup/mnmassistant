/**
 * The maps of MnM Atlas (https://www.mnmatlas.com), with their levels / floors, from the "Map list" on its embed
 * page (https://www.mnmatlas.com/embed/). Update this list when the atlas adds a map.
 */
export const ATLAS_URL = 'https://www.mnmatlas.com/';

export interface AtlasMap {
  id: string;
  name: string;
  levels: { id: string; name: string }[];
}

export const ATLAS_MAPS: AtlasMap[] = [
  { id: "world", name: "World map", levels: [{ id: "surface", name: "Surface" }, { id: "deep", name: "The Deep" }] },
  { id: "night-harbor", name: "Night Harbor", levels: [] },
  { id: "underdocks", name: "Underdocks", levels: [{ id: "lower", name: "Lower docks" }, { id: "tunnels", name: "Mine tunnels" }, { id: "upper", name: "Upper city" }] },
  { id: "ail-vorith", name: "Ail'Vorith", levels: [{ id: "city", name: "City and lake" }, { id: "tunnels", name: "Foreign Quarter tunnels" }] },
  { id: "blind-midden", name: "Blind Midden", levels: [{ id: "canyon", name: "Canyon and caves" }, { id: "basement", name: "Basement" }, { id: "ground", name: "Ground floor" }] },
  { id: "faelindral", name: "Faelindral", levels: [] },
  { id: "evershade-weald", name: "Evershade Weald", levels: [] },
  { id: "sungreet-strand", name: "Sungreet Strand", levels: [] },
  { id: "shaded-dunes", name: "Shaded Dunes", levels: [] },
  { id: "fallen-pass", name: "Fallen Pass", levels: [{ id: "ground", name: "Ground" }, { id: "underground", name: "Underground" }] },
  { id: "wyrmsbane-tomb", name: "Tomb of the Last Wyrmsbane", levels: [{ id: "floor-1", name: "Entrance halls" }, { id: "floor-2", name: "Fork halls and chapel" }, { id: "floor-3", name: "Ossuary and bone construct" }, { id: "floor-4", name: "Elite tombs" }, { id: "floor-5", name: "Deep caverns" }] },
  { id: "glass-flats", name: "Glass Flats", levels: [] },
  { id: "undead-keep", name: "Undead Keep", levels: [{ id: "outside", name: "Outside" }, { id: "inside", name: "Inside the keep" }] },
  { id: "ancient-crypt", name: "Ancient Crypt", levels: [{ id: "floor-1", name: "Main halls" }, { id: "floor-2", name: "Library loft and chapel nave" }, { id: "floor-3", name: "Lower passages" }] },
  { id: "infested-crypt", name: "Infested Crypt", levels: [{ id: "floor-1", name: "Crypt halls" }, { id: "floor-2", name: "Balcony and webs" }] },
  { id: "blacktide-bay", name: "Blacktide Bay", levels: [{ id: "ew-caves", name: "Evershade Weald caves" }, { id: "caves", name: "Keeper’s Bight caves" }, { id: "floor-1", name: "Upper caves and fortress" }, { id: "floor-2", name: "Lower caves, beach and bay" }] },
  { id: "scarwood", name: "Scarwood", levels: [] },
  { id: "vale-of-zintar", name: "Vale of Zintar", levels: [] },
  { id: "grain-cellar", name: "Grain Cellar", levels: [{ id: "cellar", name: "Cellar" }, { id: "entrance", name: "Entrance stair" }] },
  { id: "great-cavern-sea", name: "Great Cavern Sea", levels: [] },
  { id: "caves-of-irem", name: "Caves of Irem", levels: [] },
  { id: "tel-ekir", name: "Tel Ekir", levels: [{ id: "floor-1", name: "Canyon" }, { id: "floor-2", name: "Tunnels" }, { id: "floor-3", name: "Hidden rooms" }, { id: "floor-4", name: "Hin Adaru inner rooms" }] },
  { id: "keepers-bight", name: "Keeper’s Bight", levels: [] },
  { id: "fallen-watch", name: "Fallen Watch", levels: [{ id: "floor-1", name: "Ravine" }, { id: "floor-2", name: "Lower caves" }, { id: "floor-3", name: "Lvl 1 - Entrance halls" }, { id: "floor-4", name: "Lvl 2 - Barracks" }, { id: "floor-5", name: "Lvl 3 - Dining hall" }, { id: "floor-6", name: "Keep grounds" }, { id: "floor-7", name: "Upper towers" }] },
  { id: "shallow-shoals", name: "Shallow Shoals", levels: [] },
  { id: "glinting-hollow", name: "Glinting Hollow", levels: [] },
  { id: "sunken-resort", name: "Sunken Resort", levels: [{ id: "floor-1", name: "Floor -1" }, { id: "floor-2", name: "Floor -2" }, { id: "floor-3", name: "Floor -3" }, { id: "floor-4", name: "Caves" }] },
  { id: "rothold", name: "Rothold", levels: [{ id: "level-1", name: "Caves" }, { id: "level-2", name: "Keep floor 0" }, { id: "level-3", name: "Keep floor -1" }, { id: "level-4", name: "Keep floor -2 and Crypt" }, { id: "level-5", name: "Keep floor -3" }] },
  { id: "grimtide-sanctum", name: "Grimtide Sanctum", levels: [{ id: "floor-1", name: "Sanctum halls" }, { id: "floor-2", name: "Flooded tunnels" }, { id: "floor-3", name: "Sunken cavern" }] },
];

/** Zone names (as the leveling data spells them) that don't match an atlas map's name. */
const ZONE_ALIASES: Record<string, string> = {
  'night harbor east': 'night-harbor',
  telekir: 'tel-ekir',
};

const norm = (s: string) => s.toLowerCase().replace(/[’'`]/g, '').replace(/\s+/g, ' ').trim();

/** The atlas map for a zone name ("Tel'Ekir" -> tel-ekir, "Tomb of the Last Wyrmsbane" -> wyrmsbane-tomb), if any. */
export function atlasMapForZone(zone: string): AtlasMap | undefined {
  const key = norm(zone);
  const id = ZONE_ALIASES[key];
  return ATLAS_MAPS.find((m) => (id ? m.id === id : norm(m.name) === key));
}

/**
 * The address of a map embed: one map (optionally on a level), or a search for a place / NPC across all maps.
 * Uses the atlas's compact embed (embed=1) rather than its single-map embed (embed=map): the single-map embed only
 * zooms with the scroll wheel after the map is clicked, the compact one zooms as soon as the mouse is over it.
 */
export function atlasEmbedUrl(map: string, level: string | null, find: string | null): string {
  if (find) return `${ATLAS_URL}?find=${encodeURIComponent(find)}&embed=1`;
  return `${ATLAS_URL}${encodeURIComponent(map)}/?embed=1${level ? '&level=' + encodeURIComponent(level) : ''}`;
}

/** The same view in the full atlas, for "open in a new tab". */
export function atlasFullUrl(map: string, level: string | null, find: string | null): string {
  if (find) return `${ATLAS_URL}?find=${encodeURIComponent(find)}`;
  return `${ATLAS_URL}${encodeURIComponent(map)}/${level ? '?level=' + encodeURIComponent(level) : ''}`;
}

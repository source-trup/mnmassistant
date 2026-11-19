import { GearDrop, GearItem, SLOT_TYPES, STATS, SlotType, Stat } from './gear';

/** Trims Worth the Camp's items.json (https://worththecamp.com/api) to what the Gear Planner uses. */

const SLOTS = new Set<string>(SLOT_TYPES);
const STAT_SET = new Set<string>(STATS);

/** Wearable items only, with just what the planner uses. Drops and observed drops are merged by NPC. */
export function trimItems(raw: any): GearItem[] {
  const list: any[] = Array.isArray(raw?.items) ? raw.items : [];
  const out: GearItem[] = [];
  for (const i of list) {
    if (!i || !Number.isInteger(i.id) || typeof i.name !== 'string') continue;
    const slots = (Array.isArray(i.slots) ? i.slots : []).filter((s: unknown): s is SlotType => typeof s === 'string' && SLOTS.has(s));
    if (!slots.length) continue;
    const stats: Partial<Record<Stat, number>> = {};
    for (const [k, v] of Object.entries(i.stats ?? {})) {
      if (STAT_SET.has(k) && Number.isFinite(v) && v) stats[k as Stat] = v as number;
    }
    const drops = new Map<string, GearDrop>();
    const addDrop = (d: any, observed: boolean) => {
      if (!d || typeof d.npc !== 'string' || !d.npc.trim()) return;
      const npc = npcIdOf(d);
      const had = drops.get(npc);
      const entry: GearDrop = had ?? { npc, name: d.npc.trim(), zone: typeof d.zone === 'string' ? d.zone : '', rate: null, kills: null };
      if (observed && Number.isFinite(d.rate)) {
        entry.rate = d.rate;
        entry.kills = Number.isFinite(d.corpses) ? d.corpses : null;
      }
      drops.set(npc, entry);
    };
    for (const d of Array.isArray(i.drops) ? i.drops : []) addDrop(d, false);
    for (const d of Array.isArray(i.observed_drops) ? i.observed_drops : []) addDrop(d, true);
    const dmg = Number(i.stats?.damage) || 0;
    const delay = Number(i.stats?.delay) || 0;
    out.push({
      id: i.id,
      name: i.name.trim(),
      slots,
      stats,
      dmg,
      delay,
      twoHand: typeof i.skill === 'string' && /2H/.test(i.skill),
      classes: strings(i.classes),
      races: strings(i.races),
      flags: strings(i.flags),
      crafted: typeof i.crafted === 'string' && i.crafted.trim() ? i.crafted.trim() : null,
      drops: [...drops.values()],
      icon: iconOf(i),
    });
  }
  return out;
}

/** The NPC's id: the slug at the end of its Worth the Camp link (or made from its name when there's no link). */
function npcIdOf(d: any): string {
  if (typeof d.npc_url === 'string' && d.npc_url.includes('/npc/')) return decodeURIComponent(d.npc_url.split('/npc/').pop()!);
  return d.npc
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The icon's file name on Worth the Camp, unless it's their placeholder. */
function iconOf(i: any): string | null {
  const prefix = 'https://worththecamp.com/icons/';
  if (i.icon_placeholder === true || typeof i.icon_url !== 'string' || !i.icon_url.startsWith(prefix)) return null;
  const file = decodeURIComponent(i.icon_url.slice(prefix.length));
  return file && !file.includes('/') && file !== 'placeholder.png' ? file : null;
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && !!s) : [];
}

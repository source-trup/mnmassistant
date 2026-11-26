/** What a page is about, for building its monstersandmemories.wiki address. */
export type SiteKind = 'item' | 'npc';

export const DOT_WIKI = 'https://monstersandmemories.wiki/';

/** A name the way monstersandmemories.wiki writes it in addresses: "Mia Tarcut" → "mia-tarcut". */
export function dotWikiSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A page on monstersandmemories.wiki built from a name, the way the site names them: items at /items/<slug>
 * ("Arcane Set Priest's Faceguard" → /items/arcane-set-priests-faceguard) and NPCs at /npcs/<slug>. The site can't be
 * asked whether the page exists, so this is a best guess.
 */
export function dotWikiUrl(name: string, kind: SiteKind): string {
  return `${DOT_WIKI}${kind === 'npc' ? 'npcs' : 'items'}/${dotWikiSlug(name)}`;
}

/**
 * What a Miraheze wiki page is about, from its categories: NPC pages sit in "NPCs" or "<zone> NPCs" (or a merchants
 * category), item pages in "Items", "<class> Equipment", "<stat> Items", a slot and the like. Null for anything else
 * (zones, quests, spells…), which has no address on monstersandmemories.wiki the app can build.
 */
export function wikiPageKind(categories: readonly string[]): SiteKind | null {
  const cats = categories.map((c) => c.replace(/_/g, ' ').trim());
  if (cats.some((c) => /(^|\s)NPCs$/i.test(c) || /(^|\s)Merchants?$/i.test(c) || c === 'MemorialNPC')) return 'npc';
  const ITEM = /^(Items?|Inventory Items|Magic Items|Legacy Item|Armor|Jewelry|Clickies|Ammo|Food|Drink|Instruments|Bags & Containers)$/i;
  if (cats.some((c) => ITEM.test(c) || /\s(Equipment|Items)$/i.test(c))) return 'item';
  return null;
}

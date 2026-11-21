// Small, made-up stand-ins for the outside sites the app reads, shaped like the real responses.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ---------- MnMdb (https://mnm-db.com) ----------

/** auctions.json, built fresh each call so "seen" times are relative to now. */
export function mnmdbAuctions() {
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const sell = (player: string, unit: number, msAgo: number, stack?: number) => ({
    server: 'Trem',
    intent: 'sell',
    item: 'Iron Ore',
    price: stack ? unit * stack : unit,
    unit,
    priceStr: '',
    ...(stack ? { stack, perStack: true } : {}),
    player,
    seen: iso(msAgo),
    count: 3,
    matched: true,
  });
  return {
    generatedAt: iso(0),
    capture: {},
    listings: [
      // Iron Ore: asks 20, 25, 30, 40 (last 30 days; the 40c one is 10 days old) and one 40-day-old listing.
      sell('Ann', 20, 2 * HOUR, 20),
      sell('Bob', 25, 1 * DAY),
      sell('Cid', 30, 3 * DAY),
      sell('Dee', 40, 10 * DAY),
      sell('Old', 5, 40 * DAY),
      { server: 'Trem', intent: 'buy', item: 'Iron Ore', price: 300, unit: 15, stack: 20, perStack: true, player: 'Wanter', seen: iso(HOUR), count: 1, matched: true },
      // Copper Ore and Wood for checklist pricing.
      { server: 'Trem', intent: 'sell', item: 'Copper Ore', price: 10, unit: 10, player: 'Ann', seen: iso(HOUR), count: 1, matched: true },
      { server: 'Trem', intent: 'sell', item: 'Copper Ore', price: 14, unit: 14, player: 'Bob', seen: iso(HOUR), count: 1, matched: true },
      { server: 'Trem', intent: 'sell', item: 'Copper Ore', price: 12, unit: 12, player: 'Cid', seen: iso(HOUR), count: 1, matched: true },
      { server: 'Trem', intent: 'sell', item: 'Wood', price: 5, unit: 5, player: 'Ann', seen: iso(HOUR), count: 1, matched: true },
      // Another server: ignored.
      { server: 'Other', intent: 'sell', item: 'Iron Ore', price: 9999, unit: 9999, player: 'X', seen: iso(HOUR), count: 1, matched: true },
    ],
    requests: [],
    stats: {
      'iron ore': { name: 'Iron Ore', icon: null, flags: [], slot: null, stats: {}, resists: {}, zones: ['Glass Flats'], from: ['Iron Vein'], tradeskills: ['Smelting'] },
      'silver comb of house torvald': {
        name: 'Silver Comb of House Torvald',
        icon: null,
        flags: ['MAGIC', 'UNIQUE'],
        slot: 'HEAD',
        ac: 24,
        stats: { INT: 4, CHA: 3 },
        mana: 30,
        resists: {},
        class: 'SHM CLR',
        zones: ['Fallen Pass'],
        from: ['Handmaiden Mira'],
        tradeskills: [],
      },
      'rusty dagger': { name: 'Rusty Dagger', icon: null, flags: [], slot: 'PRIMARY', stats: {}, resists: {}, zones: [], from: [], tradeskills: [] },
    },
    stacks: {},
  };
}

export const mnmdbEa = {
  generatedAt: new Date().toISOString(),
  era: 'early-access',
  items: [
    { id: 'iron_ore', name: 'Iron Ore', droppedBy: [], prices: [{ copper: 1, count: 5 }, { copper: 2, count: 1 }], harvested: 40, zones: ['Glassflats'] },
    { id: 'bat_wing', name: 'Bat Wing', droppedBy: [{ mob: 'a cave bat', drops: 6, corpses: 20, rate: 0.3 }], prices: [{ copper: 4, count: 3 }], harvested: 0, zones: [] },
  ],
};

export const mnmdbVendors = { vendors: [{ name: 'A miner', sells: ['Iron Ore'], buys: [], zone: 'Night Harbor' }] };

// ---------- The community wiki (MediaWiki API) ----------

const PAGES: Record<string, { html: string }> = {
  'Silver Comb of House Torvald': {
    html: '<div class="mw-parser-output"><p>A silver comb carried by Handmaiden Mira.</p></div>',
  },
  'Night Terror': {
    html:
      '<div class="mw-parser-output"><style>.x{color:red}</style><p onclick="alert(1)">A rare <b>bat</b> that only comes out at night.</p>' +
      '<script>window.__pwned = true</script><ul><li><a href="/wiki/Night_Terror%27s_Wing">Night Terror\'s Wing</a></li>' +
      '<li><a href="/w/index.php?title=Missing_Page&amp;action=edit&amp;redlink=1" class="new">Missing Page</a></li>' +
      '<li><a href="/wiki/Category:NPCs">NPCs</a></li></ul></div>',
  },
  "Night Terror's Wing": { html: '<div class="mw-parser-output"><p>A wing from the giant bat known as Night Terror.</p></div>' },
  'Iron Ore': { html: '<div class="mw-parser-output"><p>Ore used in Smelting.</p></div>' },
  Shaman: { html: '<div class="mw-parser-output"><h2>Description</h2><p>Shamans commune with spirits.</p></div>' },
  'Night Harbor': { html: '<div class="mw-parser-output"><p>A port city.</p></div>' },
  // The left-hand sidebar shows the in-game time; the wiki fills it from this page.
  'Main Page': { html: '<div class="mw-parser-output"><p>Welcome.</p></div>' },
};

/** The wiki's sidebar clock gadget (the lines the app checks). */
export const gadgetSource = `function updateClockAndDate() {
  let now = new Date();
  let utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0);
  let msSinceMidnight = now.getTime() - utcMidnight;
  let totalRealMinutes = msSinceMidnight / 60000;
  let totalInGameMinutes = (totalRealMinutes * 20) % 1440;
}`;

/** Answers the subset of the MediaWiki API the app uses. */
export function wikiApi(q: URLSearchParams): unknown {
  const action = q.get('action');
  if (action === 'parse') {
    const title = q.get('page') ?? '';
    const page = PAGES[title];
    return page ? { parse: { title, pageid: 1, text: page.html } } : { error: { code: 'missingtitle' } };
  }
  if (action === 'query' && q.get('list') === 'search') {
    const term = (q.get('srsearch') ?? '').toLowerCase();
    const hits = Object.keys(PAGES)
      .filter((t) => t.toLowerCase().includes(term))
      .map((title) => ({ ns: 0, title, snippet: `About <span class="searchmatch">${title}</span>` }));
    return { query: { searchinfo: { totalhits: hits.length }, search: hits } };
  }
  if (action === 'query' && q.get('prop') === 'revisions') {
    const title = q.get('titles') ?? '';
    const content = title === 'MediaWiki:Gadget-mnmGameTimeSidebar.js' ? gadgetSource : undefined;
    return { query: { pages: [content ? { title, revisions: [{ slots: { main: { content } } }] } : { title, missing: true }] } };
  }
  if (action === 'query' && q.get('list') === 'allimages') {
    // Item icons, two pages: the app follows "continue" until there's none.
    const file = (n: string) => ({ name: n, url: `https://static.wikitide.net/monstersandmemorieswiki/0/00/${n}` });
    return q.get('aicontinue')
      ? { query: { allimages: [file('Itemicon0103AB.png')] } }
      : { continue: { aicontinue: 'Itemicon0103AB.png' }, query: { allimages: [file('Itemicon0001.png'), file('Itemicon0102AA.png')] } };
  }
  if (action === 'query' && q.get('titles')) {
    const titles = (q.get('titles') ?? '').split('|');
    return { query: { pages: titles.map((t) => (PAGES[t] ? { title: t, pageid: 1 } : { title: t, missing: true })) } };
  }
  return { error: { code: 'unsupported' } };
}

// ---------- MnM Atlas ----------

export function atlasPage(url: string): string {
  return `<!doctype html><title>Atlas</title><body><p id="where">${url}</p></body>`;
}

// ---------- Worth the Camp (Data API) ----------

const WTC_ATTRIBUTION =
  'Item, NPC and zone data adapted from the Monsters & Memories community wiki (https://monstersandmemories.miraheze.org/) by Worth the Camp (https://worththecamp.com/). Credit both, link the license, and share adaptations under CC BY-SA 4.0.';

const npc = (id: string, name: string, zone: string, lo: number | null, hi: number | null, drops = 0, raid = false) => ({
  id,
  name,
  url: `https://worththecamp.com/npc/${id}`,
  zone,
  level_min: lo,
  level_max: hi,
  raid,
  item_ids: Array.from({ length: drops }, (_, i) => i + 1),
  source_url: null,
});

/** A Shaman (solo tier A) at level 20 aims for mobs 17–19, named 15–17. */
export const wtcNpcs = {
  api_version: 1,
  attribution: WTC_ATTRIBUTION,
  npcs: [
    npc('a-mud-gnoll', 'A mud gnoll', 'Blind Midden', 17, 18, 3),
    npc('a-gnoll-digger', 'A gnoll digger', 'Blind Midden', 18, 19, 1),
    npc('ferg-the-filthy', 'Ferg the Filthy', 'Blind Midden', 15, 15, 3),
    npc('a-gnoll-pup', 'A gnoll pup', 'Blind Midden', 5, 6),
    npc('a-lawbreaker', 'A lawbreaker', 'Night Harbor', 17, 17, 16),
    npc('a-river-pirate', 'A river pirate', 'Night Harbor', 19, 19, 21),
    npc('a-scrawny-rat', 'A scrawny rat', 'Night Harbor', 1, 2),
    npc('a-harbor-guard', 'A harbor guard', 'Night Harbor', 40, 40),
    npc('a-bloodynose-stabber', 'A Bloodynose stabber', 'Tel Ekir', 16, 18, 2),
    npc('the-tyrant', 'The Tyrant', 'Tel Ekir', 18, 18, 9, true),
    npc('a-mystery-mob', 'A mystery mob', 'Tel Ekir', null, null),
    npc('a-shallows-basilisk', 'A shallows basilisk', 'Great Cavern Sea', 30, 31, 1),
  ],
};

export const wtcZones = {
  api_version: 1,
  attribution: WTC_ATTRIBUTION,
  zones: [
    { id: 'blind-midden', name: 'Blind Midden', url: 'https://worththecamp.com/npcs/blind-midden', level_min: 7, level_max: 25, npc_ids: [] },
    { id: 'night-harbor', name: 'Night Harbor', url: 'https://worththecamp.com/npcs/night-harbor', level_min: 1, level_max: 50, npc_ids: [] },
  ],
};

export const wtcMeta = {
  api_version: 1,
  classes: [
    { class: 'Shaman', solo: { grade: 'A' } },
    { class: 'Fighter', solo: { grade: 'D' } },
    { class: 'Druid', solo: { grade: 'S' } },
  ],
};

const item = (
  id: number,
  name: string,
  slots: string[],
  stats: Record<string, number>,
  extra: { classes?: string[]; races?: string[]; flags?: string[]; skill?: string; crafted?: string; drops?: string[]; observed?: { npc: string; rate: number; corpses: number }[]; icon?: string } = {},
) => ({
  id,
  name,
  url: `https://worththecamp.com/item/${id}`,
  slots,
  stats,
  classes: extra.classes ?? [],
  races: extra.races ?? [],
  flags: extra.flags ?? [],
  required_level: null,
  skill: extra.skill ?? null,
  crafted: extra.crafted ?? null,
  drops: (extra.drops ?? []).map((id) => ({ zone: 'Somewhere', npc: id.replace(/-/g, ' '), npc_url: `https://worththecamp.com/npc/${id}` })),
  observed_drops: (extra.observed ?? []).map((o) => ({ npc: o.npc.replace(/-/g, ' '), npc_url: `https://worththecamp.com/npc/${o.npc}`, zone: 'Somewhere', rate: o.rate, drops: 1, corpses: o.corpses })),
  recipes: [],
  icon_url: `https://worththecamp.com/icons/${extra.icon ?? 'placeholder.png'}`,
  icon_placeholder: !extra.icon,
});

/**
 * Items for the Gear Planner. For a level 18 Shaman (Wisdom and Stamina Primary): drops from the gnoll (17–18) and the
 * pirate (19) are around their level, the guard (40) isn't, the Tyrant is a raid boss.
 */
export const wtcItems = {
  api_version: 1,
  attribution: WTC_ATTRIBUTION,
  items: [
    item(1, 'Gnollhide Cap', ['head'], { ac: 3, wis: 2 }, { drops: ['a-mud-gnoll'], observed: [{ npc: 'a-mud-gnoll', rate: 0.12, corpses: 50 }] }),
    item(2, 'Pirate Bandana', ['head'], { ac: 2, wis: 5, sta: 3 }, { drops: ['a-river-pirate'], icon: 'Itemicon0001.png' }),
    item(3, 'Guard Helm', ['head'], { ac: 15, wis: 10, sta: 10 }, { drops: ['a-harbor-guard'] }),
    item(4, "Tyrant's Crown", ['head'], { ac: 20, wis: 20 }, { drops: ['the-tyrant'], flags: ['NO DROP'] }),
    item(5, 'Forged Wisdom Circlet', ['head'], { wis: 7 }, { crafted: 'Smithing (trivial 40)' }),
    item(6, 'Mystic Hood', ['head'], { wis: 30 }),
    item(7, 'Fighter Helm', ['head'], { ac: 9, str: 9, sta: 9 }, { classes: ['Fighter'], drops: ['a-mud-gnoll'] }),
    item(8, 'Gnomish Goggles', ['face'], { wis: 4 }, { races: ['Gnm'], drops: ['a-mud-gnoll'] }),
    item(9, 'Pirate Ring', ['finger'], { wis: 3, mana: 10 }, { drops: ['a-river-pirate'] }),
    item(10, 'Gnoll Toe Ring', ['finger'], { sta: 2 }, { drops: ['a-mud-gnoll'] }),
    item(11, 'Pirate Cutlass', ['primary', 'offhand'], { damage: 7, delay: 25, str: 2 }, { skill: 'SLA', drops: ['a-river-pirate'] }),
    item(12, 'Gnoll Bonestaff', ['primary'], { damage: 12, delay: 40, wis: 4, sta: 2 }, { skill: 'BLG 2H', drops: ['a-mud-gnoll'] }),
    item(13, 'Driftwood Shield', ['offhand'], { ac: 6, sta: 2 }, { drops: ['a-river-pirate'] }),
    item(14, 'A pile of bones', [], {}),
  ],
};

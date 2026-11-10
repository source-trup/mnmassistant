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

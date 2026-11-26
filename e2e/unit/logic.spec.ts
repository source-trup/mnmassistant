import { expect, test } from '@playwright/test';
import { findFreeSpot, fitRect, makeRoom, overlaps, pushDown, pushSideways, sizeOf } from '../../src/app/layout';
import { LEVEL_CHART, highestPartner, levelDiff, lowestPartner } from '../../src/app/level-range/level-range';
import { formatItem, parseChecklist, parseLine } from '../../src/app/note-card/checklist-parse';
import { coin } from '../../src/app/prices/coin';
import { dotWikiUrl, wikiPageKind } from '../../src/app/site-links/site-urls';
import { formatAgo, formatDuration, parseDuration, spokenDuration } from '../../src/app/time';

test.describe('time', () => {
  test('parses every documented duration form', () => {
    expect(parseDuration('5')).toBe(5 * 60_000);
    expect(parseDuration('6:40')).toBe(400_000);
    expect(parseDuration('1:30:00')).toBe(90 * 60_000);
    expect(parseDuration('90s')).toBe(90_000);
    expect(parseDuration('1h30m')).toBe(90 * 60_000);
    expect(parseDuration('2m 15s')).toBe(135_000);
    expect(parseDuration('7:30')).toBe(450_000);
  });

  test('rejects empty, zero and nonsense', () => {
    for (const bad of ['', '0', '0:00', 'abc', '-5', '5x']) expect(parseDuration(bad), bad).toBeNull();
  });

  test('formats durations and ages', () => {
    expect(formatDuration(450_000)).toBe('7:30');
    expect(formatAgo(30_000)).toBe('30s');
    expect(formatAgo(5 * 60_000)).toBe('5m');
    expect(formatAgo(26 * 3_600_000)).toBe('1d 2h');
  });
});

test.describe('level range', () => {
  test('matches the published chart', () => {
    expect(LEVEL_CHART).toHaveLength(41);
    expect(levelDiff(13)).toBe(5);
    expect(levelDiff(14)).toBe(6);
    expect(levelDiff(41)).toBe(19);
    expect(LEVEL_CHART[40]).toEqual({ min: 41, diff: 19, max: 60 });
  });

  test('lowest and highest group partners', () => {
    expect([lowestPartner(18), highestPartner(18)]).toEqual([13, 26]);
    expect([lowestPartner(6), highestPartner(6)]).toEqual([1, 11]);
    expect([lowestPartner(60), highestPartner(60)]).toEqual([41, 60]);
  });
});

test.describe('checklist parsing', () => {
  test('bullet lists with counts', () => {
    const items = parseChecklist('-18xCopper Ore\n-10xWhitefish/Basa/Grouper\n-80xWood');
    expect(items).toEqual([
      { text: 'Copper Ore', qty: 18 },
      { text: 'Whitefish/Basa/Grouper', qty: 10 },
      { text: 'Wood', qty: 80 },
    ]);
  });

  test('the wiki materials table, including names split over two lines', () => {
    const table = 'Material\tTotal\tFrom\nCopper Ore\n\t18\tgathered or bought\nWhitefish\nor Basa or Grouper\n\t10\tgathered or bought\n';
    expect(parseChecklist(table)).toEqual([
      { text: 'Copper Ore', qty: 18, from: 'gathered or bought' },
      { text: 'Whitefish/Basa/Grouper', qty: 10, from: 'gathered or bought' },
    ]);
  });

  test('single lines in any order, and back to text', () => {
    expect(parseLine('Bone Chips x4')).toEqual({ text: 'Bone Chips', qty: 4 });
    expect(parseLine('5 Water Flask')).toEqual({ text: 'Water Flask', qty: 5 });
    expect(parseLine('[x] 2x Silk')).toEqual({ text: 'Silk', qty: 2 });
    expect(parseLine('   ')).toBeNull();
    expect(formatItem({ text: 'Tin Ore', qty: 14 })).toBe('14x Tin Ore');
  });
});

test.describe('coin', () => {
  test('formats copper with the two largest units', () => {
    expect(coin(0)).toBe('0c');
    expect(coin(30)).toBe('30c');
    expect(coin(2500)).toBe('25s');
    expect(coin(20_000)).toBe('2g');
    expect(coin(23_512)).toBe('2g 35s');
    expect(coin(1_040_000)).toBe('1p 4g');
    expect(coin(null)).toBe('–');
  });
});

test.describe('layout', () => {
  test('overlap and free spots', () => {
    const a = { x: 0, y: 0, w: 15, h: 10 };
    expect(overlaps(a, { x: 14, y: 0, w: 15, h: 10 })).toBe(true);
    expect(overlaps(a, { x: 15, y: 0, w: 15, h: 10 })).toBe(false);
    expect(findFreeSpot([a], 15, 10, 60)).toEqual({ x: 15, y: 0 });
    expect(findFreeSpot([a], 15, 10, 20)).toEqual({ x: 0, y: 10 });
  });

  test('saved size or the default', () => {
    expect(sizeOf({}, { w: 15, h: 10 })).toEqual({ w: 15, h: 10 });
    expect(sizeOf({ w: 20, h: 12 }, { w: 15, h: 10 })).toEqual({ w: 20, h: 12 });
  });
});

test.describe('spoken durations', () => {
  test('a time as said aloud in a warning', () => {
    expect(spokenDuration(30_000)).toBe('30 seconds');
    expect(spokenDuration(1_000)).toBe('1 second');
    expect(spokenDuration(60_000)).toBe('1 minute');
    expect(spokenDuration(135_000)).toBe('2 minutes 15 seconds');
    expect(spokenDuration(3_661_000)).toBe('1 hour 1 minute 1 second');
    expect(spokenDuration(400)).toBe('1 second');
  });
});

test.describe('fitting a dropped panel into a gap', () => {
  const left = { x: 0, y: 0, w: 15, h: 10 };
  const right = { x: 28, y: 0, w: 15, h: 10 };
  const min = { w: 13, h: 9 };

  test('shrinks to the gap, no smaller than its minimum', () => {
    expect(fitRect({ x: 15, y: 0, w: 15, h: 10 }, min, [left, right], 60)).toEqual({ x: 15, y: 0, w: 13, h: 10 });
    // A gap narrower than the minimum: nothing fits.
    expect(fitRect({ x: 15, y: 0, w: 15, h: 10 }, min, [left, { ...right, x: 26 }], 60)).toBeNull();
  });

  test('shrinks in height above a panel below', () => {
    const below = { x: 15, y: 9, w: 15, h: 10 };
    expect(fitRect({ x: 15, y: 0, w: 15, h: 10 }, min, [left, below], 60)).toEqual({ x: 15, y: 0, w: 15, h: 9 });
  });

  test('a full-size spot a cell or two away beats shrinking', () => {
    // Dropped one cell into the left panel: it slides right instead of getting narrower.
    expect(fitRect({ x: 14, y: 0, w: 15, h: 10 }, min, [left], 60)).toEqual({ x: 15, y: 0, w: 15, h: 10 });
    // Too far off to slide: no full-size spot within reach, so nothing fits there.
    expect(fitRect({ x: 5, y: 0, w: 15, h: 10 }, min, [left], 60)).toBeNull();
  });

  test('stays inside the board', () => {
    expect(fitRect({ x: 47, y: 0, w: 15, h: 10 }, min, [{ x: 40, y: 10, w: 5, h: 5 }], 60)).toEqual({ x: 46, y: 0, w: 15, h: 10 });
  });
});

test.describe('pushing panels aside for a drop', () => {
  test('the panel in the way moves down, and any it then lands on', () => {
    const a = { id: 'a', x: 0, y: 0, w: 15, h: 10 };
    const b = { id: 'b', x: 0, y: 12, w: 15, h: 10 };
    const c = { id: 'c', x: 30, y: 0, w: 15, h: 10 }; // not in the way
    const moved = pushDown({ x: 5, y: 0, w: 15, h: 10 }, [a, b, c]);
    expect([...moved]).toEqual([
      ['a', 10],
      ['b', 20],
    ]);
  });

  test('sideways first: each panel moves away from the side it is on, pushing its neighbours along', () => {
    const a = { id: 'a', x: 20, y: 0, w: 15, h: 10 };
    const b = { id: 'b', x: 35, y: 0, w: 15, h: 10 };
    const drop = { x: 14, y: 0, w: 15, h: 10 };
    expect([...pushSideways(drop, [a, b], 62)!]).toEqual([
      ['a', 29],
      ['b', 44],
    ]);
    // A panel on the left of the drop goes left.
    expect([...pushSideways({ x: 10, y: 0, w: 15, h: 10 }, [{ id: 'l', x: 12, y: 0, w: 4, h: 5 }], 62)!]).toEqual([['l', 6]]);
    const room = makeRoom(drop, [a, b], 62);
    expect(room.how).toBe('aside');
    expect(room.moves.get('a')).toEqual({ x: 29, y: 0 });
  });

  test('down when sideways would push a panel off the board', () => {
    const a = { id: 'a', x: 20, y: 0, w: 15, h: 10 };
    expect(pushSideways({ x: 14, y: 0, w: 15, h: 10 }, [a], 40)).toBeNull();
    expect(makeRoom({ x: 14, y: 0, w: 15, h: 10 }, [a], 40)).toEqual({ how: 'down', moves: new Map([['a', { x: 20, y: 10 }]]) });
    // Off the left edge too.
    expect(makeRoom({ x: 1, y: 0, w: 15, h: 10 }, [{ id: 'z', x: 0, y: 0, w: 15, h: 10 }], 62).how).toBe('down');
  });

  test('nothing overlaps afterwards', () => {
    const others = [
      { id: 'a', x: 0, y: 0, w: 15, h: 10 },
      { id: 'b', x: 15, y: 0, w: 15, h: 18 },
      { id: 'c', x: 0, y: 10, w: 30, h: 9 },
      { id: 'd', x: 10, y: 19, w: 15, h: 10 },
    ];
    const drop = { x: 8, y: 4, w: 15, h: 10 };
    const moved = pushDown(drop, others);
    const after = [drop, ...others.map((o) => ({ ...o, y: moved.get(o.id) ?? o.y }))];
    for (let i = 0; i < after.length; i++) for (let j = i + 1; j < after.length; j++) expect(overlaps(after[i], after[j])).toBe(false);
  });
});

test.describe('monstersandmemories.wiki links', () => {
  test('built from a name the way the site names its pages', () => {
    expect(dotWikiUrl("Arcane Set Priest's Faceguard", 'item')).toBe('https://monstersandmemories.wiki/items/arcane-set-priests-faceguard');
    expect(dotWikiUrl('Mia Tarcut', 'npc')).toBe('https://monstersandmemories.wiki/npcs/mia-tarcut');
    expect(dotWikiUrl('  Bracer of the Fallen (Legacy) ', 'item')).toBe('https://monstersandmemories.wiki/items/bracer-of-the-fallen-legacy');
    expect(dotWikiUrl('Élan Ring', 'item')).toBe('https://monstersandmemories.wiki/items/elan-ring');
  });

  test("a Miraheze page's kind from its categories", () => {
    expect(wikiPageKind(['NPCs', 'Fallen_Pass_NPCs'])).toBe('npc');
    expect(wikiPageKind(["Ail'Vorith Merchants"])).toBe('npc');
    expect(wikiPageKind(['Chest', 'Stamina_Items', 'Cleric_Equipment'])).toBe('item');
    expect(wikiPageKind(['Items'])).toBe('item');
    expect(wikiPageKind(['Fallen Pass Quests'])).toBeNull();
    expect(wikiPageKind(['Cleric Spells'])).toBeNull();
    expect(wikiPageKind([])).toBeNull();
  });
});

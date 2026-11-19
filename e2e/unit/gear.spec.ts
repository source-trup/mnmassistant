import { expect, test } from '@playwright/test';
import {
  FinderOptions,
  GearItem,
  NpcLevel,
  Wearer,
  defaultWeights,
  findUpgrades,
  gearClassName,
  itemIconUrl,
  itemScore,
  itemSummary,
  raceArt,
  recommend,
  weightsFor,
  wtcItemUrl,
} from '../../src/app/gear/gear';
import { trimItems } from '../../src/app/gear/gear-trim';

const gear = (id: number, name: string, slots: GearItem['slots'], stats: GearItem['stats'], extra: Partial<GearItem> = {}): GearItem => ({
  id,
  name,
  slots,
  stats,
  dmg: 0,
  delay: 0,
  twoHand: false,
  classes: [],
  races: [],
  flags: [],
  crafted: null,
  drops: [],
  icon: null,
  ...extra,
});

const drop = (npc: string) => ({ npc, name: npc, zone: 'Zone', rate: null, kills: null });

const NPCS = new Map<string, NpcLevel>([
  ['gnoll', { lo: 17, hi: 18, raid: false }],
  ['pirate', { lo: 19, hi: 19, raid: false }],
  ['guard', { lo: 40, hi: 40, raid: false }],
  ['tyrant', { lo: 18, hi: 18, raid: true }],
]);

const ALL: FinderOptions = { slot: null, maxMob: null, drops: true, crafted: true, quest: true, raid: true };
const shaman = (gearSet: Wearer['gear'] = {}): Wearer => ({ cls: 'Shaman', race: 'Dgn', gear: gearSet });

const ITEMS = [
  gear(1, 'Gnoll Cap', ['head'], { wis: 2 }, { drops: [drop('gnoll')] }),
  gear(2, 'Pirate Bandana', ['head'], { wis: 5 }, { drops: [drop('pirate')] }),
  gear(3, 'Guard Helm', ['head'], { wis: 20 }, { drops: [drop('guard')] }),
  gear(4, 'Tyrant Crown', ['head'], { wis: 30 }, { drops: [drop('tyrant')] }),
  gear(5, 'Forged Circlet', ['head'], { wis: 7 }, { crafted: 'Smithing (trivial 40)' }),
  gear(6, 'Mystic Hood', ['head'], { wis: 40 }),
  gear(7, 'Fighter Helm', ['head'], { wis: 50 }, { classes: ['Fighter'], drops: [drop('gnoll')] }),
  gear(8, 'Gnome Goggles', ['face'], { wis: 4 }, { races: ['Gnm'], drops: [drop('gnoll')] }),
  gear(9, 'Ring A', ['finger'], { wis: 3 }, { drops: [drop('pirate')] }),
  gear(10, 'Ring B', ['finger'], { wis: 1 }, { drops: [drop('gnoll')] }),
  gear(11, 'Cutlass', ['primary', 'offhand'], { str: 2 }, { dmg: 7, delay: 25, drops: [drop('pirate')] }),
  gear(12, 'Bonestaff', ['primary'], { wis: 4 }, { dmg: 12, delay: 40, twoHand: true, drops: [drop('gnoll')] }),
  gear(13, 'Driftwood Shield', ['offhand'], { wis: 1, sta: 2 }, { drops: [drop('pirate')] }),
];
const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
const names = (ups: { item: GearItem }[]) => ups.map((u) => u.item.name);

test.describe('gear weights', () => {
  test("are Arcane Ledger's per class; unlisted stats count 0", () => {
    const s = defaultWeights('Shaman');
    expect([s.wis, s.mana, s.sta, s.dex, s.hp, s.ac, s.str, s.int, s.sv_magic, s.weapon]).toEqual([1, 0.1, 0.2, 0.15, 0.05, 0.05, 0, 0, 0, 0]);
    const f = defaultWeights('Fighter');
    expect([f.sta, f.ac, f.hp, f.str, f.agi, f.dex, f.wis, f.mana]).toEqual([1, 0.4, 0.1, 0.7, 0.5, 0.3, 0, 0]);
    // Their Ratio is per damage ÷ delay × 100; it counts for melee and ranged weapons alike.
    expect([f.weapon, f.ranged]).toEqual([70, 70]);
    expect(defaultWeights('Rogue').weapon).toBe(120);
    expect(defaultWeights('Enchanter').cha).toBe(0.3);
    expect(defaultWeights(null).wis).toBe(0);
  });

  test("a character's changes override the defaults", () => {
    expect(weightsFor('Shaman', { wis: 2 }).wis).toBe(2);
    expect(weightsFor('Shaman', {}).wis).toBe(1);
  });

  test('class names are matched however they are written', () => {
    expect(gearClassName('shadow-knight')).toBe('Shadowknight');
    expect(gearClassName('Shadow Knight')).toBe('Shadowknight');
    expect(gearClassName('shaman')).toBe('Shaman');
    expect(gearClassName('nope')).toBeNull();
  });
});

test.describe('gear scoring', () => {
  test('stats times weights, plus the weapon ratio in weapon slots', () => {
    const w = defaultWeights('Fighter');
    const sword = gear(1, 'Sword', ['primary', 'offhand'], { str: 2 }, { dmg: 10, delay: 25 });
    expect(itemScore(sword, w, 'primary')).toBe(29.4); // 2 × 0.7 + 0.4 × 70
    expect(itemScore(sword, w, 'offhand')).toBe(29.4); // either hand
    expect(itemScore(gear(2, 'Cap', ['head'], { ac: 3, wis: 2 }), defaultWeights('Shaman'), 'head')).toBe(2.15);
    expect(itemSummary(sword)).toBe('10/25 · STR 2');
  });
});

test.describe('upgrade finder', () => {
  test('skips what your class or race cannot wear, and what you already wear', () => {
    const ups = findUpgrades(ITEMS, BY_ID, NPCS, shaman({ head: { id: 2, name: 'Pirate Bandana' } }), defaultWeights('Shaman'), ALL);
    const n = names(ups);
    expect(n).not.toContain('Fighter Helm');
    expect(n).not.toContain('Gnome Goggles');
    expect(n).not.toContain('Pirate Bandana');
    expect(n).not.toContain('Gnoll Cap'); // worse than the bandana
    expect(n.slice(0, 2)).toEqual(['Mystic Hood', 'Tyrant Crown']);
    expect(ups.find((u) => u.item.name === 'Guard Helm')!.gain).toBe(15);
  });

  test('filters by slot, mob level, raid and source', () => {
    const w = defaultWeights('Shaman');
    const heads = (opts: Partial<FinderOptions>) => names(findUpgrades(ITEMS, BY_ID, NPCS, shaman(), w, { ...ALL, slot: 'head', ...opts }));
    expect(heads({ maxMob: 19, crafted: false, quest: false, raid: false })).toEqual(['Pirate Bandana', 'Gnoll Cap']);
    expect(heads({ maxMob: 19, crafted: false, quest: false, raid: true })).toEqual(['Tyrant Crown', 'Pirate Bandana', 'Gnoll Cap']);
    expect(heads({ drops: false, quest: false })).toEqual(['Forged Circlet']);
    expect(heads({ drops: false, crafted: false })).toEqual(['Mystic Hood']);
  });

  test('pairs: an upgrade goes in place of the weaker ring', () => {
    const worn = shaman({ finger1: { id: 9, name: 'Ring A' } });
    const ring = findUpgrades(ITEMS, BY_ID, NPCS, worn, defaultWeights('Shaman'), { ...ALL, slot: 'finger' });
    expect(ring.map((u) => [u.item.name, u.position, u.gain])).toEqual([['Ring B', 'finger2', 1]]);
  });

  test('a two-hander is compared with both hands; offhands are skipped while you hold one', () => {
    const w = { ...defaultWeights('Shaman'), weapon: 50 };
    const sword = findUpgrades(ITEMS, BY_ID, NPCS, shaman({ primary: { id: 11, name: 'Cutlass' }, offhand: { id: 13, name: 'Driftwood Shield' } }), w, { ...ALL, slot: 'primary' });
    const staff = sword.find((u) => u.item.name === 'Bonestaff')!;
    expect(staff.replaces.map((i) => i.name)).toEqual(['Cutlass', 'Driftwood Shield']);
    // Staff: WIS 4 + 0.3 × 50 = 19. Cutlass: STR counts 0 for a Shaman, 0.28 × 50 = 14. Shield: WIS 1 + STA 2 × 0.2 = 1.4.
    expect(staff.gain).toBe(3.6);
    const holding = findUpgrades(ITEMS, BY_ID, NPCS, shaman({ primary: { id: 12, name: 'Bonestaff' } }), w, { ...ALL, slot: 'offhand' });
    expect(holding).toEqual([]);
  });

  test('shows the easiest drop first, with how many more', () => {
    const multi = gear(20, 'Common Hat', ['head'], { wis: 1 }, { drops: [drop('guard'), drop('gnoll'), drop('pirate')] });
    const [u] = findUpgrades([multi], new Map(), NPCS, shaman(), defaultWeights('Shaman'), ALL);
    expect(u.how).toMatchObject({ kind: 'drop', drop: { npc: 'gnoll', lo: 17, hi: 18 }, more: 2 });
  });
});

test.describe('recommended upgrades', () => {
  test('drops from non-raid mobs up to 3 levels above you, the best one per slot', () => {
    // Both rings (one per finger); the staff is two-handed, so no shield with it.
    const recs = recommend(ITEMS, BY_ID, NPCS, shaman(), defaultWeights('Shaman'), 16);
    expect(recs.map((r) => [r.item.name, r.position, r.gain])).toEqual([
      ['Pirate Bandana', 'head', 5],
      ['Bonestaff', 'primary', 4],
      ['Ring A', 'finger1', 3],
      ['Ring B', 'finger2', 1],
    ]);
    expect(recs.every((r) => r.how.kind === 'drop')).toBe(true);
    // Level 15: the pirate (19) is out of reach.
    expect(names(recommend(ITEMS, BY_ID, NPCS, shaman(), defaultWeights('Shaman'), 15))).toEqual(['Bonestaff', 'Gnoll Cap', 'Ring B']);
  });

  test('a second ring replaces the weaker one you wear', () => {
    const worn = shaman({ finger1: { id: 10, name: 'Ring B' }, finger2: { id: 9, name: 'Ring A' } });
    const better = gear(30, 'Ring C', ['finger'], { wis: 6 }, { drops: [drop('gnoll')] });
    const best = gear(31, 'Ring D', ['finger'], { wis: 8 }, { drops: [drop('gnoll')] });
    const items = [...ITEMS, better, best];
    const recs = recommend(items, new Map(items.map((i) => [i.id, i])), NPCS, worn, defaultWeights('Shaman'), 16);
    const rings = recs.filter((r) => r.item.slots.includes('finger'));
    expect(rings.map((r) => [r.item.name, r.position, r.replaces[0]?.name, r.gain])).toEqual([
      ['Ring D', 'finger1', 'Ring B', 7],
      ['Ring C', 'finger2', 'Ring A', 3],
    ]);
  });
});

test.describe("Worth the Camp's items", () => {
  test('wearable items only; drops and observed drop rates merged by NPC', () => {
    const items = trimItems({
      items: [
        {
          id: 7,
          name: 'Skull of Malen`Kai ',
          slots: ['head', 'bogus'],
          stats: { ac: 3, damage: 5, delay: 30, block: 1 },
          classes: [],
          races: ['Dgn'],
          flags: ['MAGIC'],
          skill: 'BLG 2H',
          crafted: null,
          drops: [{ zone: 'Blind Midden', npc: 'A mud gnoll', npc_url: 'https://worththecamp.com/npc/a-mud-gnoll' }, { zone: 'X', npc: "Ferg's pet", npc_url: null }],
          observed_drops: [{ npc: 'A mud gnoll', npc_url: 'https://worththecamp.com/npc/a-mud-gnoll', zone: 'Blind Midden', rate: 0.25, drops: 5, corpses: 20 }],
          icon_url: 'https://worththecamp.com/icons/Itemicon0098AA.png',
          icon_placeholder: false,
        },
        { id: 8, name: 'Bone', slots: [], stats: {} },
        { id: 9, name: 'Plain Ring', slots: ['finger'], stats: {}, icon_url: 'https://worththecamp.com/icons/placeholder.png', icon_placeholder: true },
      ],
    });
    expect(items).toEqual([
      {
        id: 7,
        name: 'Skull of Malen`Kai',
        slots: ['head'],
        stats: { ac: 3 },
        dmg: 5,
        delay: 30,
        twoHand: true,
        classes: [],
        races: ['Dgn'],
        flags: ['MAGIC'],
        crafted: null,
        drops: [
          { npc: 'a-mud-gnoll', name: 'A mud gnoll', zone: 'Blind Midden', rate: 0.25, kills: 20 },
          { npc: 'fergs-pet', name: "Ferg's pet", zone: 'X', rate: null, kills: null },
        ],
        icon: 'Itemicon0098AA.png',
      },
      { id: 9, name: 'Plain Ring', slots: ['finger'], stats: {}, dmg: 0, delay: 0, twoHand: false, classes: [], races: [], flags: [], crafted: null, drops: [], icon: null },
    ]);
    expect(itemIconUrl(items[0])).toBe('https://worththecamp.com/icons/Itemicon0098AA.png');
    expect(itemIconUrl(items[1])).toBeNull();
    expect(wtcItemUrl(items[0])).toBe('https://worththecamp.com/item/7-skull-of-malenkai');
  });
});

test.describe('races', () => {
  test("every race on the official page, with Worth the Camp's codes and both portraits", () => {
    expect(raceArt('Dgn', 'm')).toMatch(/^https:\/\/images\.squarespace-cdn\.com\/.+\/DeepGnomeM\.png$/);
    expect(raceArt('Dgn', 'f')).toMatch(/DeepGnomeF\.png$/);
    expect(raceArt(null, 'm')).toBeNull();
  });
});

import { expect, test } from '@playwright/test';
import { WtcNpc, conOf, isNamed, levelingPlan, targetFor, wtcLevelingUrl, wtcZoneUrl } from '../../src/app/leveling/wtc-leveling';

const npc = (name: string, zone: string, lo: number, hi = lo, drops = 0): WtcNpc => ({ id: name.toLowerCase().replace(/\W+/g, '-'), name, zone, lo, hi, drops });

test.describe('leveling spots: Worth the Camp rules', () => {
  test('solo targets follow the class tier; group aims 2–3 above; named 2 lower', () => {
    expect(targetFor(20, 'solo', 'S')).toEqual({ lo: 17, hi: 20, namedLo: 15, namedHi: 18 });
    expect(targetFor(20, 'solo', 'A')).toEqual({ lo: 17, hi: 19, namedLo: 15, namedHi: 17 });
    expect(targetFor(20, 'solo', 'B')).toMatchObject({ lo: 16, hi: 18 });
    expect(targetFor(20, 'solo', 'C')).toMatchObject({ lo: 15, hi: 17 });
    expect(targetFor(20, 'solo', 'D')).toMatchObject({ lo: 14, hi: 16 });
    expect(targetFor(40, 'group', 'D')).toEqual({ lo: 42, hi: 43, namedLo: 40, namedHi: 41 });
    // Never below level 1.
    expect(targetFor(2, 'solo', 'D')).toEqual({ lo: 1, hi: 1, namedLo: 1, namedHi: 1 });
  });

  test('named means not "a …" / "an …"', () => {
    expect(isNamed('A lawbreaker')).toBe(false);
    expect(isNamed('an ashira guard')).toBe(false);
    expect(isNamed('Ferg the Filthy')).toBe(true);
    expect(isNamed('Anvilbreaker')).toBe(true);
  });

  test('con colours around your level', () => {
    const at20 = [14, 15, 16, 17, 19, 20, 21, 22, 23, 30].map((l) => conOf(l, 20));
    expect(at20).toEqual(['grey', 'green', 'lightblue', 'blue', 'blue', 'white', 'yellow', 'yellow', 'red', 'red']);
  });

  test('zones rank by mobs in range; a level range only has to overlap; hubs count for less', () => {
    const npcs = [
      npc('A mud gnoll', 'Blind Midden', 17, 18),
      npc('A gnoll digger', 'Blind Midden', 19, 21), // overlaps at 19
      npc('Ferg the Filthy', 'Blind Midden', 15), // named: matched at 15–17
      npc('Big Boss', 'Blind Midden', 19), // named at 19: too high for named
      npc('A lawbreaker', 'Night Harbor', 17),
      npc('A river pirate', 'Night Harbor', 18),
      npc('A thug', 'Night Harbor', 19),
      npc('A guard', 'Night Harbor', 45), // spreads the zone: a hub
      npc('A stabber', 'Tel Ekir', 16, 18),
      npc('A crab', 'Tel Ekir', 18),
      npc('A newt', 'Starter Glade', 3),
    ];
    const plan = levelingPlan(npcs, 20, 'solo', 'A');
    // Night Harbor has 3 in range but is a hub (3 × 0.6 = 1.8), so 2 in Tel Ekir beat it.
    expect(plan.map((z) => [z.zone, z.npcs.length, z.hub])).toEqual([
      ['Blind Midden', 3, false],
      ['Tel Ekir', 2, false],
      ['Night Harbor', 3, true],
    ]);
    // Regulars lowest first, then the named; con judged at the highest level.
    expect(plan[0].npcs.map((n) => [n.name, n.named, n.con])).toEqual([
      ['A mud gnoll', false, 'blue'],
      ['A gnoll digger', false, 'yellow'],
      ['Ferg the Filthy', true, 'green'],
    ]);
    expect(plan[0]).toMatchObject({ zoneLo: 15, zoneHi: 21 });
  });

  test('links to Worth the Camp', () => {
    expect(wtcLevelingUrl('Shaman', 20, 'solo')).toBe('https://worththecamp.com/leveling?cls=Shaman&lvl=20&mode=solo');
    expect(wtcLevelingUrl(null, null, 'group')).toBe('https://worththecamp.com/leveling?mode=group');
    const zones = [{ name: "Ail'Vorith", url: 'https://worththecamp.com/npcs/ailvorith' }];
    expect(wtcZoneUrl("ail'vorith", zones)).toBe('https://worththecamp.com/npcs/ailvorith');
    expect(wtcZoneUrl("Keeper's Bight", zones)).toBe('https://worththecamp.com/npcs/keepers-bight');
  });
});

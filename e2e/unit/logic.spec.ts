import { expect, test } from '@playwright/test';
import { findFreeSpot, overlaps, sizeOf } from '../../src/app/layout';
import { LEVEL_CHART, highestPartner, levelDiff, lowestPartner } from '../../src/app/level-range/level-range';
import { formatItem, parseChecklist, parseLine } from '../../src/app/note-card/checklist-parse';
import { coin } from '../../src/app/prices/coin';
import { formatAgo, formatDuration, parseDuration } from '../../src/app/time';

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

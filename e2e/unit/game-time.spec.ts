import { expect, test } from '@playwright/test';
import {
  formatGameClock,
  formatGameHour,
  gameTime,
  msUntilGameMinute,
  ordinal,
  speedFromGadget,
  windowStatus,
} from '../../src/app/game-clock/game-time';

/**
 * The wiki sidebar clock's own calculation (MediaWiki:Gadget-mnmGameTimeSidebar.js), copied as the reference the
 * app must agree with.
 */
function wikiClock(now: Date) {
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0);
  const msSinceMidnight = now.getTime() - utcMidnight;
  const totalRealMinutes = msSinceMidnight / 60000;
  const totalInGameMinutes = (totalRealMinutes * 20) % 1440;
  const hours = Math.floor(totalInGameMinutes / 60);
  const minutes = Math.floor(totalInGameMinutes % 60);
  let dayOf20 = Math.floor((msSinceMidnight / 86400000) * 20) + 1;
  if (dayOf20 > 20) dayOf20 = 20;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
  return { time: `${displayHours}:${displayMinutes} ${period}`, day: dayOf20 };
}

const GADGET_SOURCE = `let totalRealMinutes = msSinceMidnight / 60000;
let utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0);
let totalInGameMinutes = (totalRealMinutes * 20) % 1440;`;

test.describe('game time', () => {
  test('agrees with the wiki clock across a whole real day', () => {
    const start = Date.UTC(2026, 10, 10, 0, 0, 0);
    for (let t = start; t < start + 86_400_000; t += 37_000) {
      const app = gameTime(t);
      const wiki = wikiClock(new Date(t));
      expect(formatGameClock(app.minutes), new Date(t).toISOString()).toBe(wiki.time);
      expect(app.dayOf).toBe(wiki.day);
    }
  });

  test('one game day is 72 real minutes', () => {
    const t = Date.UTC(2026, 10, 10, 1, 12, 0); // 72 minutes after midnight UTC
    expect(gameTime(t).minutes).toBeCloseTo(0, 6);
    expect(gameTime(t).dayOf).toBe(2);
    expect(gameTime(t + 3 * 60_000).hour).toBe(1); // a game hour later
  });

  test('Eth-ur date names come from the UTC date', () => {
    const g = gameTime(Date.UTC(2026, 10, 10, 12, 0, 0)); // Tuesday 10 November
    expect([g.weekday, g.month, ordinal(g.dayOfMonth)]).toEqual(['Sorophden', 'Dyingember', '10th']);
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd']);
  });

  test('time until a game hour, and windows across midnight', () => {
    const t = Date.UTC(2026, 10, 10, 1, 6, 0); // 66 real min → 1320 game min = 10:00 PM
    expect(formatGameClock(gameTime(t).minutes)).toBe('10:00 PM');
    expect(msUntilGameMinute(t, 23 * 60)).toBe(3 * 60_000); // 11 PM is one game hour = 3 real minutes away
    expect(windowStatus(t, 22, 4)).toEqual({ open: true, ms: 18 * 60_000 }); // closes at 4 AM: 6 game hours
    expect(windowStatus(t, 6, 18)).toEqual({ open: false, ms: 24 * 60_000 }); // opens at 6 AM: 8 game hours
    expect(windowStatus(t, 5, 5).open).toBe(true);
    expect(formatGameHour(0)).toBe('12 AM');
    expect(formatGameHour(22)).toBe('10 PM');
  });

  test('an offset shifts the clock by game minutes', () => {
    const t = Date.UTC(2026, 10, 10, 1, 6, 0);
    expect(formatGameClock(gameTime(t, 20, 15).minutes)).toBe('10:15 PM');
    expect(formatGameClock(gameTime(t, 20, 130).minutes)).toBe('12:10 AM'); // past midnight wraps
    expect(formatGameClock(gameTime(t, 20, -1330).minutes)).toBe('11:50 PM'); // and so does going back
  });

  test('reads the speed from the wiki gadget, and refuses unfamiliar formulas', () => {
    expect(speedFromGadget(GADGET_SOURCE)).toBe(20);
    expect(speedFromGadget(GADGET_SOURCE.replace('* 20', '* 24'))).toBe(24);
    expect(speedFromGadget('const t = Date.now() / 1000;')).toBeNull();
  });
});

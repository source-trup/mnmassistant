import { expect, savedState, test } from '../support/fixtures';
import { gadgetSource } from '../support/sample-data';

// 01:06 UTC on 10 November 2026 (a Tuesday): 66 real minutes after midnight = 1320 game minutes = 10:00 PM, day 1.
const TEN_PM = new Date(Date.UTC(2026, 10, 10, 1, 6, 0));

test.describe('game clock (toolbar)', () => {
  test('always shows the time and the next 6 AM / 6 PM', async ({ page }) => {
    await page.clock.setFixedTime(TEN_PM);
    await page.reload();
    const btn = page.locator('app-header-clock .clock-btn');
    await expect(btn.locator('.t')).toContainText('10:00 PM');
    // 6 AM is 8 game hours away (24 real min); 6 PM is 20 game hours (1h real) — soonest first.
    await expect(btn.locator('.next')).toHaveText(/6 AM in 24m\s*·\s*6 PM in 1h 0m/);
  });

  test('the popover shows the date, all four marks and the wiki check', async ({ page }) => {
    await page.clock.setFixedTime(TEN_PM);
    await page.reload();
    await page.locator('app-header-clock .clock-btn').click();
    const pop = page.locator('#clock-pop');
    await expect(pop).toBeVisible();
    await expect(pop.locator('.sub')).toHaveText('Day 1 of 20 · Sorophden, the 10th of Dyingember');
    await expect(pop.locator('.marks li')).toHaveCount(4);
    await expect(pop.locator('.marks li').first()).toContainText('12 AM');
    await expect(pop.locator('.marks li').first()).toContainText('in 6m');
    await expect(pop.locator('.credit')).toContainText('✓ Matches');
  });

  test('windows show whether they are open; an open one marks the toolbar clock', async ({ page }) => {
    await page.clock.setFixedTime(TEN_PM);
    await page.reload();
    await page.locator('app-header-clock .clock-btn').click();
    const pop = page.locator('#clock-pop');
    await pop.getByRole('button', { name: '＋ Add' }).click();
    await pop.getByLabel('Window name').fill('Night Terror');
    await pop.getByRole('button', { name: 'Add', exact: true }).click(); // default 10 PM–4 AM
    await pop.getByRole('button', { name: '＋ Add' }).click();
    await pop.getByLabel('Window name').fill('Day camp');
    await pop.getByLabel('From game hour').selectOption('6');
    await pop.getByLabel('To game hour').selectOption('18');
    await pop.getByRole('button', { name: 'Add', exact: true }).click();

    const rows = pop.locator('.windows li');
    await expect(rows.nth(0)).toHaveClass(/open/);
    await expect(rows.nth(0)).toContainText('ends in 18m'); // 6 game hours to 4 AM
    await expect(rows.nth(1)).not.toHaveClass(/open/);
    await expect(rows.nth(1)).toContainText('opens in 24m'); // 8 game hours to 6 AM
    await expect(page.locator('app-header-clock .clock-btn .dot')).toBeVisible();

    const s = await savedState(page);
    expect(s.gameClock.windows.map((w: any) => [w.name, w.from, w.to])).toEqual([['Night Terror', 22, 4], ['Day camp', 6, 18]]);
  });

  test('the adjustment shifts the clock and is saved', async ({ page }) => {
    await page.clock.setFixedTime(TEN_PM);
    await page.reload();
    await page.locator('app-header-clock .clock-btn').click();
    const pop = page.locator('#clock-pop');
    await pop.getByTitle('5 game minutes later').click();
    await pop.getByTitle('5 game minutes later').click();
    await expect(page.locator('app-header-clock .clock-btn .t')).toContainText('10:10 PM');
    await expect(pop.locator('.rate')).toContainText('adjusted +10 game min');
    expect((await savedState(page)).gameClock.offset).toBe(10);
    await pop.getByRole('button', { name: 'Reset' }).click();
    await expect(page.locator('app-header-clock .clock-btn .t')).toContainText('10:00 PM');
  });

  test('follows the wiki if its clock speed changes', async ({ page }) => {
    await page.route('https://monstersandmemories.miraheze.org/w/api.php**', async (route) => {
      const q = new URL(route.request().url()).searchParams;
      if (q.get('prop') !== 'revisions') return route.fallback();
      const content = gadgetSource.replace('* 20', '* 24');
      await route.fulfill({ json: { query: { pages: [{ title: q.get('titles'), revisions: [{ slots: { main: { content } } }] }] } } });
    });
    await page.clock.setFixedTime(TEN_PM);
    await page.reload();
    await expect(page.locator('app-header-clock .clock-btn .t')).toContainText('2:24 AM'); // 66 × 24 = 1584 → 2:24 AM
    await page.locator('app-header-clock .clock-btn').click();
    await expect(page.locator('#clock-pop .credit')).toContainText('speed changed to ×24');
  });

  test('works without the wiki', async ({ page }) => {
    await page.route('https://monstersandmemories.miraheze.org/w/api.php**', (route) => route.abort());
    await page.clock.setFixedTime(TEN_PM);
    await page.reload();
    await expect(page.locator('app-header-clock .clock-btn .t')).toContainText('10:00 PM');
    await page.locator('app-header-clock .clock-btn').click();
    await expect(page.locator('#clock-pop .credit')).toContainText("Couldn't reach the wiki");
  });

  test('the toolbar still fits on one row at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const header = (await page.locator('header').boundingBox())!;
    expect(header.height).toBeLessThan(70);
  });
});

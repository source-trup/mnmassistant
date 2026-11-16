import { HOUR, MINUTE, addPanel, dragBy, expect, loadState, savedState, test } from '../support/fixtures';

test.describe('timers', () => {
  test('click starts, right-click sets the time left', async ({ page }) => {
    await page.getByRole('button', { name: '10m', exact: true }).click();
    const timer = page.locator('app-timer-card');
    await timer.locator('.clock').click();
    await expect(timer.locator('.card')).toHaveAttribute('data-status', 'running');

    await timer.locator('.clock').click({ button: 'right' });
    const edit = timer.locator('.time-edit');
    await edit.fill('2:00');
    await edit.press('Enter');
    // The display rounds up, so it may briefly read 2:01.
    await expect(timer.locator('.time')).toHaveText(/\b(2:0\d|1:5\d)\b/);
  });
});

test.describe('Named / PH camps', () => {
  test('kills count up, named loot is logged, history shows them', async ({ page }) => {
    await addPanel(page, 'Named / PH');
    const camp = page.locator('app-counter-card');
    await camp.getByRole('button', { name: /\+ PH/ }).click();
    await camp.getByRole('button', { name: /\+ PH/ }).click();
    await camp.getByRole('button', { name: /\+ Named/ }).click();

    const drawer = page.locator('app-loot-prompt');
    await drawer.locator('input').first().fill('Bat Wing');
    await drawer.locator('input').first().press('Enter');
    await page.keyboard.press('Escape');

    await expect(camp.locator('.big.ph')).toHaveText('2');
    await expect(camp.locator('.big.named')).toHaveText('1');

    await camp.getByTitle('Camp history & loot').click();
    const hist = page.locator('app-camp-history');
    await expect(hist.locator('.log li')).toHaveCount(3);
    await expect(hist.locator('ul.loot li')).toContainText('Bat Wing');
  });

  test('loot autocomplete suggests MnMdb items with slot or price', async ({ page }) => {
    await addPanel(page, 'Named / PH');
    await page.locator('app-counter-card').getByRole('button', { name: /\+ Named/ }).click();
    const drawer = page.locator('app-loot-prompt');
    const box = drawer.locator('input').first();

    await box.fill('silv');
    const comb = drawer.locator('.list button', { hasText: 'Silver Comb of House Torvald' });
    await expect(comb).toContainText('Head');
    await expect(drawer.locator('.attrib')).toHaveText('Item names from MnMdb');

    await box.fill('iron');
    await expect(drawer.locator('.list button', { hasText: 'Iron Ore' })).toContainText('~28c');
    await drawer.locator('.list button', { hasText: 'Iron Ore' }).click();

    const s = await savedState(page);
    const loot = s.campLogs.flatMap((l: any) => l.history).flatMap((e: any) => e.loot);
    expect(loot).toEqual([{ name: 'Iron Ore', url: 'https://mnm-db.com/#/item/iron_ore' }]);
  });

  test('New session (after confirming) resets the counts and keeps the log', async ({ page }) => {
    await addPanel(page, 'Named / PH');
    const camp = page.locator('app-counter-card');
    await camp.getByRole('button', { name: /\+ PH/ }).click();
    await camp.getByTitle('Camp history & loot').click();
    const hist = page.locator('app-camp-history');
    await hist.getByRole('button', { name: 'New session' }).click();
    await page.locator('app-confirm-dialog').getByRole('button', { name: 'New session' }).click();
    await expect(hist.locator('.log li')).toHaveCount(0);
    await hist.getByRole('button', { name: 'All time' }).click();
    await expect(hist.locator('.log li')).toHaveCount(1);
    await hist.getByRole('button', { name: 'Close' }).click();
    await expect(camp.locator('.big.ph')).toHaveText('0');
  });

  test('a kill over an hour after the last one starts a new session', async ({ page }) => {
    await addPanel(page, 'Named / PH');
    const camp = page.locator('app-counter-card');
    await camp.getByRole('button', { name: /\+ PH/ }).click();
    await camp.getByRole('button', { name: /\+ PH/ }).click();
    // Move everything two hours into the past.
    const s = await savedState(page);
    for (const log of s.campLogs) for (const e of log.history) e.t -= 2 * HOUR;
    for (const c of s.counters) c.since -= 2 * HOUR;
    await loadState(page, s);
    await camp.getByRole('button', { name: /\+ PH/ }).click();
    await expect(camp.locator('.big.ph')).toHaveText('1');
  });

  test('dragging a camp onto a timer links them after confirming', async ({ page }) => {
    await page.getByRole('button', { name: '6m', exact: true }).click();
    // Name the timer after an NPC: linking then names the camp "<NPC>'s log".
    await page.locator('app-timer-card app-panel-title').click({ button: 'right' });
    await page.locator('app-timer-card app-panel-title input').fill('Night Terror');
    await page.locator('app-timer-card app-panel-title input').press('Enter');
    await addPanel(page, 'Named / PH');
    const timerBox = (await page.locator('.panel', { has: page.locator('app-timer-card') }).boundingBox())!;
    const campHead = page.locator('.panel', { has: page.locator('app-counter-card') }).locator('.head');
    const hb = (await campHead.boundingBox())!;
    await page.mouse.move(hb.x + 30, hb.y + 10);
    await page.mouse.down();
    await page.mouse.move(timerBox.x + timerBox.width / 2, timerBox.y + timerBox.height / 2, { steps: 10 });
    await page.mouse.up();
    await page.locator('app-confirm-dialog').getByRole('button', { name: 'Link' }).click();
    const s = await savedState(page);
    expect(s.counters[0].linkedTimerId).toBe(s.timers[0].id);
    expect(s.counters[0].name).toBe("Night Terror's log");
  });
});

test.describe('buffs', () => {
  test('quick-add a buff, cast it, correct its time', async ({ page }) => {
    await addPanel(page, 'Buff Tracker');
    const card = page.locator('app-buff-card');
    await card.locator('.quick button:visible', { hasText: /^20m$/ }).click();
    await card.locator('.cast').first().click();
    await expect(card.locator('button.btime').first()).toHaveText(/\b(20:0\d|19:5\d)\b/);
    await card.locator('button.btime').first().click();
    await card.locator('.btime-edit').fill('5:00');
    await card.locator('.btime-edit').press('Enter');
    await expect(card.locator('button.btime').first()).toHaveText(/\b(5:0\d|4:5\d)\b/);
  });
});

test.describe('player lists', () => {
  test('add, find across lists, move', async ({ page }) => {
    await page.locator('.tools-btn').click();
    await page.locator('#tools-menu .item', { hasText: 'Naughty list' }).click();
    await page.locator('#tools-menu .item', { hasText: 'Nice list' }).click();
    await page.keyboard.press('Escape');
    const naughty = page.locator('app-player-list-card').filter({ has: page.locator('[data-kind=naughty]') });
    const nice = page.locator('app-player-list-card').filter({ has: page.locator('[data-kind=nice]') });
    await naughty.locator('.search input').fill('Ninjalooter');
    await naughty.locator('.search input').press('Enter');
    await nice.locator('.search input').fill('ninjalooter');
    await expect(nice.locator('.status')).toContainText('Naughty');
    await nice.getByRole('button', { name: 'Move here' }).click();
    const s = await savedState(page);
    expect(s.players.nice.map((p: any) => p.name)).toEqual(['Ninjalooter']);
    expect(s.players.naughty).toEqual([]);
  });
});

test.describe('dragging', () => {
  test('a panel dropped on another springs back', async ({ page }) => {
    await page.getByRole('button', { name: '5m', exact: true }).click();
    await page.getByRole('button', { name: '6m', exact: true }).click();
    const panels = page.locator('.panel');
    const first = (await panels.nth(0).boundingBox())!;
    const second = (await panels.nth(1).boundingBox())!;
    await dragBy(page, panels.nth(1).locator('.head'), first.x - second.x + 20, 0);
    await expect.poll(async () => Math.round((await panels.nth(1).boundingBox())!.x)).toBe(Math.round(second.x));
  });
});

test.describe('respawn estimate on a linked timer', () => {
  test('average respawn, next spawn in local time, and the gap to the timer', async ({ page }) => {
    await page.getByRole('button', { name: '10m', exact: true }).click();
    await addPanel(page, 'Named / PH');
    const s = await savedState(page);
    const camp = s.counters[0];
    camp.linkedTimerId = s.timers[0].id;
    // Kills every 10 minutes; the latest really died 2 minutes ago, but the button wasn't pressed yet.
    const died = Date.now() - 2 * MINUTE;
    s.campLogs = [
      {
        key: 'counter:' + camp.id,
        name: camp.name,
        history: [40, 30, 20, 10].map((m, i) => ({ id: 'k' + i, t: died - m * MINUTE, type: 'ph', loot: [] })),
      },
    ];
    await loadState(page, s);

    const timer = page.locator('app-timer-card');
    // Before the press: the spawn was due about 2 minutes ago.
    await expect(timer.locator('app-respawn-info .avg')).toHaveText('⟳ avg 10:00');
    await expect(timer.locator('app-respawn-info .next')).toContainText(/\(2:0\d ago\)/);

    // The late press: the timer runs 10:00 from now, but the rhythm says the next spawn is in about 8 minutes.
    await page.locator('app-counter-card').getByRole('button', { name: /\+ PH/ }).click();
    const info = timer.locator('app-respawn-info');
    await expect(info.locator('.avg')).toHaveText('⟳ avg 10:00');
    const expected = await page.evaluate(
      (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }),
      died + 10 * MINUTE,
    );
    // Allow a second either way for the time between the evaluate and the click.
    await expect(info.locator('.next')).toContainText('next ≈ ');
    const shown = (await info.locator('.next').innerText()).replace('next ≈ ', '');
    const toSec = (x: string) => {
      const [h, m, rest] = x.split(':');
      return (+h % 12) * 3600 + +m * 60 + parseInt(rest);
    };
    expect(Math.abs(toSec(shown) - toSec(expected))).toBeLessThanOrEqual(1);
    // About 2 minutes (plus the few seconds the test took between setting up and pressing).
    await expect(info.locator('.diff')).toHaveText(/^2:0\d before timer$/);
    await expect(info.locator('.diff')).toHaveAttribute('data-dir', 'early');

    // The history dialog shows the same average.
    await page.locator('app-counter-card').getByTitle('Camp history & loot').click();
    await page.locator('app-camp-history').getByRole('button', { name: 'All time' }).click();
    await expect(page.locator('app-camp-history')).toContainText('Average respawn');
  });

  test('nothing shows without a linked camp or enough kills', async ({ page }) => {
    await page.getByRole('button', { name: '10m', exact: true }).click();
    await expect(page.locator('app-timer-card .respawn')).toHaveCount(0);
  });
});

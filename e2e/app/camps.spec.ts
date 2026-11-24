import { HOUR, MINUTE, addPanel, addTimer, dragBy, expect, loadState, openTool, savedState, test } from '../support/fixtures';

test.describe('timers', () => {
  test('click starts, right-click sets the time left', async ({ page }) => {
    await addTimer(page, 10);
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

test.describe('Named / PH timers', () => {
  test('kills count up, named loot is logged, history shows them', async ({ page }) => {
    await addPanel(page, 'Named / PH timer');
    const camp = page.locator('app-camp-card');
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
    await addPanel(page, 'Named / PH timer');
    await page.locator('app-camp-card').getByRole('button', { name: /\+ Named/ }).click();
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
    await addPanel(page, 'Named / PH timer');
    const camp = page.locator('app-camp-card');
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
    await addPanel(page, 'Named / PH timer');
    const camp = page.locator('app-camp-card');
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

  test('one panel: + PH restarts its countdown; an NPC name keeps the history under that NPC', async ({ page }) => {
    await addPanel(page, 'Named / PH timer');
    const camp = page.locator('app-camp-card');
    await expect(page.locator('app-timer-card')).toHaveCount(0); // no separate timer panel
    await expect(camp.locator('.time')).toHaveText('6:00');
    await camp.getByRole('button', { name: /\+ PH/ }).click();
    await expect(camp.locator('.card')).toHaveAttribute('data-status', 'running');

    await camp.locator('app-panel-title').click({ button: 'right' });
    await camp.locator('app-panel-title input').fill('Night Terror');
    await camp.locator('app-panel-title input').press('Enter');
    await camp.getByRole('button', { name: /\+ PH/ }).click();
    const s = await savedState(page);
    expect(s.counters[0].name).toBe('Night Terror');
    expect(s.timers.find((t: any) => t.id === s.counters[0].timerId).name).toBe('Night Terror');
    // Both kills (the one from before it was named, too) are Night Terror's now.
    const log = s.campLogs.find((l: any) => l.key === 'npc:night terror');
    expect(log.history).toHaveLength(2);
  });

  test('put away and brought back from ＋ Add, counts and countdown kept', async ({ page }) => {
    await addPanel(page, 'Named / PH timer');
    const camp = page.locator('app-camp-card');
    await camp.getByRole('button', { name: /\+ PH/ }).click();
    await camp.getByTitle(/^Put away/).click();
    await expect(camp).toHaveCount(0);
    await expect(page.locator('.add-btn .badge')).toHaveText('1');

    await page.locator('.add-btn').click();
    const saved = page.locator('#add-menu .saved-note', { hasText: 'Named / PH' });
    await expect(saved).toContainText('1 PH · 0 named · 6:00 respawn');
    await saved.locator('.open').click();
    await expect(camp.locator('.big.ph')).toHaveText('1');
    await expect(camp.locator('.card')).toHaveAttribute('data-status', 'idle'); // its countdown stopped when put away
    await expect(page.locator('.add-btn .badge')).toHaveCount(0);
  });

  test('an old board: a camp linked to a timer becomes one Named / PH timer', async ({ page }) => {
    const timer = { id: 't1', name: 'Grimfang', autoNamed: false, durationMs: 8 * MINUTE, endsAt: null, pausedRemainingMs: null, repeat: false, x: 0, y: 0 };
    const plain = { id: 't2', name: '5:00 spawn', autoNamed: true, durationMs: 5 * MINUTE, endsAt: null, pausedRemainingMs: null, repeat: false, x: 16, y: 0 };
    const linked = { id: 'c1', kind: 'namedPh', name: "Grimfang's log", since: 0, linkedTimerId: 't1', ph: 4, named: 1, phSinceNamed: 2, x: 0, y: 10 };
    const alone = { id: 'c2', kind: 'namedPh', name: 'Bandit camp', since: 0, linkedTimerId: null, ph: 3, named: 0, phSinceNamed: 3, x: 32, y: 0 };
    const count = { id: 'c3', kind: 'standard', name: 'Kills', since: 0, linkedTimerId: 't2', value: 7, step: 1, target: null, x: 48, y: 0 };
    const history = [{ id: 'e1', t: Date.now() - HOUR, type: 'ph', loot: [] }];
    await loadState(page, {
      timers: [timer, plain],
      counters: [linked, alone, count],
      campLogs: [
        { key: 'npc:grimfang', name: 'Grimfang', history },
        { key: 'counter:c2', name: 'Bandit camp', history },
      ],
    });

    const camps = page.locator('app-camp-card');
    await expect(camps).toHaveCount(2);
    await expect(page.locator('app-timer-card')).toHaveCount(1); // only the plain timer is left as its own panel
    const grim = camps.filter({ has: page.locator('app-panel-title', { hasText: 'Grimfang' }) });
    await expect(grim.locator('.time')).toHaveText('8:00');
    await expect(grim.locator('.big.ph')).toHaveText('4');
    await expect(camps.filter({ has: page.locator('app-panel-title', { hasText: 'Bandit camp' }) }).locator('.time')).toHaveText('6:00');

    const s = await savedState(page);
    const byId = (id: string) => s.counters.find((c: any) => c.id === id);
    expect(byId('c1').timerId).toBe('t1');
    expect(byId('c1')).not.toHaveProperty('linkedTimerId');
    expect(byId('c3')).not.toHaveProperty('linkedTimerId');
    // Kill logs stay where they were.
    expect(s.campLogs.map((l: any) => l.key).sort()).toEqual(['counter:c2', 'npc:grimfang']);
  });
});

test.describe('Named / PH warning', () => {
  test('off by default; "Warn at" in settings speaks and turns the panel amber before it is up', async ({ page }) => {
    // Catch what would be spoken instead of using the system voice.
    await page.addInitScript(() => {
      (window as any).__spoken = [];
      speechSynthesis.speak = (u: SpeechSynthesisUtterance) => void (window as any).__spoken.push(u.text);
    });
    const timer = { id: 't1', name: 'Grimfang', autoNamed: false, durationMs: 10_000, endsAt: null, pausedRemainingMs: null, repeat: false, x: -1, y: -1 };
    const camp = { id: 'c1', kind: 'namedPh', name: 'Grimfang', timerId: 't1', closed: false, ph: 0, named: 0, phSinceNamed: 0, since: Date.now(), x: 0, y: 0 };
    await loadState(page, { timers: [timer], counters: [camp] });
    const card = page.locator('app-camp-card');
    const spoken = () => page.evaluate(() => (window as any).__spoken as string[]);

    // Off by default.
    await card.getByTitle('Settings').click();
    const warnBox = card.getByTitle(/^Warn this long before it's up/);
    await expect(warnBox).toHaveValue('');
    await expect(warnBox).toHaveAttribute('placeholder', 'off');

    // A bad entry is flagged and not saved; a good one is.
    await warnBox.fill('soon');
    await warnBox.press('Enter');
    await expect(warnBox).toHaveClass(/invalid/);
    await warnBox.fill('0:08');
    await warnBox.press('Enter');
    await expect(warnBox).not.toHaveClass(/invalid/);
    await expect(card.locator('dialog .hint')).toContainText('At 0:08 left it says “Grimfang is up in …”.');
    await card.getByRole('button', { name: 'Done' }).click();
    expect((await savedState(page)).timers[0].warnMs).toBe(8000);

    // Start the 10 second countdown: about 2 seconds in, it warns.
    await card.locator('.clock').click();
    await expect(card.locator('.card')).not.toHaveClass(/warning/);
    await expect(card.locator('.card')).toHaveClass(/warning/, { timeout: 4000 });
    await expect.poll(spoken, { timeout: 3000 }).toEqual([expect.stringMatching(/^Grimfang is up in [78] seconds$/)]);

    // Turning it off again (empty box).
    await card.getByTitle('Settings').click();
    await warnBox.fill('');
    await warnBox.press('Enter');
    await card.getByRole('button', { name: 'Done' }).click();
    await expect(card.locator('.card')).not.toHaveClass(/warning/);
    expect((await savedState(page)).timers[0].warnMs ?? null).toBeNull();
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
    await openTool(page, 'Naughty list');
    await openTool(page, 'Nice list');
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
    await addTimer(page, 5);
    await addTimer(page, 6);
    const panels = page.locator('.panel');
    const first = (await panels.nth(0).boundingBox())!;
    const second = (await panels.nth(1).boundingBox())!;
    await dragBy(page, panels.nth(1).locator('.head'), first.x - second.x + 20, 0);
    await expect.poll(async () => Math.round((await panels.nth(1).boundingBox())!.x)).toBe(Math.round(second.x));
  });
});

test.describe('respawn estimate on a Named / PH timer', () => {
  test('shows the estimated time between spawns, here and in the history', async ({ page }) => {
    await addPanel(page, 'Named / PH timer');
    const s = await savedState(page);
    const camp = s.counters[0];
    // Kills every 10 minutes, pressed a little late now and then, and one spawn never logged (the 20 minute gap).
    const at = [0, 10, 20.5, 30, 50, 60.2, 70];
    s.campLogs = [
      {
        key: 'counter:' + camp.id,
        name: camp.name,
        history: at.map((m, i) => ({ id: 'k' + i, t: Date.now() - (80 - m) * MINUTE, type: 'ph', loot: [] })),
      },
    ];
    await loadState(page, s);

    const info = page.locator('app-camp-card app-respawn-info');
    await expect(info).toHaveText('⟳ est. respawn 10:00');
    await expect(info.locator('.respawn')).toHaveAttribute('title', /from 7 respawns/);

    await page.locator('app-camp-card').getByTitle('Camp history & loot').click();
    await page.locator('app-camp-history').getByRole('button', { name: 'All time' }).click();
    await expect(page.locator('app-camp-history')).toContainText(/Est\. respawn\s*10:00/);
  });

  test('nothing shows until a few respawns are logged', async ({ page }) => {
    await addPanel(page, 'Named / PH timer');
    const camp = page.locator('app-camp-card');
    await camp.getByRole('button', { name: /\+ PH/ }).click();
    await expect(camp.locator('.respawn')).toHaveCount(0);
  });
});

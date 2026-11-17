import { addPanel, addTimer, dragBy, expect, savedState, test, toolButton } from '../support/fixtures';

test.describe('board and toolbar', () => {
  test('quick and custom timers are added from ＋ Add and saved', async ({ page }) => {
    await addTimer(page, 5);
    await expect(page.locator('#add-menu')).not.toBeVisible();
    await page.locator('.add-btn').click();
    const custom = page.getByLabel('Custom timer length');
    await custom.fill('nonsense');
    await custom.press('Enter');
    await expect(custom).toHaveClass(/invalid/);
    await custom.fill('7:30');
    await custom.press('Enter');
    await expect(page.locator('app-timer-card')).toHaveCount(2);
    await expect(page.locator('app-timer-card .time').nth(1)).toHaveText('7:30');

    // A Named / PH timer of any respawn, too.
    await page.locator('.add-btn').click();
    const respawn = page.getByLabel('Custom Named / PH respawn');
    await respawn.fill('6:40');
    await respawn.press('Enter');
    await expect(page.locator('app-camp-card .time')).toHaveText('6:40');

    await page.reload();
    await expect(page.locator('app-timer-card')).toHaveCount(2);
    await expect(page.locator('app-camp-card')).toHaveCount(1);
  });

  test('the Add menu adds every panel type', async ({ page }) => {
    for (const name of ['Timer', 'Named / PH timer', 'Count', 'Buff Tracker', 'Note', 'Checklist']) await addPanel(page, name);
    await expect(page.locator('app-timer-card')).toHaveCount(1);
    await expect(page.locator('app-camp-card')).toHaveCount(1);
    await expect(page.locator('app-counter-card')).toHaveCount(1);
    await expect(page.locator('app-buff-card')).toHaveCount(1);
    await expect(page.locator('app-note-card')).toHaveCount(2);
    await expect(page.locator('#add-menu')).not.toBeVisible();
  });

  test('panels move by their title bar and resize from the corner', async ({ page }) => {
    await addTimer(page, 5);
    const panel = page.locator('.panel', { has: page.locator('app-timer-card') });
    const before = (await panel.boundingBox())!;

    await dragBy(page, panel.locator('.head'), 0, 300);
    await expect.poll(async () => (await panel.boundingBox())!.y).toBeGreaterThan(before.y + 200);

    await dragBy(page, panel.locator('.resize-grip'), 120, 80);
    await expect.poll(async () => (await panel.boundingBox())!.width).toBeGreaterThan(before.width + 80);
    const t = (await savedState(page)).timers[0];
    expect(t.w).toBeGreaterThan(15);
    expect(t.y).toBeGreaterThan(5);
  });

  test('Shift + click on ✕ deletes without asking', async ({ page }) => {
    await addTimer(page, 5);
    await page.locator('app-timer-card').getByTitle(/^Delete/).click({ modifiers: ['Shift'] });
    await expect(page.locator('app-timer-card')).toHaveCount(0);
  });

  test('tools are one click in the toolbar: on, and off again', async ({ page }) => {
    const levels = toolButton(page, 'Group Range');
    // Pointing at a tool shows what it does straight away (a tooltip of the app's own, not the browser's slow one).
    const tip = page.locator('nav.tools .tool-wrap', { has: page.locator('.tl', { hasText: /^Group Range$/ }) }).locator('.tool-tip');
    await expect(tip).toBeHidden();
    await levels.hover();
    await expect(tip).toBeVisible({ timeout: 300 });
    await expect(tip).toContainText('Enter a level to see the lowest and highest levels it can group with');
    await expect(tip).toContainText('Click to show');
    await expect(levels).toHaveAccessibleDescription(/Enter a level/);
    await levels.click();
    await expect(tip).toContainText('Showing · click to hide');
    await toolButton(page, 'Naughty').click();
    await expect(page.locator('nav.tools .tool.on')).toHaveCount(2);
    await expect(levels).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('app-level-range-card')).toBeVisible();
    await expect(page.locator('app-player-list-card')).toBeVisible();
    await levels.click();
    await expect(page.locator('app-level-range-card')).toHaveCount(0);
    await expect(levels).toHaveAttribute('aria-pressed', 'false');
  });

  test('a layout file round-trips through Save and Load', async ({ page }) => {
    await addTimer(page, 6);
    const state = await savedState(page);
    expect(state.timers).toHaveLength(1);
    expect(state.version).toBe(5);
  });
});

test.describe('quick guide', () => {
  test('opens by itself on a first visit only, then offers a theme', async ({ freshVisit: page }) => {
    const guide = page.locator('dialog.guide');
    const themes = page.locator('dialog.themes-dlg');
    await expect(guide).toBeVisible();
    await expect(guide.locator('summary')).toHaveCount(7);
    await guide.getByRole('button', { name: 'Got it' }).click();

    await expect(themes).toBeVisible();
    await expect(themes.locator('.theme-intro')).toContainText('Welcome');
    await themes.locator('.theme-tile', { hasText: 'Monk' }).click();
    await themes.getByRole('button', { name: 'Done' }).click();
    await expect(themes).not.toBeVisible();
    await expect.poll(async () => (await savedState(page)).theme).toBe('monk');

    await page.reload();
    await page.locator('app-root header').waitFor();
    await expect(guide).not.toBeVisible();
    await expect(themes).not.toBeVisible();
  });

  test('closing the first-visit guide with Esc also offers a theme', async ({ freshVisit: page }) => {
    await expect(page.locator('dialog.guide')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.themes-dlg')).toBeVisible();
  });

  test('? and the menu reopen it (without the theme offer)', async ({ page }) => {
    const guide = page.locator('dialog.guide');
    await expect(guide).not.toBeVisible();
    await page.getByTitle(/^Quick guide/).click();
    await expect(guide).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('header').getByTitle('Menu', { exact: true }).click();
    await page.getByRole('button', { name: /Quick guide/ }).click();
    await expect(guide).toBeVisible();
    await guide.getByRole('button', { name: 'Got it' }).click();
    await expect(page.locator('dialog.themes-dlg')).not.toBeVisible();
  });

  test('the theme picker from the menu has no welcome line', async ({ page }) => {
    await page.locator('header').getByTitle('Menu', { exact: true }).click();
    await page.getByRole('button', { name: /Theme:/ }).click();
    await expect(page.locator('dialog.themes-dlg')).toBeVisible();
    await expect(page.locator('dialog.themes-dlg .theme-intro')).toHaveCount(0);
  });
});

test.describe('usage stats', () => {
  test('nothing is sent off the live site, and the menu switch is remembered', async ({ page }) => {
    const sent: string[] = [];
    page.on('request', (r) => {
      if (/goatcounter|gc\.zgo\.at/.test(r.url())) sent.push(r.url());
    });
    await page.reload();
    await toolButton(page, 'Wiki').click();
    await addTimer(page, 5);

    const item = page.locator('#main-menu button', { hasText: 'Share anonymous usage stats' });
    await page.getByTitle('Menu', { exact: true }).click();
    await expect(item).toHaveText(/☑/);
    await item.click();
    await page.reload();
    await page.getByTitle('Menu', { exact: true }).click();
    await expect(item).toHaveText(/☐/);
    expect(await page.evaluate(() => localStorage.getItem('mnm-assistant.analytics'))).toBe('off');
    expect(sent).toEqual([]);
  });
});

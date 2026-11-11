import { addPanel, dragBy, expect, savedState, test } from '../support/fixtures';

test.describe('board and toolbar', () => {
  test('quick and custom timers are added and saved', async ({ page }) => {
    await page.getByRole('button', { name: '5m', exact: true }).click();
    const custom = page.getByLabel('Custom timer length');
    await custom.fill('7:30');
    await custom.press('Enter');
    await expect(page.locator('app-timer-card')).toHaveCount(2);
    await expect(page.locator('app-timer-card .time').nth(1)).toHaveText('7:30');

    await custom.fill('nonsense');
    await custom.press('Enter');
    await expect(custom).toHaveClass(/invalid/);
    await expect(page.locator('app-timer-card')).toHaveCount(2);

    await page.reload();
    await expect(page.locator('app-timer-card')).toHaveCount(2);
  });

  test('the Add menu adds every panel type', async ({ page }) => {
    for (const name of ['Count', 'Named / PH', 'Buff Tracker', 'Note', 'Checklist']) await addPanel(page, name);
    await expect(page.locator('app-counter-card')).toHaveCount(2);
    await expect(page.locator('app-buff-card')).toHaveCount(1);
    await expect(page.locator('app-note-card')).toHaveCount(2);
    await expect(page.locator('#add-menu')).not.toBeVisible();
  });

  test('panels move by their title bar and resize from the corner', async ({ page }) => {
    await page.getByRole('button', { name: '5m', exact: true }).click();
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
    await page.getByRole('button', { name: '5m', exact: true }).click();
    await page.locator('app-timer-card').getByTitle(/^Delete/).click({ modifiers: ['Shift'] });
    await expect(page.locator('app-timer-card')).toHaveCount(0);
  });

  test('Tools menu stays open while toggling and counts open tools', async ({ page }) => {
    await page.locator('.tools-btn').click();
    const menu = page.locator('#tools-menu');
    await menu.locator('.item', { hasText: 'Level range' }).click();
    await menu.locator('.item', { hasText: 'Naughty list' }).click();
    await expect(menu).toBeVisible();
    await expect(menu.locator('.item.on')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(page.locator('.tools-btn .badge')).toHaveText('2');
    await expect(page.locator('app-level-range-card')).toBeVisible();
  });

  test('a layout file round-trips through Save and Load', async ({ page }) => {
    await page.getByRole('button', { name: '6m', exact: true }).click();
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

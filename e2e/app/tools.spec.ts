import { expect, openTool, savedState, test } from '../support/fixtures';

test.describe('level range', () => {
  test('shows the lowest and highest partners', async ({ page }) => {
    await openTool(page, 'Level range');
    const card = page.locator('app-level-range-card');
    await card.locator('.entry input').fill('18');
    await expect(card.locator('.say')).toHaveText('Level 18 can group with levels 13 to 26.');
  });
});

test.describe('spells', () => {
  test('class and level filter with the level cost', async ({ page }) => {
    await openTool(page, 'Spells');
    const card = page.locator('app-spells-card');
    await card.locator('.spell').first().waitFor();
    await card.locator('select.cls').selectOption('Shaman');
    await card.locator('.lvl select').selectOption('8');
    await expect(card.locator('.summary')).toContainText('13 spells');
    await expect(card.locator('.summary')).toContainText('15s 99c');
  });
});

test.describe('spells: bought', () => {
  test('right-click marks bought, totals skip it, settings clears all', async ({ page }) => {
    await openTool(page, 'Spells');
    const card = page.locator('app-spells-card');
    await card.locator('.spell').first().waitFor();
    await card.locator('select.cls').selectOption('Shaman');
    await card.locator('.lvl select').selectOption('8');
    const total = card.locator('.summary .cost').first().locator('.v');
    const upTo = card.locator('.summary .cost.sub .v');
    await expect(total).toHaveText('15s 99c');
    await expect(upTo).toHaveText('18s 77c');

    // Two spells at 1s 23c each.
    await card.locator('.row', { hasText: 'Spirit Mending' }).first().click({ button: 'right' });
    await card.locator('.row', { hasText: 'Pact of Haste' }).first().click({ button: 'right' });
    await expect(card.locator('.spell.bought')).toHaveCount(2);
    await expect(total).toHaveText('13s 53c');
    await expect(upTo).toHaveText('16s 31c');
    await expect(card.locator('.summary .bought-note')).toContainText('2 bought');

    // Right-click again unmarks; the details button marks it back.
    await card.locator('.row', { hasText: 'Pact of Haste' }).first().click({ button: 'right' });
    await expect(total).toHaveText('14s 76c');
    await card.locator('.row', { hasText: 'Pact of Haste' }).first().click();
    await card.getByRole('button', { name: '✓ Mark as bought' }).click();
    await expect(total).toHaveText('13s 53c');

    // Remembered after a reload.
    await page.reload();
    await expect(page.locator('app-spells-card .spell.bought')).toHaveCount(2);
    expect((await savedState(page)).spellPanel.bought).toHaveLength(2);

    // Settings: clear (after confirming).
    await page.locator('app-spells-card').getByTitle('Settings: bought spells').click();
    const dlg = page.locator('dialog.spell-settings');
    await expect(dlg).toContainText('2 spells marked as bought');
    await dlg.getByRole('button', { name: 'Clear bought spells' }).click();
    await page.locator('app-confirm-dialog').getByRole('button', { name: 'Clear' }).click();
    await dlg.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('app-spells-card .spell.bought')).toHaveCount(0);
    await expect(page.locator('app-spells-card .summary .cost').first().locator('.v')).toHaveText('15s 99c');
  });
});

test.describe('classes', () => {
  test('starts on the theme class and switches tabs', async ({ page }) => {
    await openTool(page, 'Classes');
    const card = page.locator('app-classes-card');
    await expect(card.locator('.snap h3')).toHaveText('Shaman');
    await card.getByRole('tab', { name: 'Build' }).click();
    await expect(card.locator('table').first().locator('tbody tr')).not.toHaveCount(0);
    await card.getByRole('button', { name: 'Tank' }).click();
    await expect(card.locator('.snap h3')).toHaveText('Fighter');
  });
});

test.describe('leveling', () => {
  test('a bracket lists camps by zone', async ({ page }) => {
    await openTool(page, 'Leveling');
    const card = page.locator('app-leveling-card');
    await card.locator('.cols button', { hasText: /^15$/ }).click();
    await expect(card.locator('.summary')).toContainText('Levels 15–19');
    await expect(card.locator('.zone').first()).toBeVisible();
  });
});

test.describe('map', () => {
  test('type to find a zone, Enter picks it', async ({ page }) => {
    await openTool(page, 'Map');
    const card = page.locator('app-map-card');
    const picker = card.getByRole('combobox', { name: 'Map' });
    await expect(picker).toHaveValue('Night Harbor');

    await picker.click();
    await expect(card.locator('#map-options').getByRole('option')).toHaveCount(29); // every map before typing
    await picker.fill('fall');
    await expect(card.locator('#map-options').getByRole('option').first()).toContainText('Fallen Pass'); // starts with "fall" first
    await expect(card.locator('#map-options').getByRole('option')).toContainText(['Fallen Pass', 'Fallen Watch']);
    await picker.press('Enter');
    await expect(card.locator('iframe')).toHaveAttribute('src', 'https://www.mnmatlas.com/fallen-pass/?embed=1');
    await expect(picker).toHaveValue('Fallen Pass');
    await expect(card.locator('#map-options')).toHaveCount(0); // the list closed
  });

  test('a word inside the name, arrow keys, and clicking work too', async ({ page }) => {
    await openTool(page, 'Map');
    const card = page.locator('app-map-card');
    const picker = card.getByRole('combobox', { name: 'Map' });
    await picker.click();
    await picker.fill('weald');
    await expect(card.locator('#map-options').getByRole('option').first()).toContainText('Evershade Weald');
    await picker.fill('crypt');
    // Ancient Crypt, Infested Crypt, then Rothold's "Keep floor -2 and Crypt" floor.
    await expect(card.locator('#map-options').getByRole('option')).toHaveCount(3);
    await expect(card.locator('#map-options').getByRole('option').nth(2)).toContainText('Rothold');
    await picker.press('ArrowDown');
    await picker.press('Enter');
    await expect(card.locator('iframe')).toHaveAttribute('src', 'https://www.mnmatlas.com/infested-crypt/?embed=1');

    await picker.click();
    await picker.fill('vale');
    await card.getByRole('option', { name: /Vale of Zintar/ }).click();
    await expect(card.locator('iframe')).toHaveAttribute('src', 'https://www.mnmatlas.com/vale-of-zintar/?embed=1');
  });

  test('a floor name opens that floor; Esc puts the box back', async ({ page }) => {
    await openTool(page, 'Map');
    const card = page.locator('app-map-card');
    const picker = card.getByRole('combobox', { name: 'Map' });
    await picker.click();
    await picker.fill('ossuary');
    await expect(card.locator('#map-options').getByRole('option').first()).toContainText('Tomb of the Last Wyrmsbane');
    await expect(card.locator('#map-options').getByRole('option').first()).toContainText('floor: Ossuary and bone construct');
    await picker.press('Enter');
    await expect(card.locator('iframe')).toHaveAttribute('src', 'https://www.mnmatlas.com/wyrmsbane-tomb/?embed=1&level=floor-3');
    await expect(card.getByLabel('Level or floor')).toHaveValue('floor-3');

    await picker.click();
    await picker.fill('zzz');
    await expect(card.locator('.options .none')).toContainText('No zone matches');
    await picker.press('Escape');
    await expect(picker).toHaveValue('Tomb of the Last Wyrmsbane');
    expect((await savedState(page)).mapPanel.map).toBe('wyrmsbane-tomb');
  });
});

test.describe('prices', () => {
  test('Trem market summary, window and vendor value', async ({ page }) => {
    await openTool(page, 'Prices');
    const card = page.locator('app-prices-card');
    const box = card.getByLabel('Item to price check');
    await expect(box).toBeEnabled();
    await box.fill('iron');
    await box.press('Enter');
    await expect(card.locator('.title h3')).toHaveText('Iron Ore');
    // Last 30 days: 20, 25, 30, 40 → median 28c (the 40-day-old 5c listing and the other server are left out).
    await expect(card.locator('.market .v')).toHaveText('28c');
    await expect(card.locator('.market .note')).toContainText('4 sellers');
    await card.getByRole('button', { name: '7 days' }).click();
    await expect(card.locator('.market .v')).toHaveText('25c');
    await expect(card.locator('.vendor b')).toHaveText('1c');
    await expect(card.locator('.market .bids')).toContainText('15c');
  });
});

test.describe('wiki', () => {
  test('search, read (sanitized), follow links, go back', async ({ page }) => {
    await openTool(page, 'Wiki');
    const card = page.locator('app-wiki-card');
    await card.getByLabel('Search the wiki').fill('night terror');
    await card.getByLabel('Search the wiki').press('Enter');
    await expect(card.locator('.hits .ht').first()).toHaveText('Night Terror');
    await card.locator('.hits .hit').first().click();
    await expect(card.locator('.ptitle')).toHaveText('Night Terror');
    await expect(card.locator('.wiki')).toContainText('only comes out at night');
    await expect(card.locator('.wiki script, .wiki style, .wiki [onclick]')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();

    await card.locator('.wiki a', { hasText: "Night Terror's Wing" }).click();
    await expect(card.locator('.ptitle')).toHaveText("Night Terror's Wing");
    await card.getByTitle('Back').click();
    await expect(card.locator('.ptitle')).toHaveText('Night Terror');

    await card.locator('.wiki a', { hasText: 'Missing Page' }).click();
    await expect(card.locator('.hint').first()).toContainText('no page called “Missing Page”');
    expect((await savedState(page)).wikiPanel.shown).toBe(true);
  });

  test('📖 buttons elsewhere look things up', async ({ page }) => {
    await openTool(page, 'Classes');
    await page.locator('app-classes-card .snap .wk').click();
    await expect(page.locator('app-wiki-card .ptitle')).toHaveText('Shaman');
  });

  test('↗ opens the page on the wiki in a new tab', async ({ page, context }) => {
    await openTool(page, 'Wiki');
    const card = page.locator('app-wiki-card');
    await card.getByLabel('Search the wiki').fill('Iron Ore');
    await card.getByLabel('Search the wiki').press('Enter');
    await card.locator('.hits .hit').first().click();
    await expect(card.locator('.ptitle')).toHaveText('Iron Ore');
    const popup = context.waitForEvent('page');
    const b = (await card.locator('.head a.ext').boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    expect(await (await popup).evaluate(() => true)).toBe(true);
  });
});

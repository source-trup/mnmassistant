import { expect, loadState, openTool, savedState, test } from '../support/fixtures';

test.describe('level range', () => {
  test('shows the lowest and highest partners', async ({ page }) => {
    await openTool(page, 'Group Range');
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
    await openTool(page, 'Class Guides');
    const card = page.locator('app-classes-card');
    await card.locator('.snap h3').waitFor(); // classes.json is large; the busy test server can be slow with it
    await expect(card.locator('.snap h3')).toHaveText('Shaman');
    await card.getByRole('tab', { name: 'Build' }).click();
    await expect(card.locator('table').first().locator('tbody tr')).not.toHaveCount(0);
    await card.getByRole('button', { name: 'Tank' }).click();
    await expect(card.locator('.snap h3')).toHaveText('Fighter');
  });
});

test.describe('leveling spots (Worth the Camp)', () => {
  test('class, level and solo / group give zones whose mobs con right, best first', async ({ page }) => {
    await openTool(page, 'Leveling Spots');
    const card = page.locator('app-leveling-card');
    // The class follows the theme (Shaman) until you pick one.
    await expect(card.getByLabel('Class')).toHaveValue('Shaman');
    await expect(card.locator('.hint')).toContainText('Type your level');
    await card.getByLabel('Your level').fill('20');

    // Shaman solos well (tier A): mobs 3 to 1 below, named 2 lower still.
    await expect(card.locator('.aim p')).toContainText('Aim for mobs 17–19, named 15–17');
    await expect(card.locator('.aim p')).toContainText('Shaman solos well (solo tier A)');
    await expect(card.locator('.strip .cell.target')).toHaveText(['17', '18', '19']);
    await expect(card.locator('.strip .cell', { hasText: /^20$/ })).toHaveClass(/con-white/);

    // Raid bosses and mobs without known levels are left out; a city counts for less.
    await expect(card.locator('.zone .zn')).toHaveText(['Blind Midden', 'Night Harbor', 'Tel Ekir']);
    await expect(card.locator('.summary')).toHaveText('6 mobs in 3 zones, best first');
    const midden = card.locator('.zone').first();
    await expect(midden.locator('li .nn')).toHaveText(['A mud gnoll', 'A gnoll digger', 'Ferg the Filthy']); // regulars, then named
    await expect(midden.locator('.zc')).toHaveText('3 mobs · zone 5–19');
    await expect(midden.locator('li', { hasText: 'Ferg' }).locator('.named')).toHaveText('Named');
    const gnoll = midden.locator('li', { hasText: 'A mud gnoll' });
    await expect(gnoll.locator('.nl')).toHaveText('17–18');
    await expect(gnoll.locator('.nd')).toHaveText('3 drops');
    await expect(midden.locator('li', { hasText: 'A gnoll digger' }).locator('.dot')).toHaveClass(/con-blue/);
    await expect(midden.locator('a.icon')).toHaveAttribute('href', 'https://worththecamp.com/npcs/blind-midden');
    await expect(card.locator('.zone', { hasText: 'Night Harbor' }).locator('.hub')).toBeVisible();

    // The same choices on Worth the Camp's own page.
    await expect(card.getByRole('link', { name: 'Worth the Camp ↗' })).toHaveAttribute(
      'href',
      'https://worththecamp.com/leveling?cls=Shaman&lvl=20&mode=solo',
    );

    // A class that finds soloing hard aims lower; a group aims above you.
    await card.getByLabel('Class').selectOption('Fighter');
    await card.getByLabel('Your level').fill('25');
    await expect(card.locator('.aim p')).toContainText('Aim for mobs 19–21, named 17–19');
    await card.getByRole('button', { name: 'Group' }).click();
    await expect(card.locator('.aim p')).toContainText('Aim for mobs 27–28, named 25–26');
    await expect(card.getByRole('link', { name: 'Worth the Camp ↗' })).toHaveAttribute('href', /cls=Fighter&lvl=25&mode=group/);

    // Remembered, and the data is kept in this browser (it's downloaded at most once a day).
    const s = await savedState(page);
    expect(s.levelingPanel).toMatchObject({ cls: 'Fighter', level: 25, mode: 'group' });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mnm-assistant.wtc.v1') ?? 'null')?.npcs.length)).toBe(10);
  });

  test("a board from before keeps its level; Worth the Camp being down says so", async ({ page }) => {
    await page.route('https://worththecamp.com/api/v1/*.json', (route) => route.fulfill({ status: 503 }));
    const s = await savedState(page);
    await loadState(page, { ...s, levelingPanel: { shown: true, from: 15, to: 19, region: null, raids: true, source: 'both', x: 0, y: 0 } });
    const card = page.locator('app-leveling-card');
    await expect(card.getByLabel('Your level')).toHaveValue('15');
    await expect(card.locator('.hint')).toContainText("Couldn't reach Worth the Camp");
    await expect(card.locator('.hint a')).toHaveAttribute('href', /lvl=15&mode=solo/);
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
    await openTool(page, 'Price Checker');
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
    await openTool(page, 'Class Guides');
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

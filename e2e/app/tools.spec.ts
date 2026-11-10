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
  test('embeds the chosen MnM Atlas map', async ({ page }) => {
    await openTool(page, 'Map');
    const card = page.locator('app-map-card');
    await card.getByLabel('Map', { exact: true }).selectOption('fallen-pass');
    await expect(card.locator('iframe')).toHaveAttribute('src', 'https://www.mnmatlas.com/fallen-pass/?embed=1');
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

import { expect, openTool, savedState, test } from '../support/fixtures';

test.describe('wishlist', () => {
  test('an item MnMdb knows: stats, where it drops, map and wiki links', async ({ page }) => {
    await openTool(page, 'Wishlist');
    const card = page.locator('app-wishlist-card');
    const box = card.locator('app-item-search input');
    await expect(box).not.toBeFocused(); // doesn't grab focus when the page loads
    await box.fill('silver');
    await card.locator('.list button', { hasText: 'Silver Comb of House Torvald' }).click();

    const row = card.locator('.wish', { hasText: 'Silver Comb of House Torvald' });
    await expect(row.locator('.from')).toHaveText('Handmaiden Mira');
    await row.locator('.nm').click();
    const details = row.locator('app-wish-details');
    await expect(details.locator('.stats')).toContainText('Head');
    await expect(details.locator('.stats')).toContainText('AC 24');
    await expect(details.locator('.stats')).toContainText('INT +4');
    await expect(details.locator('.stats')).toContainText('UNIQUE');
    await expect(details.locator('.src')).toContainText(/Drops from\s*Handmaiden Mira/);
    await expect(details.getByRole('button', { name: '🧭 Fallen Pass' })).toBeVisible();

    // Miraheze has a page: 📖 and ↗. The .wiki search isn't available here, so its link is built from the name.
    await expect(details.getByRole('link', { name: 'Miraheze ↗' })).toHaveAttribute(
      'href',
      'https://monstersandmemories.miraheze.org/wiki/Silver_Comb_of_House_Torvald',
    );
    const dotWiki = details.getByRole('link', { name: '.wiki ↗' });
    await expect(dotWiki).toHaveAttribute('href', 'https://monstersandmemories.wiki/items/silver-comb-of-house-torvald');
    await expect(details.getByRole('link', { name: 'MnMdb ↗' })).toBeVisible();

    // A wrong guess can be replaced by pasting the right link (only .wiki links), and cleared back to the guess.
    await details.getByRole('button', { name: '✎ .wiki link' }).click();
    const link = details.getByLabel('.wiki link');
    await link.fill('https://example.com/not-the-wiki');
    await link.press('Enter');
    await expect(link).toHaveClass(/invalid/);
    await link.fill('https://monstersandmemories.wiki/items/silver-comb');
    await link.press('Enter');
    await expect(dotWiki).toHaveAttribute('href', 'https://monstersandmemories.wiki/items/silver-comb');
    await details.getByRole('button', { name: '✎ .wiki link' }).click();
    await expect(link).toHaveValue('https://monstersandmemories.wiki/items/silver-comb');
    await link.fill('');
    await link.press('Enter');
    await expect(dotWiki).toHaveAttribute('href', 'https://monstersandmemories.wiki/items/silver-comb-of-house-torvald');

    await details.getByRole('button', { name: '📖 Wiki' }).click();
    await expect(page.locator('app-wiki-card .ptitle')).toHaveText('Silver Comb of House Torvald');
  });

  test('an unknown item: your own note on where it drops; got it, hide, remove', async ({ page }) => {
    await openTool(page, 'Wishlist');
    const card = page.locator('app-wishlist-card');
    const box = card.locator('app-item-search input');
    await box.fill('Silver Comb of House Torvald');
    await box.press('Enter');
    await box.fill('Glowing Pebble');
    await box.press('Enter');

    // Nothing known: it opens so you can say where it drops.
    const pebble = card.locator('.wish', { hasText: 'Glowing Pebble' });
    await expect(pebble.locator('.from')).toHaveText('where? click to add');
    await expect(pebble.locator('app-wish-details')).toContainText('MnMdb has no drop or stat data');
    await expect(pebble.getByRole('link', { name: 'Miraheze ↗' })).toHaveCount(0);
    await expect(pebble.getByRole('link', { name: '.wiki ↗' })).toHaveAttribute('href', 'https://monstersandmemories.wiki/items/glowing-pebble');
    const note = pebble.getByLabel('Where it drops');
    await note.fill('Pebble golems, Glassflats');
    await note.press('Enter');
    await expect(pebble.locator('.from')).toHaveText('Pebble golems, Glassflats');

    // Newest first; adding the same name again doesn't duplicate it.
    await expect(card.locator('.wish .title')).toHaveText(['Glowing Pebble', 'Silver Comb of House Torvald']);
    await box.fill('glowing pebble');
    await box.press('Enter');
    await expect(card.locator('.wish')).toHaveCount(2);

    // Got it: struck through and moved down; the header counts it; hide hides it.
    await pebble.getByRole('checkbox').check();
    await expect(card.locator('.wish .title')).toHaveText(['Silver Comb of House Torvald', 'Glowing Pebble']);
    await expect(card.locator('.wish.got')).toHaveCount(1);
    await expect(card.locator('.head .count')).toHaveText('1/2 got');
    await card.getByTitle("Hide items you've got").click();
    await expect(card.locator('.wish')).toHaveCount(1);

    // Kept after a reload, and in the saved state.
    await page.reload();
    const s = (await savedState(page)).wishlistPanel;
    expect(s.items.map((i: any) => [i.name, i.from, i.got])).toEqual([
      ['Glowing Pebble', 'Pebble golems, Glassflats', true],
      ['Silver Comb of House Torvald', '', false],
    ]);
    expect(s.hideGot).toBe(true);

    // Remove (asks first).
    const comb = page.locator('app-wishlist-card .wish', { hasText: 'Silver Comb' });
    await comb.getByTitle(/^Remove/).click();
    await page.locator('app-confirm-dialog').getByRole('button', { name: 'Remove' }).click();
    await expect(page.locator('app-wishlist-card .empty')).toContainText('Everything here is got');
  });
});

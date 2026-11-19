import { expect, openTool, savedState, test } from '../support/fixtures';

test.describe('gear planner', () => {
  test('paper doll, upgrades with filters, recommendations, and several characters', async ({ page }) => {
    await openTool(page, 'Gear Planner');
    const card = page.locator('app-gear-card');
    // The first character starts with the theme's class.
    await expect(card.getByLabel('Character')).toHaveValue(/.+/);
    await expect(card.getByLabel('Character').locator('option:checked')).toHaveText('Character 1');
    await expect(card.getByLabel('Class')).toHaveValue('Shaman');
    await card.getByLabel('Level').fill('18');
    await card.getByLabel('Race').selectOption({ label: 'Deep Gnome' });

    // Clicking a slot puts the cursor in its search box: just type. Enter takes the first suggestion.
    await card.locator('.doll .slot', { hasText: 'Head' }).click();
    const search = card.getByLabel('Search items for this slot');
    await expect(search).toBeFocused();
    await page.keyboard.type('band');
    await expect(card.locator('.sugg .nm')).toHaveText(['Pirate Bandana']);
    await search.press('Enter');
    await expect(card.locator('.doll .slot', { hasText: 'Head' })).toContainText('Pirate Bandana');
    // Its icon (from Worth the Camp) sits to the right of the name.
    await expect(card.locator('.doll .slot', { hasText: 'Head' }).locator('img.ic')).toHaveAttribute('src', 'https://worththecamp.com/icons/Itemicon0001.png');
    // No gear score; slots filled and stat totals in the middle.
    await expect(card.locator('.sum')).toContainText('1 / 21 slots');
    await expect(card.locator('.sum')).toContainText('Deep Gnome Shaman');
    await expect(card.locator('.sum')).not.toContainText('gear score');
    // Only what fits the slot and a Shaman can wear: no Fighter Helm.
    await search.fill('helm');
    await expect(card.locator('.sugg .nm')).toHaveText(['Guard Helm']);

    // Upgrades: mobs up to your level + 3, no raid, no quest items by default.
    await card.getByRole('tab', { name: 'Upgrades' }).click();
    const names = card.locator('.ups .nm');
    await expect(names.first()).toHaveText('Gnoll Bonestaff');
    await expect(card.getByLabel('Mobs up to level')).toHaveAttribute('placeholder', '21');
    await expect(names).not.toContainText(['Guard Helm']);
    await expect(names).not.toContainText(['Mystic Hood']);
    await expect(names).not.toContainText(['Gnomish Goggles']); // gnomes only
    await expect(card.locator('.ups li', { hasText: 'Gnollhide Cap' })).toHaveCount(0); // worse than the bandana

    await card.getByLabel('Raid').check();
    await expect(names.first()).toHaveText("Tyrant's Crown");
    await card.getByLabel('Raid').uncheck();
    await card.getByLabel('Slot').selectOption({ label: 'Head' });
    await card.getByLabel('Mobs up to level').fill('40');
    await card.getByLabel('Mobs up to level').press('Enter');
    await expect(names).toHaveText(['Guard Helm']);
    await card.getByLabel('Quest & other').check();
    await expect(names).toHaveText(['Mystic Hood', 'Guard Helm']);

    // ⭐ adds it to the Wishlist and shows that panel.
    await expect(page.locator('app-wishlist-card')).toHaveCount(0);
    await card.locator('.ups li', { hasText: 'Guard Helm' }).getByTitle('Add it to your Wishlist').click();
    await expect(page.locator('app-wishlist-card')).toContainText('Guard Helm');

    // Wear it from the list.
    await card.locator('.ups li', { hasText: 'Guard Helm' }).getByRole('button', { name: 'Wear' }).click();
    await card.getByRole('tab', { name: 'Paper doll' }).click();
    await expect(card.locator('.doll .slot', { hasText: 'Head' })).toContainText('Guard Helm');

    // Recommended: the best drop per slot from mobs up to 21, with the drop rate when it's known.
    await card.getByRole('tab', { name: 'Recommended' }).click();
    await expect(card.locator('.lead')).toContainText('up to level 21');
    await expect(names).toHaveText(['Gnoll Bonestaff', 'Pirate Ring', 'Gnoll Toe Ring']);

    // A second character keeps its own gear.
    await card.getByRole('button', { name: '＋' }).click();
    const nameBox = card.getByLabel('Character name');
    await nameBox.fill('Alt');
    await nameBox.press('Enter');
    await expect(card.getByLabel('Character').locator('option:checked')).toHaveText('Alt');
    await card.getByRole('tab', { name: 'Paper doll' }).click();
    await expect(card.locator('.doll .slot', { hasText: 'Head' })).toContainText('—');
    await card.getByLabel('Character').selectOption({ label: 'Character 1' });
    await expect(card.locator('.doll .slot', { hasText: 'Head' })).toContainText('Guard Helm');

    const state = await savedState(page);
    expect(state.gearPanel.characters.map((c: any) => c.name)).toEqual(['Character 1', 'Alt']);
    expect(state.gearPanel.characters[0]).toMatchObject({ cls: 'Shaman', race: 'Dgn', level: 18, gear: { head: { id: 3, name: 'Guard Helm' } } });

    // Still there after a reload.
    await page.reload();
    await expect(page.locator('app-gear-card .doll .slot', { hasText: 'Head' })).toContainText('Guard Helm');
  });

  test('stat weights change the scores, and reset', async ({ page }) => {
    await openTool(page, 'Gear Planner');
    const card = page.locator('app-gear-card');
    await card.locator('.doll .slot', { hasText: 'Head' }).click();
    await card.getByLabel('Search items for this slot').fill('cap');
    await expect(card.locator('.sugg .g')).toHaveText(['+2.15']); // Arcane Ledger's Shaman weights: AC 3 × 0.05 + WIS 2 × 1
    await card.getByLabel('Search items for this slot').blur(); // the doll slides back; the suggestions stay
    await card.locator('.weights summary').click();
    const wis = card.getByLabel('WIS weight');
    await wis.fill('2');
    await wis.press('Enter');
    await expect(card.locator('.weights .chg')).toHaveText('1 changed');
    await expect(card.locator('.sugg .g')).toHaveText(['+4.15']);
    await card.getByRole('button', { name: /Reset to Shaman defaults/ }).click();
    await expect(card.locator('.sugg .g')).toHaveText(['+2.15']);
  });

  test('typing slides the doll away, leaving the slot being edited; blur, Escape or ✕ bring it back', async ({ page }) => {
    await openTool(page, 'Gear Planner');
    const card = page.locator('app-gear-card');
    const doll = card.locator('.doll-wrap');
    const search = card.getByLabel('Search items for this slot');

    // An empty slot: the search has the cursor; typing hides the rest of the doll.
    await card.locator('.doll .slot', { hasText: 'Head' }).click();
    await expect(search).toBeFocused();
    await expect(doll).not.toHaveClass(/collapsed/);
    await page.keyboard.type('pir');
    await expect(doll).toHaveClass(/collapsed/);
    await expect(card.locator('.pinned .slot')).toContainText('Head');

    // Escape clears it and brings the doll back.
    await page.keyboard.press('Escape');
    await expect(doll).not.toHaveClass(/collapsed/);
    await expect(search).toHaveValue('');
    await expect(card.locator('.pinned')).toHaveCount(0);

    // Picking a suggestion with the mouse works (the list keeps the cursor in the search), and the doll comes back.
    await search.click();
    await page.keyboard.type('pir');
    await card.locator('.sugg button', { hasText: 'Pirate Bandana' }).click();
    await expect(doll).not.toHaveClass(/collapsed/);
    await expect(card.locator('.doll .slot', { hasText: 'Head' })).toContainText('Pirate Bandana');

    // Losing focus brings it back too (the suggestions stay).
    await search.click();
    await page.keyboard.type('gno');
    await expect(doll).toHaveClass(/collapsed/);
    await search.blur();
    await expect(doll).not.toHaveClass(/collapsed/);
    await expect(card.locator('.sugg')).toBeVisible();

    // ✕ closes the slot.
    await search.click();
    await expect(doll).toHaveClass(/collapsed/);
    await card.getByTitle('Done', { exact: true }).click();
    await expect(card.locator('.edit')).toHaveCount(0);
    await expect(doll).not.toHaveClass(/collapsed/);

    // A filled slot opens without grabbing the cursor.
    await card.locator('.doll .slot', { hasText: 'Head' }).click();
    await expect(card.locator('.edit')).toBeVisible();
    await expect(search).not.toBeFocused();
  });
});

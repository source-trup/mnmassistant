import type { Page } from '@playwright/test';
import { expect, loadState, openTool, savedState, test } from '../support/fixtures';

const editor = (page: Page) => page.locator('dialog.item-editor');

/** The card shown on hover (not the editor's preview). */
const hoverCard = (page: Page) => page.locator('app-item-tip-layer app-item-card');

function character(gear: Record<string, { id: number; name: string }> = {}) {
  return {
    shown: true, w: 27, h: 34, x: 0, y: 0, view: 'doll', active: 'c1',
    characters: [{ id: 'c1', name: 'Dalgrimm', cls: 'Shaman', race: 'Dgn', look: 'm', level: 18, gear, weights: {} }],
  };
}

test.describe('my items', () => {
  test('make one from a slot search: icon from the wiki, stats, resists; it goes in the slot with its own card', async ({ page }) => {
    await loadState(page, { gearPanel: character() });
    const card = page.locator('app-gear-card');

    await card.locator('.doll .slot', { hasText: 'Head' }).click();
    await card.getByLabel('Search items for this slot').fill('Bone Crown');
    await card.locator('.sugg .create button').click();

    const dlg = editor(page);
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('.name-box')).toHaveValue('Bone Crown');
    await expect(dlg.locator('.chip', { hasText: /^Head$/ })).toHaveAttribute('aria-pressed', 'true');

    // The icon picker lists the wiki's item icons (every page of them); find one by an item that uses it.
    await dlg.getByRole('button', { name: 'Choose icon' }).click();
    await expect(dlg.locator('.grid button')).toHaveCount(3);
    await dlg.getByLabel('Find an icon').fill('bandana');
    await expect(dlg.locator('.grid button')).toHaveCount(1);
    await dlg.locator('.grid button').click();
    await expect(dlg.locator('.icon-btn img')).toHaveAttribute('src', /Itemicon0001\.png$/);

    // Stats and resists, with the card updating as you type.
    const num = (label: string) => dlg.locator('label', { has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) }).locator('input');
    await num('AC').fill('9');
    await num('WIS').fill('4');
    await num('MR').fill('2');
    await dlg.getByPlaceholder('e.g. Grimfang, Fallen Pass').fill('Ferg the Filthy');
    const preview = dlg.locator('app-item-card');
    await expect(preview.locator('.head-stats')).toContainText(/AC\s*9/);
    await expect(preview.locator('.resists')).toContainText(/MR\s*\+2/);
    await dlg.getByRole('button', { name: 'Add item' }).click();
    await expect(dlg).toBeHidden();

    // It's worn, and resting the pointer anywhere on the slot shows its card.
    const head = card.locator('.doll .slot', { hasText: 'Head' });
    await expect(head).toContainText('Bone Crown');
    await page.mouse.move(1650, 950);
    await head.locator('.sl').hover();
    await expect(hoverCard(page).locator('.name')).toHaveText('Bone Crown');
    await expect(hoverCard(page).locator('.attrs').first()).toContainText(/WIS\s*\+4/);
    await expect(hoverCard(page)).toContainText('From: Ferg the Filthy');
    await expect(hoverCard(page).locator('.via')).toHaveText('Details: your own item');
    await expect(head).not.toHaveAttribute('title');

    const s = await savedState(page);
    expect(s.customItems).toHaveLength(1);
    expect(s.customItems[0]).toMatchObject({ name: 'Bone Crown', slots: ['head'], stats: { ac: 9, wis: 4, sv_magic: 2 }, source: 'Ferg the Filthy' });
    expect(s.customItems[0].id).toBeLessThan(0);
    expect(s.gearPanel.characters[0].gear.head).toEqual({ id: s.customItems[0].id, name: 'Bone Crown' });
  });

  test('your items count in Upgrades, can be renamed (worn copies follow) and deleted', async ({ page }) => {
    const crown = { id: -5, name: 'Bone Crown', icon: null, slots: ['head'], stats: { ac: 40, wis: 40 }, dmg: 0, delay: 0, twoHand: false, source: '', added: 1 };
    await loadState(page, { gearPanel: character(), customItems: [crown] });
    const card = page.locator('app-gear-card');

    await card.getByRole('tab', { name: 'Upgrades' }).click();
    const row = card.locator('.ups li', { hasText: 'Bone Crown' });
    await expect(row.locator('.how')).toContainText('🛠 Your item');
    await row.getByRole('button', { name: 'Wear' }).click();

    // Rename it from 🛠 in the header.
    await card.locator('.head').getByTitle(/^My items/).click();
    const dlg = editor(page);
    await dlg.getByLabel('Which item').selectOption({ label: 'Bone Crown' });
    await dlg.locator('.name-box').fill('Ossified Crown');
    await dlg.getByRole('button', { name: 'Save' }).click();
    await card.getByRole('tab', { name: 'Current Gear' }).click();
    await expect(card.locator('.doll .slot', { hasText: 'Head' })).toContainText('Ossified Crown');

    // A name you already use is refused.
    await card.locator('.head').getByTitle(/^My items/).click();
    await dlg.locator('.name-box').fill('ossified crown');
    await dlg.getByRole('button', { name: 'Add item' }).click();
    await expect(dlg.locator('.error')).toContainText('You already have an item called');
    await dlg.getByRole('button', { name: 'Cancel' }).click();

    // Delete it (Shift skips the question): the character keeps the name.
    await card.locator('.head').getByTitle(/^My items/).click();
    await dlg.getByLabel('Which item').selectOption({ label: 'Ossified Crown' });
    await dlg.getByRole('button', { name: 'Delete' }).click({ modifiers: ['Shift'] });
    await expect(dlg).toBeHidden();
    const s = await savedState(page);
    expect(s.customItems).toHaveLength(0);
    expect(s.gearPanel.characters[0].gear.head.name).toBe('Ossified Crown');
  });

  test('Wishlist: make one with 🛠, hover anywhere on a row for its card; an unknown item says so, with no stray tooltip', async ({ page }) => {
    await openTool(page, 'Wishlist');
    const wish = page.locator('app-wishlist-card');

    await wish.getByTitle(/^My items/).click();
    const dlg = editor(page);
    await dlg.locator('.name-box').fill('Gnarled Totem');
    await dlg.locator('.chip', { hasText: /^Primary$/ }).click();
    const num = (label: string) => dlg.locator('label', { has: page.locator('span', { hasText: new RegExp(`^${label}$`) }) }).locator('input');
    await num('Damage').fill('8');
    await num('Delay').fill('30');
    await dlg.getByRole('button', { name: 'Add item' }).click();

    const row = wish.locator('.wish', { hasText: 'Gnarled Totem' });
    await expect(row).toBeVisible();
    await page.mouse.move(1650, 950);
    await row.locator('.price, .from').first().hover();
    await expect(hoverCard(page).locator('.name')).toHaveText('Gnarled Totem');
    await expect(hoverCard(page).locator('.facts').first()).toContainText(/8\s*dmg\s*·\s*30\s*delay/);
    await expect(hoverCard(page).locator('.via')).toHaveText('Details: your own item');

    // It's offered when adding items too.
    await page.mouse.move(1650, 950);
    await wish.locator('app-item-search input').fill('gnarl');
    await expect(wish.locator('app-item-search .list button', { hasText: 'Gnarled Totem' })).toContainText('your item');
    await wish.locator('app-item-search input').fill('');

    // An item nobody knows: the card says so, and there's no "null" tooltip.
    await wish.locator('app-item-search input').fill('Mysterious Pebble');
    await wish.locator('app-item-search input').press('Enter');
    const odd = wish.locator('.wish', { hasText: 'Mysterious Pebble' });
    await expect(odd.locator('.nm')).not.toHaveAttribute('title');
    await page.mouse.move(1650, 950);
    await odd.locator('.row input[type=checkbox]').hover();
    await expect(hoverCard(page).locator('.name')).toHaveText('Mysterious Pebble');
    await expect(hoverCard(page).locator('.missing')).toHaveText('No item data available.');
  });
});

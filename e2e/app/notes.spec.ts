import { Page } from '@playwright/test';
import { addPanel, expect, savedState, test } from '../support/fixtures';

/** Pastes text into an input the way the clipboard would. */
async function paste(page: Page, selector: ReturnType<Page['locator']>, text: string): Promise<void> {
  await selector.evaluate((el, t) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, text);
}

test.describe('notes', () => {
  test('text, size, put away and bring back', async ({ page }) => {
    await addPanel(page, 'Note');
    const note = page.locator('app-note-card');
    await note.locator('textarea').fill('Camp the cemetery at night');
    await note.getByTitle('Larger text').click();
    await note.getByTitle(/^Put away/).click();
    await expect(note).toHaveCount(0);
    await expect(page.locator('.add-btn .badge')).toHaveText('1');

    await page.locator('.add-btn').click();
    await page.locator('#add-menu .saved-note .open').first().click();
    await expect(page.locator('app-note-card textarea')).toHaveValue('Camp the cemetery at night');
    const s = await savedState(page);
    expect(s.notes[0].fontSize).toBe(16);
  });
});

test.describe('checklists', () => {
  test('a pasted list becomes items; click checks; Clear removes checked', async ({ page }) => {
    await addPanel(page, 'Checklist');
    const list = page.locator('app-note-card');
    await paste(page, list.locator('input.add'), '-18xCopper Ore\n-12xTin Ore\n-80xWood');
    await expect(list.locator('.items li')).toHaveCount(3);
    await expect(list.locator('.items li').first()).toContainText('18×');

    await list.locator('.items li', { hasText: 'Tin Ore' }).click();
    await expect(list.locator('.progress')).toContainText('1 / 3');
    await list.getByRole('button', { name: 'Clear ✓' }).click();
    await expect(list.locator('.items li')).toHaveCount(2);
  });

  test('💰 prices each item and totals what is left to buy', async ({ page }) => {
    await addPanel(page, 'Checklist');
    const list = page.locator('app-note-card');
    await paste(page, list.locator('input.add'), '18x Copper Ore\n80x Wood\n2x Mystery Thing');
    await list.getByTitle(/Trem market prices/).click();

    const row = (name: string) => list.locator('.items li', { hasText: name });
    // Copper Ore asks 10, 12, 14 → 12c each; Wood 5c.
    await expect(row('Copper Ore').locator('.pr')).toHaveText(/12c ea ·\s*2s 16c/);
    await expect(row('Wood').locator('.pr')).toHaveText(/5c ea ·\s*4s/);
    await expect(row('Mystery Thing').locator('.pr')).toHaveText('–');
    await expect(list.locator('.foot .cost')).toHaveText('· to buy ~6s 16c');

    await row('Copper Ore').locator('.txt').click(); // check it off
    await expect(list.locator('.foot .cost')).toHaveText('· to buy ~4s');

    await row('Wood').locator('.pr').click();
    await expect(page.locator('app-prices-card .title h3')).toHaveText('Wood');
    expect((await savedState(page)).notes[0].priced).toBe(true);
  });

  test('the wiki materials table pastes too, and duplicates add up', async ({ page }) => {
    await addPanel(page, 'Checklist');
    const list = page.locator('app-note-card');
    const box = list.locator('input.add');
    await paste(page, box, 'Material\tTotal\tFrom\nCopper Ore\n\t18\tgathered or bought\nWood\n\t80\tgathered or bought\n');
    await box.fill('2x Copper Ore');
    await box.press('Enter');
    await expect
      .poll(async () => (await savedState(page)).notes[0].items.map((i: any) => `${i.qty} ${i.text}`))
      .toEqual(['20 Copper Ore', '80 Wood']);
  });
});

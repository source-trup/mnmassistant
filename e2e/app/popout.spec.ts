import type { BrowserContext, Page } from '@playwright/test';
import { addPanel, expect, savedState, test } from '../support/fixtures';

/**
 * The pop-out window. These run the plain pop-up path (what Firefox and Waterfox get): Playwright can't drive
 * Edge/Chrome's Picture-in-Picture window, so the tests hide that feature from the page.
 */
async function withoutPip(page: Page, context: BrowserContext): Promise<void> {
  // The pop-up is a new page; keep its font requests off the internet too.
  await context.route(/^https?:\/\/(?!localhost)/, (route) => route.fulfill({ status: 204, body: '' }));
  await page.addInitScript(() => Object.defineProperty(window, 'documentPictureInPicture', { value: undefined }));
  await page.reload();
  await page.locator('app-root header').waitFor();
}

async function popOut(page: Page, context: BrowserContext, card: ReturnType<Page['locator']>): Promise<Page> {
  const opened = context.waitForEvent('page');
  await card.getByTitle(/^Pop out into its own window/).click();
  const popup = await opened;
  await popup.locator('app-popout-host .list').waitFor();
  return popup;
}

test.describe('pop-out window', () => {
  test('a timer pops out, keeps working, and comes back', async ({ page, context }) => {
    await withoutPip(page, context);
    await page.getByRole('button', { name: '10m', exact: true }).click();
    const popup = await popOut(page, context, page.locator('app-timer-card'));

    // On the board, its spot is kept with a placeholder.
    await expect(page.locator('.board app-timer-card')).toHaveCount(0);
    await expect(page.locator('.popped-slot')).toContainText('In the pop-out window');

    // In the window: styled, themed, and live.
    const timer = popup.locator('app-timer-card');
    await expect(timer.locator('.time')).toHaveText('10:00');
    expect(await popup.evaluate(() => document.documentElement.dataset['theme'])).toBeTruthy();
    expect(await timer.locator('.card').evaluate((el) => getComputedStyle(el).borderRadius)).not.toBe('0px');
    await expect(popup.locator('.pop-hint')).toContainText('keep this window on top');
    await timer.locator('.clock').click();
    await expect(timer.locator('.card')).toHaveAttribute('data-status', 'running');
    await expect(timer.locator('.time')).toHaveText(/^9:5\d$/);
    expect((await savedState(page)).timers[0].endsAt).not.toBeNull();

    // ⤓ puts it back and the window closes.
    const closed = popup.waitForEvent('close');
    await timer.getByTitle('Put back on the board').click();
    await closed;
    await expect(page.locator('.board app-timer-card .card')).toHaveAttribute('data-status', 'running');
    await expect(page.locator('.popped-slot')).toHaveCount(0);
  });

  test('a camp and a timer share the window; loot and confirmations show there', async ({ page, context }) => {
    await withoutPip(page, context);
    await page.getByRole('button', { name: '5m', exact: true }).click();
    await addPanel(page, 'Named / PH');
    const popup = await popOut(page, context, page.locator('app-timer-card'));
    await page.locator('app-counter-card').getByTitle(/^Pop out into its own window/).click();
    await expect(popup.locator('app-counter-card')).toHaveCount(1);
    await expect(popup.locator('app-timer-card')).toHaveCount(1);
    await expect(page.locator('.popped-slot')).toHaveCount(2);

    // A named kill: the loot drawer opens in the pop-out, not the main page.
    const camp = popup.locator('app-counter-card');
    await camp.getByRole('button', { name: /\+ Named/ }).click();
    await expect(camp.locator('.big.named')).toHaveText('1');
    await expect(popup.locator('app-loot-prompt .drawer')).toBeVisible();
    await expect(page.locator('app-loot-prompt .drawer')).toHaveCount(0);
    await popup.locator('app-loot-prompt').getByRole('button', { name: 'Skip' }).click();

    // Deleting asks in the pop-out; the last panel leaving closes the window.
    await popup.locator('app-timer-card').getByTitle(/^Delete/).click();
    await expect(popup.locator('app-confirm-dialog dialog')).toBeVisible();
    await expect(page.locator('app-confirm-dialog dialog[open]')).toHaveCount(0);
    await popup.locator('app-confirm-dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(popup.locator('app-timer-card')).toHaveCount(0);
    const closed = popup.waitForEvent('close');
    await camp.getByTitle(/^Delete/).click();
    await popup.locator('app-confirm-dialog').getByRole('button', { name: 'Delete' }).click();
    await closed;
    await expect(page.locator('.popped-slot')).toHaveCount(0);
    expect((await savedState(page)).counters).toHaveLength(0);
  });

  test('closing the window puts everything back', async ({ page, context }) => {
    await withoutPip(page, context);
    await page.getByRole('button', { name: '8m', exact: true }).click();
    const popup = await popOut(page, context, page.locator('app-timer-card'));
    await popup.close();
    await expect(page.locator('.board app-timer-card')).toHaveCount(1);
    await expect(page.locator('.popped-slot')).toHaveCount(0);
    // And it can pop out again.
    const again = await popOut(page, context, page.locator('app-timer-card'));
    await expect(again.locator('app-timer-card')).toHaveCount(1);
  });
});

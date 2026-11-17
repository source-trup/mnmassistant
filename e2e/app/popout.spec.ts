import type { BrowserContext, Page } from '@playwright/test';
import { addPanel, addTimer, expect, savedState, test } from '../support/fixtures';

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
    await addTimer(page, 10);
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

  test('a timer and a Named / PH timer share the window; loot and confirmations show there', async ({ page, context }) => {
    await withoutPip(page, context);
    await addTimer(page, 5);
    await addPanel(page, 'Named / PH timer');
    const popup = await popOut(page, context, page.locator('app-timer-card'));
    await page.locator('app-camp-card').getByTitle(/^Pop out into its own window/).click();
    await expect(popup.locator('app-camp-pop-card')).toHaveCount(1);
    await expect(popup.locator('app-timer-card')).toHaveCount(1);
    await expect(page.locator('.popped-slot')).toHaveCount(2);

    // A named kill: the loot drawer opens in the pop-out, not the main page.
    const camp = popup.locator('app-camp-pop-card');
    await camp.getByRole('button', { name: '+ Named' }).click();
    await expect(camp.locator('.named b')).toHaveText('1');
    await expect(popup.locator('app-loot-prompt .drawer')).toBeVisible();
    await expect(page.locator('app-loot-prompt .drawer')).toHaveCount(0);
    await popup.locator('app-loot-prompt').getByRole('button', { name: 'Skip' }).click();

    // Deleting asks in the pop-out.
    await popup.locator('app-timer-card').getByTitle(/^Delete/).click();
    await expect(popup.locator('app-confirm-dialog dialog')).toBeVisible();
    await expect(page.locator('app-confirm-dialog dialog[open]')).toHaveCount(0);
    await popup.locator('app-confirm-dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(popup.locator('app-timer-card')).toHaveCount(0);

    // The last panel leaving closes the window.
    const closed = popup.waitForEvent('close');
    await camp.getByTitle('Put back on the board').click();
    await closed;
    await expect(page.locator('.popped-slot')).toHaveCount(0);
    await expect(page.locator('.board app-camp-card .big.named')).toHaveText('1');
  });

  test('a Named / PH timer pops out as one compact panel', async ({ page, context }) => {
    await withoutPip(page, context);
    await addPanel(page, 'Named / PH timer');
    await addTimer(page, 10); // stays on the board
    const popup = await popOut(page, context, page.locator('app-camp-card'));
    const compact = popup.locator('app-camp-pop-card');
    await expect(compact).toHaveCount(1);
    await expect(popup.locator('app-timer-card, app-camp-card')).toHaveCount(0);
    await expect(page.locator('.popped-slot')).toHaveCount(1);
    await expect(page.locator('.board app-timer-card')).toHaveCount(1);

    // Much smaller than the panel on the board (340 px).
    expect((await compact.boundingBox())!.height).toBeLessThan(200);

    // + PH counts and restarts the countdown; the countdown can be paused and started by itself too.
    await expect(compact.locator('.time')).toHaveText('6:00');
    await compact.getByRole('button', { name: '+ PH' }).click();
    await expect(compact.locator('.ph b')).toHaveText('1');
    await expect(compact.locator('.card')).toHaveAttribute('data-status', 'running');
    await compact.getByTitle('Pause').click();
    await expect(compact.locator('.card')).toHaveAttribute('data-status', 'paused');
    await compact.locator('.clock').click();
    await expect(compact.locator('.card')).toHaveAttribute('data-status', 'running');

    // ⤓ puts it back.
    const closed = popup.waitForEvent('close');
    await compact.getByTitle('Put back on the board').click();
    await closed;
    await expect(page.locator('.board app-camp-card .big.ph')).toHaveText('1');
    await expect(page.locator('.board app-camp-card .card')).toHaveAttribute('data-status', 'running');
  });

  test('closing the window puts everything back', async ({ page, context }) => {
    await withoutPip(page, context);
    await addTimer(page, 8);
    const popup = await popOut(page, context, page.locator('app-timer-card'));
    await popup.close();
    await expect(page.locator('.board app-timer-card')).toHaveCount(1);
    await expect(page.locator('.popped-slot')).toHaveCount(0);
    // And it can pop out again.
    const again = await popOut(page, context, page.locator('app-timer-card'));
    await expect(again.locator('app-timer-card')).toHaveCount(1);
  });
});

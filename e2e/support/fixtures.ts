import { Page, expect, test as base } from '@playwright/test';
import { atlasPage, mnmdbAuctions, mnmdbEa, mnmdbVendors, wikiApi } from './sample-data';

export { expect };

export const STORAGE_KEY = 'mnm-assistant.state.v1';

/**
 * Every app test gets a page that:
 *  - starts on an empty board (a returning visitor, so the quick guide stays closed), and
 *  - never reaches the real internet: MnMdb, the wiki API and MnM Atlas answer with sample data; anything else
 *    outside the app (fonts, images) gets an empty reply.
 * Use `freshVisit` instead when a test needs the very first visit.
 */
export const test = base.extend<{ freshVisit: Page }>({
  page: async ({ page }, use) => {
    await mockOutside(page);
    await page.addInitScript((key) => {
      // Only on the first load of the test: later reloads keep what the test did.
      if (!sessionStorage.getItem('e2e-started')) {
        sessionStorage.setItem('e2e-started', '1');
        localStorage.clear();
        localStorage.setItem(key, JSON.stringify({ version: 5, timers: [], counters: [] }));
      }
    }, STORAGE_KEY);
    await page.goto('/');
    await page.locator('app-root header').waitFor();
    await use(page);
  },
  freshVisit: async ({ browser }, use) => {
    const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
    await mockOutside(page);
    await page.goto('/');
    await use(page);
    await page.close();
  },
});

async function mockOutside(page: Page): Promise<void> {
  // Playwright tries the most recently added route first, so this catch-all goes first and the specific ones after.
  // Everything else outside the app (fonts, images): empty, so tests are quick and offline.
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.fulfill({ status: 204, body: '' }));
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
  await page.route('https://mnm-db.com/**', (route) => {
    const file = new URL(route.request().url()).pathname.slice(1);
    if (file === 'auctions.json') return route.fulfill(json(mnmdbAuctions()));
    if (file === 'data-ea.json') return route.fulfill(json(mnmdbEa));
    if (file === 'vendors.json') return route.fulfill(json(mnmdbVendors));
    return route.fulfill({ status: 404 });
  });
  await page.route('https://monstersandmemories.miraheze.org/w/api.php**', (route) =>
    route.fulfill(json(wikiApi(new URL(route.request().url()).searchParams))),
  );
  await page.route('https://www.mnmatlas.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: atlasPage(route.request().url()) }),
  );
}

// ---------- helpers ----------

/** The saved app state (after letting the app finish rendering, so the latest change has been saved). */
export async function savedState(page: Page): Promise<any> {
  return page.evaluate(
    (key) =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(JSON.parse(localStorage.getItem(key) ?? 'null')))),
      ),
    STORAGE_KEY,
  );
}

/** Replaces the saved state and reloads (for setting up a board in one step). */
export async function loadState(page: Page, state: Record<string, unknown>): Promise<void> {
  await page.evaluate(([key, s]) => localStorage.setItem(key as string, JSON.stringify(s)), [STORAGE_KEY, { version: 5, timers: [], counters: [], ...state }]);
  await page.reload();
  await page.locator('app-root header').waitFor();
}

/** Opens a panel from Tools (and closes the menu). */
export async function openTool(page: Page, name: string): Promise<void> {
  await page.locator('.tools-btn').click();
  await page.locator('#tools-menu .item').filter({ has: page.locator('.nm', { hasText: new RegExp(`^${name}$`) }) }).click();
  await page.keyboard.press('Escape');
}

/** Adds a panel from the "＋ Add" menu. */
export async function addPanel(page: Page, name: string): Promise<void> {
  await page.locator('.add-btn').click();
  await page.locator('#add-menu .item').filter({ has: page.locator('.nm', { hasText: new RegExp(`^${name}$`) }) }).click();
}

/** Drags with the mouse from the centre of one element by (dx, dy). */
export async function dragBy(page: Page, selector: ReturnType<Page['locator']>, dx: number, dy: number): Promise<void> {
  const b = (await selector.boundingBox())!;
  await page.mouse.move(b.x + Math.min(30, b.width / 2), b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + Math.min(30, b.width / 2) + dx, b.y + b.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

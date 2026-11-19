import { MINUTE, addPanel, expect, loadState, savedState, test } from '../support/fixtures';
import type { Page } from '@playwright/test';

const card = (page: Page) => page.locator('app-session-card');
const confirmBtn = (page: Page, name: string) => page.locator('app-confirm-dialog').getByRole('button', { name });

function sessionTimer(sessions: unknown[] = [], extra: Record<string, unknown> = {}) {
  return { id: 's1', name: 'Crypt', autoNamed: false, durationMs: 0, endsAt: null, pausedRemainingMs: null, repeat: false, x: 0, y: 0, mode: 'session', sessions, ...extra };
}

function counter(id: string, name: string, value: number, extra: Record<string, unknown> = {}) {
  return { id, kind: 'standard', name, value, step: 1, target: null, since: Date.now(), x: -1, y: -1, ...extra };
}

test.describe('Session timer', () => {
  test('counts up in sessions, with pause, and holds counters you add and edit', async ({ page }) => {
    await addPanel(page, 'Session timer');
    const c = card(page);
    await expect(c.locator('.time')).toHaveText('0:00');
    await expect(c.locator('.sub')).toContainText('click to start a session');

    // Start, pause, resume.
    await c.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(c.locator('.sub')).toContainText('session going');
    await expect(c.locator('.time')).toHaveText('0:01', { timeout: 3000 });
    await c.locator('.clock').click();
    await expect(c.locator('.sub')).toContainText('paused');
    const paused = await c.locator('.time').textContent();
    await page.waitForTimeout(1200);
    await expect(c.locator('.time')).toHaveText(paused!);
    await c.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(c.locator('.sub')).toContainText('session going');

    // A counter of its own.
    await expect(c.locator('.empty')).toContainText('drag a counter panel onto this timer');
    await c.getByRole('button', { name: '＋ Counter' }).click();
    await page.keyboard.type('Kills');
    await page.keyboard.press('Enter');
    const row = c.locator('.row');
    await expect(row.locator('.nm')).toHaveText('Kills');
    await row.getByTitle('Add 1').click();
    await row.getByTitle('Add 1').click();
    await expect(row.locator('.val')).toHaveText('2');
    await row.getByTitle('Subtract 1').click();
    await expect(row.locator('.val')).toHaveText('1');

    // Right-click the count to type it; right-click the name to rename.
    await row.locator('.val').click({ button: 'right' });
    await page.keyboard.type('7');
    await page.keyboard.press('Enter');
    await expect(row.locator('.val')).toHaveText('7');
    await row.locator('.nm').click({ button: 'right' });
    await page.keyboard.type('Skeletons');
    await page.keyboard.press('Enter');
    await expect(row.locator('.nm')).toHaveText('Skeletons');

    // It lives in the timer, not on the board.
    await expect(page.locator('app-counter-card')).toHaveCount(0);

    // End the session: kept, with what was counted.
    await c.getByRole('button', { name: 'End session' }).click();
    await expect(c.locator('.sub')).toContainText('click to start a session');
    let s = await savedState(page);
    const t = s.timers.find((x: any) => x.mode === 'session');
    expect(t.sessions).toHaveLength(1);
    expect(t.sessions[0].end).not.toBeNull();
    expect(Object.values(t.sessions[0].counts).map((x: any) => x.total)).toEqual([7]);

    // Counting with no session going starts a new one, from 0.
    await row.getByTitle('Add 1').click();
    await expect(row.locator('.val')).toHaveText('1');
    await expect(c.locator('.sub')).toContainText('session going');

    await page.reload();
    await expect(card(page).locator('.row .nm')).toHaveText('Skeletons');
    await expect(card(page).locator('.row .val')).toHaveText('1');
    await expect(card(page).locator('.sub')).toContainText('session going');
    s = await savedState(page);
    expect(s.timers[0].sessions).toHaveLength(2);
  });

  test('drag a counter onto it: asks first, then the counter moves in (and can move back out)', async ({ page }) => {
    await loadState(page, { timers: [sessionTimer()], counters: [counter('k', 'Kills', 5, { x: 20, y: 0 })] });
    const counterPanel = page.locator('app-counter-card');
    await expect(counterPanel).toHaveCount(1);

    const dragOnto = async () => {
      // Hovering waits for the panels to stop moving into place.
      await counterPanel.locator('.head .grip').hover();
      const to = (await card(page).boundingBox())!;
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
      await expect(page.locator('.panel.drop-target')).toHaveCount(1);
      await page.mouse.up();
    };

    // Cancel: nothing changes.
    await dragOnto();
    await expect(page.locator('app-confirm-dialog dialog[open]')).toContainText('Add "Kills" to "Crypt"?');
    await confirmBtn(page, 'Cancel').click();
    await expect(counterPanel).toHaveCount(1);
    await expect(card(page).locator('.row')).toHaveCount(0);

    // Add: the counter panel goes, its count shows in the timer.
    await dragOnto();
    await confirmBtn(page, 'Add').click();
    await expect(counterPanel).toHaveCount(0);
    await expect(card(page).locator('.row .nm')).toHaveText('Kills');
    await expect(card(page).locator('.row .val')).toHaveText('5');
    expect((await savedState(page)).counters[0].timerId).toBe('s1');

    // Move it back out from the timer's settings.
    await card(page).getByTitle('Settings').click();
    await card(page).getByRole('button', { name: 'Move to board' }).click();
    await card(page).getByRole('button', { name: 'Done' }).click();
    await expect(counterPanel).toHaveCount(1);
    await expect(card(page).locator('.row')).toHaveCount(0);
  });

  test('a counter on the board can also be moved in from ＋ Counter', async ({ page }) => {
    await loadState(page, { timers: [sessionTimer()], counters: [counter('k', 'Kills', 3, { x: 20, y: 0 })] });
    await card(page).getByRole('button', { name: '＋ Counter' }).click();
    await card(page).locator('.adder select').selectOption({ label: 'Kills (3)' });
    await expect(page.locator('app-counter-card')).toHaveCount(0);
    await expect(card(page).locator('.row .val')).toHaveText('3');
  });

  test('✕ on a counter row deletes it (after asking); its counts stay in the stats', async ({ page }) => {
    const going = {
      id: 'a',
      start: Date.now() - 10 * MINUTE,
      end: null,
      elapsedMs: 0,
      runningSince: Date.now() - 10 * MINUTE,
      counts: { k: { name: 'Kills', total: 4, marks: [[2, 4]] } },
    };
    await loadState(page, {
      timers: [sessionTimer([going])],
      counters: [counter('k', 'Kills', 4, { timerId: 's1' }), counter('l', 'Loot', 1, { timerId: 's1' })],
    });
    const rows = card(page).locator('.row');
    await expect(rows).toHaveCount(2);

    // Cancel keeps it.
    await rows.first().getByRole('button', { name: 'Delete Kills' }).click();
    await expect(page.locator('app-confirm-dialog dialog[open]')).toContainText('Delete "Kills"? Its counts stay in the session stats.');
    await confirmBtn(page, 'Cancel').click();
    await expect(rows).toHaveCount(2);

    await rows.first().getByRole('button', { name: 'Delete Kills' }).click();
    await confirmBtn(page, 'Delete').click();
    await expect(rows).toHaveCount(1);
    await expect(rows.locator('.nm')).toHaveText('Loot');

    // Shift+click skips the question.
    await rows.first().getByRole('button', { name: 'Delete Loot' }).click({ modifiers: ['Shift'] });
    await expect(rows).toHaveCount(0);
    await expect(card(page).locator('.empty')).toBeVisible();

    const s = await savedState(page);
    expect(s.counters).toHaveLength(0);
    expect(s.timers[0].sessions[0].counts.k.total).toBe(4);
    await card(page).getByTitle('Stats: this session and all time, with charts').click();
    await expect(page.locator('app-session-stats tbody tr')).toContainText(/Kills\s*4/);
  });

  test('deleting the timer deletes its counters too', async ({ page }) => {
    await loadState(page, { timers: [sessionTimer()], counters: [counter('k', 'Kills', 3, { timerId: 's1' })] });
    await card(page).locator('.head').getByTitle('Delete (Shift+click to skip confirmation)').click();
    await expect(page.locator('app-confirm-dialog dialog[open]')).toContainText('Its 1 counter will be deleted too');
    await confirmBtn(page, 'Delete').click();
    await expect(card(page)).toHaveCount(0);
    expect((await savedState(page)).counters).toHaveLength(0);
  });

  test('stats: one session with its running-count chart, and all time with a bar per session', async ({ page }) => {
    const now = Date.now();
    const a = {
      id: 'a',
      start: now - 180 * MINUTE,
      end: now - 120 * MINUTE,
      elapsedMs: 60 * MINUTE,
      runningSince: null,
      counts: {
        k: { name: 'Kills', total: 30, marks: [[0, 10], [30, 20]] },
        l: { name: 'Loot', total: 3, marks: [[45, 3]] },
      },
    };
    const b = { id: 'b', start: now - 30 * MINUTE, end: now - 10 * MINUTE, elapsedMs: 20 * MINUTE, runningSince: null, counts: { k: { name: 'Kills', total: 12, marks: [[5, 12]] } } };
    // "Loot" was deleted since: it's only in the history.
    await loadState(page, { timers: [sessionTimer([a, b])], counters: [counter('k', 'Kills', 12, { timerId: 's1' })] });

    await card(page).getByTitle('Stats: this session and all time, with charts').click();
    const stats = page.locator('app-session-stats');
    await expect(stats.locator('h3')).toContainText('Crypt — stats');

    // The newest session first.
    await expect(stats.locator('.tiles')).toContainText(/Session time\s*20:00/);
    await expect(stats.locator('tbody tr')).toHaveCount(1);
    await expect(stats.locator('tbody tr').first()).toContainText(/Kills\s*12\s*36/);
    await expect(stats.locator('app-session-line-chart path.line')).toHaveCount(1);
    await expect(stats.locator('.legend')).toHaveCount(0); // one line: the heading names it

    // The older one: two counters, two lines and a legend.
    await stats.getByLabel('Which session').selectOption('a');
    await expect(stats.locator('app-session-line-chart path.line')).toHaveCount(2);
    await expect(stats.locator('.legend li')).toHaveText(['Kills', 'Loot']);
    await expect(stats.locator('tbody tr').nth(1)).toContainText(/Loot\s*3\s*3/);

    // Hover: the tooltip lists every counter at that minute.
    const svg = stats.locator('app-session-line-chart svg');
    const box = (await svg.boundingBox())!;
    await page.mouse.move(box.x + box.width - 45, box.y + box.height / 2);
    await expect(stats.locator('app-session-line-chart .tip')).toContainText(/30\s*Kills/);
    await expect(stats.locator('app-session-line-chart .tip')).toContainText(/3\s*Loot/);

    // All time.
    await stats.getByRole('button', { name: 'All time' }).click();
    await expect(stats.locator('.tiles')).toContainText(/Sessions\s*2/);
    await expect(stats.locator('.tiles')).toContainText(/Time counted\s*1:20:00/);
    await expect(stats.locator('tbody tr').first()).toContainText(/Kills\s*42\s*31\.5\s*30/);
    await expect(stats.locator('app-session-bar-chart g.bar')).toHaveCount(2);
    await stats.getByRole('button', { name: 'Per hour' }).click();
    await expect(stats.locator('app-session-bar-chart text.end')).toHaveText('36');
    await expect(stats.locator('.sessions li')).toHaveCount(2);

    // Delete a session (Shift skips the question).
    await stats.locator('.sessions li').first().getByTitle(/Delete this session/).click({ modifiers: ['Shift'] });
    await expect(stats.locator('.sessions li')).toHaveCount(1);
    await expect(stats.locator('.tiles')).toContainText(/Sessions\s*1/);
    expect((await savedState(page)).timers[0].sessions.map((s: any) => s.id)).toEqual(['a']);
  });
});

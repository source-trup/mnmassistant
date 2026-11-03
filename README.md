# MnM Assistant

*Dalgrimm's spirit ledger.* A companion app for **Monsters & Memories** that lives on your second monitor and keeps
track of the things you'd otherwise scribble on paper: spawn timers, placeholder and named counts, what dropped, and
when your buffs are about to fade.

It runs locally in your browser. Nothing is sent anywhere. The one exception is optional item search against the
Monsters and Memories Wiki.

---

## Contents

- [Quick start](#quick-start)
- [The board](#the-board)
- [Timers](#timers)
- [Counters](#counters)
- [Camp history and loot](#camp-history-and-loot)
- [Buff Tracker](#buff-tracker)
- [Alerts: chimes and voice](#alerts-chimes-and-voice)
- [Saving, loading and backups](#saving-loading-and-backups)
- [Themes](#themes)
- [Wiki item search (optional)](#wiki-item-search-optional)
- [Entering times](#entering-times)
- [Tips and known limits](#tips-and-known-limits)
- [For developers](#for-developers)

---

## Quick start

Requirements: [Node.js](https://nodejs.org/) 22 or 24 LTS. Newer versions also work but print engine warnings.

```bash
npm install     # first time only
npm start
```

Open **http://localhost:4200** in a browser window and drag it onto your second monitor.

> Click anywhere in the app once after opening it. Browsers block sound until you interact with the page.
> ☰ → **Test sound & voice** is a good first click.

Everything you do is saved automatically. Closing the browser doesn't stop running timers: they're stored as end
times, so they're still correct when you come back.

---

## The board

The page is a free-form board of panels. There are three panel types: **timers**, **counters** and **Buff Trackers**.

| Action | How |
| --- | --- |
| Move a panel | Drag it by its **header** (the title bar with ⠿). A dot grid appears while you drag. |
| See where it will land | A dashed outline shows the snap spot: **green** is free, **red** would overlap (the panel springs back). |
| Neat layout | **Tidy** in the toolbar packs every panel onto the grid, keeping their order. |
| Delete a panel | **✕** in its header asks for confirmation. **Shift + click ✕** deletes immediately. |
| Panel settings | **⚙** in its header. |

Panels snap to a 20px grid with a built-in gutter, so panels placed side by side are always evenly spaced.

### Toolbar

| Section | Buttons |
| --- | --- |
| **Add timer** | `5m` `6m` `8m` `10m` (common placeholder respawns), or type a custom time in the box and press Enter / `+` |
| **Add** | `Count` (standard counter), `Named / PH` (camp counter), `Buff Tracker` |
| Right side | `Tidy`, 🔔 / 🔕 mute all alerts, ☰ menu |

**☰ menu:** Save layout to file, Load layout from file, Reset all timers, Reset all counters, Theme switch, Test
sound & voice.

---

## Timers

Countdown timers for respawns, events, or anything else.

| Action | How |
| --- | --- |
| Start / restart | Click the **big clock**. While running, a click restarts from full. |
| Pause / resume | **Pause** and **Resume** buttons. Clicking the clock while paused also resumes. |
| Nudge | **−1m / +1m**. While running or paused they change the time **remaining**. While stopped they change the timer's **length** (minimum 1:00). |
| Stop | **Reset** |

**States:** grey = stopped · blue (Spirit theme) or green (Classic) = running · amber = paused ·
**red pulsing "READY"** = finished, with a counter showing how long ago it finished (`+1:23`), handy for "it spawned
a minute ago".

**Settings (⚙):** name, duration, **auto-repeat** (starts over by itself at zero).

A 🔗 in the header means a counter restarts this timer (see [linking](#linking-a-counter-to-a-timer)). A ↻ means
auto-repeat is on.

---

## Counters

### Standard counter (`Count`)

A single number starting at 0.

- **+** or clicking the number adds one step. **−** subtracts.
- Shows a **per-hour rate** since the last reset.
- **Settings:** name, value, step size, optional **goal**. A goal displays as `12 / 20` and the counter turns
  highlighted when reached.

### Named / PH counter (`Named / PH`)

Built for camping a named mob and its placeholders.

| Button | Does |
| --- | --- |
| **+ PH** | +1 placeholder, logs the kill, restarts the linked timer |
| **+ Named** | +1 named, logs the kill, restarts the linked timer, then opens the [loot drawer](#recording-loot) |
| **−PH / −N** | Undo a mis-click. Removes the latest kill of that type (the timer isn't touched). |
| **📜** | Opens the [camp history](#camp-history-and-loot) |
| **Reset** | Zeroes the counts (asks first). The kill log is **kept**. |

The panel also shows **PH since the last named**, **how long ago the last named died**, and the kill rate. Hover the
"named … ago" text for the named odds.

### Linking a counter to a timer

In a counter's **⚙ settings**, choose a timer under **Timer**. From then on:

- **Named/PH counter:** **+ PH** and **+ Named** each restart that timer at full time, even mid-countdown. A **↻** on
  the buttons shows the link is active.
- **Standard counter:** **+** restarts the timer.

The timer restarts **the instant you click**. It never waits for loot entry or anything else.

---

## Camp history and loot

### Recording loot

After **+ Named**, a **"Named down!"** drawer slides in on the right. It doesn't block anything else on the board.

- Type an item name and press **Enter**. Add as many items as dropped.
- Suggestions come from items you've entered before, and from the wiki if [item search](#wiki-item-search-optional)
  is set up. Use ↑/↓ and Enter, or click a suggestion.
- Entering loot is **optional**: **Skip** closes the drawer without adding anything. If several nameds die quickly,
  the drawer shows "+1 more" and steps through them.

### History view (📜)

Toggle between **Session** (since the counter's last reset) and **All time**.

- **Stats:** placeholders, named, named odds ("1 in 7.0"), last named, typical respawn (median time between kills),
  last respawn, longest PH streak, kills/hr, named/hr.
- **Loot summary:** every item with its count and drop rate per named kill.
- **Kill log:** newest first, with timestamps.
  - **loot** on a named kill adds or removes items inline.
  - **✕** deletes an entry (Shift + click skips the confirmation). Deleting a kill from the current session also
    corrects the counts.
- **Clear history** erases the log for this camp (counts unchanged).

The log keeps up to 5,000 kills per camp.

---

## Buff Tracker

A panel listing your buffs, with reminders before they fade.

| Action | How |
| --- | --- |
| Add a buff | Quick-add **10m · 20m · 35m · 1h** along the bottom of the panel (the most common MnM buff lengths), or **＋** in the header for a custom one |
| Cast / recast | Click the buff. It counts down from full. |
| Clear | **✕** next to an active buff |
| Edit | **⚙**: rename the panel; for each buff set name, duration and **warn at** (default 1:00), reorder ▲▼, remove |

**States:** grey = not active · green = active · **amber pulsing** = within the warn time · **red "FADED"** = expired.

New buffs are named after their length (`35:00 buff`) until you rename them, for example to *Spirit of the Wolf*.
Renamed buffs are spoken aloud; see [alerts](#alerts-chimes-and-voice). You can have several Buff Trackers, such
as one for self buffs and one for group buffs.

---

## Alerts: chimes and voice

| Event | Name you gave it | Generated name (`6:00 spawn`, `35:00 buff`) |
| --- | --- | --- |
| Timer reaches zero | 🔊 *"Goblin PH is up"* | chime |
| Buff enters its warn time | 🔊 *"Spirit of the Wolf is fading"* | chime |
| Buff expires | 🔊 *"Spirit of the Wolf has faded"* | chime |

- Spoken alerts use your system's text-to-speech voice, preceded by a soft ping.
- 🔔 / 🔕 in the toolbar mutes everything.
- Things that expired while the app was closed don't all go off at once when you reopen it.

---

## Saving, loading and backups

Everything saves automatically to your browser (`localStorage`). To keep a copy outside the browser, or to switch
between setups such as one layout per camp:

- **☰ → Save layout to file…** writes a `.json` file with every panel and its position, counts, settings, the full
  kill and loot history, and your theme.
- **☰ → Load layout from file…** replaces the whole board with a saved file, after confirming. Timers and buffs come
  back **stopped**.

> Browser data can be wiped by clearing site data or using a different browser or profile. Save a layout file now
> and then if your history matters to you.

---

## Themes

☰ → **Theme** switches between:

- **Spirit** (default): spirit green is the dominant color, and running timers are a cool spirit blue.
- **Classic**: darker cave-stone look with green accents and green running timers.

The decorations are the same in both: Dalgrimm's glowing eyes, the ghostly veil under the toolbar, the slowly
turning rune circle ("the Spirals"), bioluminescent mushrooms, a carved spirit stone, drifting mist and spirit
motes. All animation stops if your system's *reduce motion* setting is on.

---

## Wiki item search (optional)

Loot entry can autocomplete item names from the [Monsters and Memories Wiki](https://monstersandmemories.wiki/) using
its partner API. This needs an API key (`mnmp_…`), which only a **wiki Site Admin** can issue.

1. Put the key in a file named **`wiki-api-key.txt`** in the project folder (git-ignored), **or** set the
   **`MNM_WIKI_KEY`** environment variable.
2. Restart `npm start`. The console prints `[wiki] Partner API key loaded — wiki item search enabled.`

How it works: the app calls `/api/partner/v1/...` on its own address, and the dev server (`proxy.conf.mjs`)
forwards those calls to the wiki with your key attached. The key never reaches the browser. Items picked from the
wiki link to their wiki page in the history.

Without a key everything else works, and suggestions come from your own past entries.

*Data from the Monsters and Memories Wiki — https://monstersandmemories.wiki/*

> The wiki integration is built from the wiki's published API specification. It hasn't been tested against a live
> key yet.

---

## Entering times

Anywhere you type a duration (custom timer, timer and buff settings):

| You type | Means |
| --- | --- |
| `6` | 6 minutes (a plain number is minutes) |
| `6:40` | 6 min 40 s |
| `1:30:00` | 1 h 30 min |
| `90s`, `5m`, `1h30m`, `2m 15s` | as written |

---

## Tips and known limits

- **Clicks only, no hotkeys.** While the game window is focused, the browser can't see your keypresses. Global
  hotkeys would need the app wrapped in a desktop shell such as Electron.
- **Give camp timers real names** ("Goblin PH") so you hear *which* one is up when several are running.
- Set a timer's length once and click the clock (or + PH / + Named on a linked counter) on every kill. That one click
  is the whole workflow.
- Wiki search relies on the dev server's proxy, so it only works via `npm start`, not from a static build.

---

## For developers

Built with **Angular 22** (standalone components, signals, zoneless change detection), SCSS, and no UI libraries.

```text
src/
  styles.scss               Global styles and both color themes (CSS variables)
  app/
    app.*                   Shell: toolbar, ☰ menu, drag-and-drop board, save/load
    tracker.store.ts        All state (signals), persistence, alerts loop, layout logic
    models.ts               Data types (timers, counters, camp events, buffs, saved state)
    layout.ts               Grid size, panel footprints, collision and free-spot search
    time.ts                 Duration parsing/formatting helpers
    alerts.service.ts       Web Audio chimes and speech
    wiki.service.ts         Wiki partner API item search (via dev-server proxy)
    confirm.service.ts      In-app confirmation dialogs (+ confirm-dialog.ts)
    timer-card/             Timer panel
    counter-card/           Standard and Named/PH panels, camp-history dialog
    buff-card/              Buff Tracker panel
    loot/                   Loot drawer and item autocomplete
    art/                    SVG art: Dalgrimm's eyes logo, background scene
proxy.conf.mjs              Dev-server proxy that adds the wiki API key
```

**Notes**

- State lives in `TrackerStore` signals and is written to `localStorage` (key `mnm-assistant.state.v1`) by an
  `effect`. Older saved data is upgraded on load by `normalizeState`, which also validates layout files.
- A 250 ms tick drives all countdowns. Timers and buffs store absolute end times, so they stay accurate across sleep
  and reloads.
- Panel positions are grid cells. Footprints in `layout.ts` include one cell of gutter. The drawn size is
  `(w − 1) × 20px` by `(h − 1) × 20px`.
- Theme colors are CSS variables in `styles.scss`: `:root` is Classic, and `:root[data-theme='spirit']` overrides
  them.

**Commands**

```bash
npm start          # dev server with wiki proxy at http://localhost:4200
npx ng build       # production build to dist/
```

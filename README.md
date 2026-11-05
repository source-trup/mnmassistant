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
- [Notes](#notes)
- [Naughty and Nice lists](#naughty-and-nice-lists)
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

### Hosted version

The app is also published at **https://source-trup.github.io/mnmassistant/**, with nothing to install. Everything works the same
except wiki item search, which needs the local dev server. Data is saved per browser *and per address*, so the hosted
site and `localhost` keep separate boards. To move a board between them, use ☰ → Save layout / Load layout.

---

## The board

The page is a free-form board of panels. There are four panel types: **timers**, **counters**, **Buff Trackers** and **notes**.

| Action | How |
| --- | --- |
| Move a panel | Drag it by its **header** (the title bar with ⠿). A dot grid appears while you drag. |
| See where it will land | A dashed outline shows the snap spot: **green** is free, **red** would overlap (the panel springs back). |
| Neat layout | **Tidy** in the toolbar packs every panel onto the grid, keeping their order. |
| Delete a panel | **✕** in its header asks for confirmation. **Shift + click ✕** deletes immediately. |
| Rename a panel | **Right-click its title**, type, then Enter (or click away). Esc cancels. Works on every panel type. |
| Panel settings | **⚙** in its header. |

Panels are 280px wide and snap to a 20px grid with a built-in gutter, so panels placed side by side are always
evenly spaced. (Boards saved when panels were narrower are tidied automatically if anything would overlap.)

### Toolbar

| Section | Buttons |
| --- | --- |
| **Add timer** | `5m` `6m` `8m` `10m` (common placeholder respawns), or type a custom time in the box and press Enter / `+` |
| **Add** | `Count` (standard counter), `Named / PH` (camp counter), `Buff Tracker`, `Note` (▾ next to it lists [saved notes](#notes)) |
| **Lists** | `😈 Naughty` / `😇 Nice` show or hide the [player lists](#naughty-and-nice-lists) |
| Right side | `Tidy`, 🔔 / 🔕 mute all alerts, ☰ menu |

**☰ menu:** Save layout to file, Load layout from file, Reset all timers, Reset all counters, [Theme](#themes)
picker, Test sound & voice.

---

## Timers

Countdown timers for respawns, events, or anything else.

| Action | How |
| --- | --- |
| Start / restart | Click the **big clock**. While running, a click restarts from full. |
| Pause / resume | **Pause** and **Resume** buttons. Clicking the clock while paused also resumes. |
| Nudge | **−1m / +1m**. While running or paused they change the time **remaining**. While stopped they change the timer's **length** (minimum 1:00). |
| Fix the time left | **Right-click the big clock**, type what's actually left (e.g. `4:30`), then Enter. Esc cancels. The timer's full length doesn't change, so the next restart is still the full time. A paused timer stays paused, and an idle or finished timer starts from the time you typed. |
| Stop | **Reset** |

**States:** grey = stopped · blue (Spirit theme) or green (Classic) = running · amber = paused ·
**red pulsing "READY"** = finished, with a counter showing how long ago it finished (`+1:23`), handy for "it spawned
a minute ago".

**Settings (⚙):** name, duration, **auto-repeat** (starts over by itself at zero).

**Name camp timers after the named NPC** (e.g. *Grimfang*). That's what ties [kill history](#history-is-saved-per-named-npc)
to the NPC. When you rename a timer (right-click the title, or click the Name box in ⚙), a list of every NPC you've
tracked opens, with kills and nameds for each. Type to narrow it, use ↑/↓ and Enter, or click one. **✕** on a row
forgets that NPC and its history, after asking.

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

In a counter's **⚙ settings**, choose a timer under **Timer**. Or, for a Named/PH counter, **drag it onto the
timer** (or the timer onto it). The target lights up with **🔗 Link**, and dropping asks you to confirm before
linking. The dragged panel goes back to where it was. If the counter was linked to a different timer, the prompt
says so before replacing that link. From then on:

- **Named/PH counter:** **+ PH** and **+ Named** each restart that timer at full time, even mid-countdown. A **↻** on
  the buttons shows the link is active.
- **Standard counter:** **+** restarts the timer.

The timer restarts **the instant you click**. It never waits for loot entry or anything else.

Linking a Named/PH counter to a timer you've named also **names the counter after it**: *Grimfang's log*. If you
rename the timer, the counter follows. A name you gave the counter yourself is never changed.

---

## Camp history and loot

### Recording loot

After **+ Named**, a **"Named down!"** drawer slides in on the right. It doesn't block anything else on the board.

- Before you type, it lists what **this NPC has dropped before** (most frequent first), so a repeat drop is one
  click.
- Type an item name and press **Enter**. Add as many items as dropped.
- Suggestions come from this NPC's past drops first, then **every item you've ever entered at any camp** (kept even
  if that camp's counter or history is deleted), then the wiki if [item search](#wiki-item-search-optional) is set
  up. Use ↑/↓ and Enter, or click a suggestion.
- Entering loot is **optional**: **Skip** closes the drawer without adding anything. If several nameds die quickly,
  the drawer shows "+1 more" and steps through them.

### History view (📜)

Toggle between **Session** and **All time**. The Session view shows when the current session started.

- **New session** (asks first) sets the counts back to 0 and starts session stats from now. The kill log is kept.
  **Reset** on the panel does the same.
- A new session also starts **automatically**: a + PH / + Named logged more than an hour after the camp's previous
  kill opens a fresh session before it's counted.

- **Stats:** placeholders, named, named odds ("1 in 7.0"), last named, typical respawn (median time between kills),
  last respawn, longest PH streak, kills/hr, named/hr.
- **Loot summary:** every item with its count and drop rate per named kill.
- **Kill log:** newest first, with timestamps.
  - **loot** on a named kill adds or removes items inline.
  - **✕** deletes an entry (Shift + click skips the confirmation). Deleting a kill from the current session also
    corrects the counts.
- **Clear history** erases the log for this camp (counts unchanged).

The log keeps up to 5,000 kills per NPC.

### History is saved per named NPC

When a Named/PH counter is linked to a timer you've named (e.g. *Grimfang*), its kills are saved to **Grimfang's
history**, not to the counter:

- The NPC is remembered as soon as the counter is linked, even before any kills.
- Delete the timer and counter, and later create a new timer: *Grimfang* is in the name list. Pick it, link a
  Named/PH counter, and all of Grimfang's past kills and loot are back.
- Kills logged before you linked the counter move into the NPC's history.
- Rename the timer to a different NPC and the counter switches to that NPC's history. Each NPC keeps its own.
- A counter that isn't linked (or is linked to a timer with a generated name like `6:00 spawn`) keeps a history of its
  own, which is deleted with the counter. Deleting such a counter always asks first and says how many kills would be
  lost, even with Shift + click.

The 📜 dialog's title shows whose history you're looking at. **Clear history** erases that NPC's whole log.

---

## Buff Tracker

A panel listing your buffs, with reminders before they fade.

| Action | How |
| --- | --- |
| Add a buff | Quick-add **10m · 20m · 35m · 1h** along the bottom of the panel (the most common MnM buff lengths), or **＋** in the header for a custom one |
| Cast / recast | Click the buff. It counts down from full. |
| Fix the time left | Click the buff's **time** and type what's actually left (e.g. `12:30`), then Enter. Esc cancels. This starts an idle buff too. The full duration doesn't change, so the next recast still runs the full length. Handy when you forgot to click on recast. |
| Clear | **✕** next to an active buff |
| Edit | **⚙**: rename the panel; for each buff set name, duration and **warn at** (default 1:00), reorder ▲▼, remove |

**States:** grey = not active · green = active · **amber pulsing** = within the warn time · **red "FADED"** = expired.

**Buff sets:** save a Buff Tracker's list of buffs and load it again later, into this or any other Buff Tracker.
In **⚙ → Buff sets**:

- **Save as set** stores the buffs' names, durations and warn times under the name you type. Saving with an existing
  set's name replaces it, after asking.
- Pick a set and click **Load** to replace the panel's buffs with it (it asks first if the panel already has buffs).
  Loaded buffs start idle.
- **Delete** removes the selected set (Shift + click skips the confirmation).

Sets are saved with the app and included in layout files. Loading a layout file adds its sets to yours instead of
replacing them.

New buffs are named after their length (`35:00 buff`) until you rename them, for example to *Spirit of the Wolf*.
Renamed buffs are spoken aloud; see [alerts](#alerts-chimes-and-voice). You can have several Buff Trackers, such
as one for self buffs and one for group buffs.

---

## Notes

A free-text panel for camp notes, quest steps, who to group with, and so on.

| Action | How |
| --- | --- |
| Write / edit | Click in the text area and type. It saves as you type. |
| Text size | **A−** / **A+** in the header (10px to 32px, 2px per click) |
| Rename | Right-click the title, or **⚙** (or double-click the title) |
| Put away | **—** in the header (or **Put away** in ⚙). The note leaves the board but keeps its text. |
| Bring it back | **▾** next to `Note` in the toolbar lists saved notes with a preview of each. Click one to put it back on the board, in its old spot if that's still free. **✕** there deletes it for good. |

The text area takes up the whole panel and scrolls if the note gets long. The **▾** shows how many notes are put
away.

---

## Naughty and Nice lists

Two lists of players: the **😈 Naughty list** for people you'd rather not group with again, and the **😇 Nice
list** for people you'd happily group with again. Each list has one panel. **Lists → 😈 Naughty / 😇 Nice** in the
toolbar shows or hides it. Hiding a panel keeps its names, and it comes back in the same spot.

| Action | How |
| --- | --- |
| Check a name | Type it in either list's box. The list filters as you type, and a line under the box says whether that exact name is on **this** list, on the **other** list (highlighted, with its note), or on neither. |
| Add | Type the name and press **Enter** (or **＋**). Names match regardless of capitals, and duplicates aren't added. |
| Move between lists | Type a name that's on the other list and click **Move here**. Its note comes along. |
| Note | Click a name to add or edit a reason, e.g. *"ninja-looted the FBSS"*. |
| Remove | **✕** next to the name. **Undo** appears for a few seconds. |

The lists are saved with everything else and included in layout files. Loading a layout file adds its names to
yours rather than replacing them.

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
  kill and loot history, your notes, buff sets, and your theme.
- **☰ → Load layout from file…** replaces the whole board with a saved file, after confirming. Timers and buffs come
  back **stopped**. Kill history and buff sets from the file are **added** to yours, not swapped out.

> Browser data can be wiped by clearing site data or using a different browser or profile. Save a layout file now
> and then if your history matters to you.

---

## Themes

☰ → **🎨 Theme…** opens a picker with a theme for **every Monsters & Memories class**. Clicking a tile applies it
right away, so you can try them out.

Each theme takes its colors from the class concept art and its decorations from the class description:

| Theme | Look | Corner prop | Ambient |
| --- | --- | --- | --- |
| **Shaman** (default) | Spirit green and spirit blue, the Spirals | Cave mushrooms, carved spirit stone | Spirit motes |
| Monk | Saffron and umber, an ensō | Balanced cairn with incense | Golden dust |
| Beastmaster | Amber, bone and leather | Claw-raked boulder | Fireflies |
| Spellblade | Midnight blue and violet | Humming sword planted in the ground | Blink sparks |
| Elementalist | Terracotta and flame | Brazier of living fire | Embers |
| Enchanter | Mint and violet, a hypnotic eye | Crystal on puppet strings | Shimmer |
| Druid | Leaf green and moonlight | Ferns, crescent-moon staff | Falling leaves |
| Necromancer | Bone, shadow, sickly green | Bone pile, grave rune | Falling ash |
| Wizard | Starlit blue, a glyph star | Burning staff and glyphs | Glyph sparks |
| Bard | Yellow and blue | Lute and a red feather | Music notes |
| Rogue | Near-black, poison green | Knives in a post, poison vial | Drifting soot |
| Archer | Rust and leather, a target | Quiver of arrows | Dust |
| Ranger | Forest green, a compass star | Pines | Fireflies |
| Shadow Knight | Black iron, blood red | Jagged greatsword | Red embers |
| Inquisitor | Violet and silver, a warding sign | Tome with a violet gem | Falling arcane motes |
| Fighter | Bronze and steel | Shield, sword and mace | Forge sparks |
| Cleric | Ivory and gold, a sunburst | Shining chalice | Holy light |
| Paladin | Gleaming gold | Winged shield | Golden light |
| Classic | The original grey cave stone with green accents | Mushrooms, spirit stone | Spirit motes |

Every theme also uses its class glyph for the slowly turning sigil in the background and the faint mark in the
corner of each panel. Dalgrimm's glowing eyes and the ghostly veil under the toolbar stay in all of them. All
animation stops if your system's *reduce motion* setting is on.

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
    note-card/              Note panel
    player-list/            Naughty / Nice list panel
    loot/                   Loot drawer and item autocomplete
    themes.ts               Class themes: palettes, glyphs, corner art, particles
    art/                    Dalgrimm's eyes logo, theme-driven background
proxy.conf.mjs              Dev-server proxy that adds the wiki API key
```

**Notes**

- State lives in `TrackerStore` signals and is written to `localStorage` (key `mnm-assistant.state.v1`) by an
  `effect`. Older saved data is upgraded on load by `normalizeState`, which also validates layout files.
- A 250 ms tick drives all countdowns. Timers and buffs store absolute end times, so they stay accurate across sleep
  and reloads.
- Panel positions are grid cells. Footprints in `layout.ts` include one cell of gutter. The drawn size is
  `(w − 1) × 20px` by `(h − 1) × 20px`.
- Themes live in `themes.ts`. A theme sets nine base colors (plus its glyph mask) as CSS variables on `<html>`;
  `styles.scss` derives every other color from them with `color-mix()`, and `overrides` can pin exact values. To add
  a theme, add an entry to the list and a case in `corners()`.

**Commands**

```bash
npm start          # dev server with wiki proxy at http://localhost:4200
npx ng build       # production build to dist/mnm-assistant/browser
```

**Deployment (GitHub Pages)**

`.github/workflows/deploy.yml` builds the app and publishes `dist/mnm-assistant/browser` to GitHub Pages on every push
to `main`. You can also run it by hand from the Actions tab. One-time repo setup:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. The repo must be **public** (it is). Pages on private repos needs a paid GitHub plan.

This is a project site served from `/mnmassistant/`, so the workflow builds with `--base-href /mnmassistant/`.
If the repo is renamed, update that path in the workflow. On the hosted site, wiki search is switched off with a
short note, because the proxy that adds the API key only exists in the local dev server.

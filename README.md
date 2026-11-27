# MnM Assistant

*Dalgrimm's spirit ledger.* A companion app for **Monsters & Memories** that lives on your second monitor. Its
**tools** put the community wiki, zone maps, Trem prices, your wishlist, leveling spots, spells and class guides one
click away, and it keeps track of the things you'd otherwise scribble on paper: spawn timers, placeholder and named
kills, what dropped, and when your buffs are about to fade.

It runs in your browser, and everything you enter stays there. The tools read public data (the community wiki,
MnMdb, Worth the Camp, MnM Atlas), but nothing about you is sent anywhere.

---

## Contents

- [Quick start](#quick-start)
- [The toolbar](#the-toolbar)
- **The tools:**
  - [Wiki](#wiki)
  - [Map](#map)
  - [Prices](#prices)
  - [Wishlist](#wishlist)
  - [Gear Planner](#gear-planner)
  - [Leveling](#leveling)
  - [Spells](#spells)
  - [Classes](#classes)
  - [Level range](#level-range)
  - [Naughty and Nice lists](#naughty-and-nice-lists)
- [The board](#the-board)
- [Timers](#timers)
- [Session timers](#session-timers)
- [Named / PH timers](#named--ph-timers)
- [Counters](#counters)
- [Camp history and loot](#camp-history-and-loot)
- [Buff Tracker](#buff-tracker)
- [Notes](#notes)
- [Game time](#game-time)
- [Pop-out window](#pop-out-window)
- [Alerts: chimes and voice](#alerts-chimes-and-voice)
- [Saving, loading and backups](#saving-loading-and-backups)
  - [Anonymous usage stats](#anonymous-usage-stats)
- [Themes](#themes)
- [Item suggestions when recording loot](#item-suggestions-when-recording-loot)
  - [Wiki item search (optional, local only)](#wiki-item-search-optional-local-only)
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

## The toolbar

Across the top of the page, left to right:

| Part | What it does |
| --- | --- |
| **The tools** | A button for each tool panel, beside the title. Point at one and a tooltip says what it does straight away; click it to show its panel, and again to hide it. A lit button is showing. [Wiki](#wiki), [Map](#map), [Price Checker](#prices), [Wishlist](#wishlist), [Gear Planner](#gear-planner) (each character's current gear and the upgrades you can get), [Leveling Spots](#leveling), [Spells](#spells), [Class Guides](#classes), [Group Range](#level-range) (enter a level, see who it can group with), then the [Naughty and Nice lists](#naughty-and-nice-lists). On a wide screen they sit on the same row as everything else; on a narrower one they get a row of their own under the title. |
| **＋ Add ▾** | Adds the panels you can have as many of as you like. **Timers:** a [Timer](#timers) or a [Named / PH timer](#named--ph-timers); clicking the name adds a 6 minute one, **5m 6m 8m 10m** under it add those lengths, and the box takes any other (`7:30`, `90s`, `1h30m`, then Enter). A [Session timer](#session-timers) counts up instead. **Panels:** Count, Buff Tracker, Note, Checklist. **Saved:** the Named / PH timers, notes and checklists you've put away, one row per kind with how many there are; point at a row (or click it) to see them in a list beside the menu, then click one to bring it back. The number on the button is how many are saved. |
| **🕰️ Game time** | The [game clock](#game-time), with how long until 6 PM and 6 AM; click it for more. |
| **?** | The quick guide. |
| **🔔 / 🔕** | Mutes all alerts. |
| **☰** | Tidy panels, Save layout to file, Load layout from file, Reset all timers, Reset all counters, [Theme](#themes) picker, Test sound & voice, Quick guide. |

**Quick guide:** **?** in the toolbar (or **☰ → Quick guide**) opens a short "How to use" guide. It starts with the
tools, then the rest of the toolbar, panels, timers, Named / PH timers, buffs and notes, and saving. It opens by itself
the first time someone uses the app, and when it's closed the [theme](#themes) picker follows, so a new user can pick a
look for their class.
---

## Wiki

The community [Monsters and Memories Wiki](https://monstersandmemories.miraheze.org/) inside the app.
**📖 Wiki** in the toolbar shows or hides the panel (there's only one; it comes back in the same spot and size, on the page
you last read).

| Action | How |
| --- | --- |
| Search | Type an NPC, item, quest, zone… and press Enter. A page with exactly that name comes first, then pages that mention it. |
| Read | Click a result to read the page here, restyled to match the app. Links to other wiki pages open in the panel; **←** goes back. Images, categories and other sites open in a new tab. |
| On the wiki | **↗** in the header opens the page (or search) on the wiki itself. |
| Other sites | Beside a page's title, **Miraheze ↗** opens it on the Miraheze wiki in a new tab. An item or NPC page (told apart by its wiki categories) also gets **.wiki ↗**, the same name on monstersandmemories.wiki (see [other sites](#other-sites)), and an item MnMdb has gets **MnMdb ↗**. |

**📖 buttons** around the app look things up here: the NPC in a Named / PH timer's [history](#history-view-) (once
it's named after the NPC) and each loot item there; the item in [Prices](#prices); an open spell in
[Spells](#spells); the class in [Classes](#classes); each zone in [Leveling](#leveling) (and each camp, on hover); the
zone in [Map](#map). If the wiki has no page with that name, you get the pages that mention it instead.

It reads the wiki live through its public API, one request at a time when you search or open a page (results are
remembered until you reload), so it needs an internet connection. Pages are shown through Angular's HTML sanitizer,
which removes scripts and styles.

*Wiki content: the [Monsters and Memories Wiki](https://monstersandmemories.miraheze.org/) contributors,
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).*

### Other sites

Wherever the app shows an item (or, in the Wiki panel, an NPC), a small group of links opens it on the community
sites in a new tab: **Miraheze ↗ · .wiki ↗ · MnMdb ↗**. It's in the [Wiki](#wiki) panel beside a page's title, in
[Prices](#prices) beside the item's name, and in an opened [Wishlist](#wishlist) item.

- **Miraheze ↗**: the page on the Miraheze wiki. It shows only when that page exists (the app checks the wiki live).
- **.wiki ↗**: the same name on monstersandmemories.wiki, at the address the site uses: `/items/<name>` for items
  (`/items/arcane-set-priests-faceguard`) and `/npcs/<name>` for NPCs (`/npcs/mia-tarcut`). That site doesn't let
  apps check its pages, so the address is built from the name and may lead nowhere when the page isn't written yet
  or is named differently; hovering the link says so. Wiki pages that are neither an item nor an NPC (zones,
  quests…) have no .wiki link.
- **MnMdb ↗**: the item on mnm-db.com, when MnMdb has it.

---

## Map

The illustrated zone maps from [MnM Atlas](https://www.mnmatlas.com/), an unofficial fan atlas, shown with the atlas's
own [embed](https://www.mnmatlas.com/embed/) (its compact mode, so the scroll wheel zooms as soon as you hover). **🧭 Map** in the toolbar shows or hides the panel (there's only one; it comes
back in the same spot and size). Drag its bottom-right corner to resize it: maps are easiest to use big.

| Action | How |
| --- | --- |
| Pick a map | Click the map box for the World map and every zone A–Z, or **type to find one**: zones starting with what you type come first, then a word inside the name (`weald` → Evershade Weald), then anywhere in it. Floor names count too: `ossuary` offers the Tomb's *Ossuary and bone construct* floor and opens straight onto it. ↑ / ↓ and Enter pick; Esc puts the box back. |
| Pick a floor | Zones with levels or floors (the Tomb, Tel Ekir, Fallen Pass, Fallen Watch…) get a second box. **Default view** is how the atlas opens the map. |
| Find something | Type an NPC, a place or e.g. `enchanter trainer` in the find box and press Enter. The atlas searches every map and opens the right one on that marker. **✕** (or Esc) goes back to the chosen map. |
| Use the map | Drag, scroll to zoom (just hover; no click needed), switch floors and open marker popups inside it. The atlas's own bar at the top of the map also has a map picker, a search menu and sign-in for suggesting edits. While the mouse is over the map the wheel zooms it; move off the map to scroll the board. |
| Full atlas | **↗** in the header opens what you're looking at in MnM Atlas in a new tab. |

The map loads live from mnmatlas.com, so it needs an internet connection and always shows the atlas's latest
version. The zone list lives in `src/app/map/atlas-maps.ts`; add new maps there when the atlas adds them.

*Maps: [MnM Atlas](https://www.mnmatlas.com/) and the community map authors credited on each map.*

---

## Prices

A price checker for the **Trem** server. **💰 Price Checker** in the toolbar shows or hides the panel (there's only one; it comes
back in the same spot and size).

| Action | How |
| --- | --- |
| Check an item | Start typing a name; pick from the list (↑ / ↓ and Enter, or click). Items most often for sale come first. Your last 8 checks stay as chips under the box; **✕** on a chip removes it. |
| Trem market | **Typical ask** is the median price per item among sellers, with the cheapest and highest. Below it: how many sellers, how recent the newest listing is, and what buyers offer (WTB). Switch between the last **7 days** and **30 days**. Fewer than 3 sellers is flagged as a rough guide. |
| Vendor | What an NPC merchant pays for it, and how the player price compares ("players ask 30× the vendor price"). |
| Listings | **For sale** (cheapest first) and **Wanted** (highest offer first): price each, as listed (e.g. `3s / 20` for a stack), the player and when it was last seen. |
| Item | Slot, AC, stats, classes, which mobs drop it (with drop rates where enough kills are logged), whether it's gathered, which tradeskills use it and which merchants sell it. **🧭** opens a zone in the [Map](#map) panel. **Miraheze ↗ · .wiki ↗ · MnMdb ↗** beside the name open the item on those sites (see [other sites](#other-sites)). |
| Refresh | **↻** in the header reloads the latest data. |
| Item card | Rest the pointer on a suggestion, a recent chip or the item's name for its card (see [Gear Planner](#gear-planner) item cards), with MnMdb's details. |

**💰** next to an item in a Named / PH counter's loot summary ([history](#history-view-)) opens it here, so you can
see what a drop is worth.

The data comes live from [MnMdb](https://mnm-db.com/) (an open-source community economy database), the first time
you open the panel: Trem auction-channel listings (asking prices, not completed sales; roughly the last 30 days),
vendor sale prices and drops players have logged, and merchant lists from the wiki. Nothing is copied into this app,
so it needs an internet connection and shows whatever MnMdb has now (it updates through the day).

*Prices: [MnMdb](https://mnm-db.com/) ([source](https://github.com/Boisteroux/mnm-tools), MIT).*

---

## Wishlist

**⭐ Wishlist** in the toolbar keeps a list of items you're after.

- **Add** an item by typing its name and pressing Enter. Suggestions come from MnMdb's item list (and the
  monstersandmemories.wiki item search when running locally with a key, see below). Any name works, even one no site
  knows yet.
- Each row shows **where it drops**: the first MnMdb drop source with its rate, or your own note. On the right is the
  typical Trem asking price.
- **Rest the pointer** anywhere on an item's row for its card (stats, who can wear it, where it drops): your own
  item's, or MnMdb's details, like the [Gear Planner's](#gear-planner) item cards. An item nobody has data for says
  so. **🛠** beside the add box makes an item of your own ([My items](#gear-planner)) and adds it to the list.
- **Click a row** for the details:
  - **Stats** (slot, AC, damage/delay, attributes, HP, mana, resists, flags such as MAGIC or UNIQUE), classes and
    races, and any effect.
  - **Where it comes from:** who drops it (and how often, once enough corpses were seen), harvesting, tradeskills,
    vendors, and the zones, with **🧭** buttons that open them in the Map panel.
  - **Where it drops (your note):** your own words, for items the sites don't know or anything to add (camp, quest,
    who has one). A new item MnMdb knows nothing about opens here straight away.
  - **Links:**
    - **Miraheze ↗ · .wiki ↗ · MnMdb ↗** open the item on those sites in a new tab (see [other sites](#other-sites)).
      Running locally with the partner key, the wiki's item search supplies the exact .wiki address. If the .wiki
      address is wrong, **✎ .wiki link** lets you paste the right one (clear the box to go back to the built one).
    - **📖 Wiki** reads it in the Wiki panel (when the Miraheze wiki has a page with its name), and **💰 Price** opens
      it in the Prices panel (when MnMdb has it).
- **☐** marks an item as got: it's struck through and moves to the bottom. **◉ / ◌** in the header hides or shows
  the items you've got. **✕** removes an item (Shift + click skips the question).

The list is saved with everything else. Hiding the panel keeps it. Loading a layout file adds the file's items to
yours instead of replacing them.

---

## Gear Planner

Each of your characters' current gear, and the upgrades you can get. **⚔️ Gear Planner** in the
toolbar shows or hides the panel (there's only one; it comes back in the same spot and size). Drag its bottom-right
corner to resize it. Item data is [Worth the Camp](https://worththecamp.com/)'s; NPC levels are the same ones the
[Leveling Spots](#leveling) panel uses.

**Characters.** The first time you open it there's a character with your [theme](#themes)'s class and the level from
Leveling Spots (or Group Range). At the top:

| Action | How |
| --- | --- |
| Switch character | The character list. Each one keeps its own gear, class, race, level and stat weights. |
| Rename | **✎**, type, Enter. |
| Add one | **＋** (it opens the name box). |
| Delete one | **🗑**, after confirming (Shift+click skips the question). |
| Class, race, level | The lists and box under the name. The class decides what can be worn and which stats count; the race matters for the few items only some races can wear; the level sets which mobs count as "around your level". |

**Item cards:** rest the pointer on any item's name (in Current Gear, anywhere on a search suggestion's row, in
Upgrades or Recommended, including the item an upgrade replaces) and its card appears beside the panel, like the game's inspect
window: icon, name, flags (MAGIC, NO DROP, …), slot, weapon damage and delay, stats, which classes and races can wear
it, and where it comes from (the easiest drops with level, zone and drop rate, or the tradeskill that makes it).
Moving away, clicking, scrolling or Escape hides it. In Current Gear the whole slot shows it.

**🛠 My items:** for items the sites don't have yet, make your own. Open it from **🛠** in the Gear Planner's header,
from **🛠 Create “…” as your own item** at the bottom of a slot's search results (it goes straight into that slot
once saved), or from **🛠** beside the Wishlist's add box (it goes on your list). Give it a name, an icon (any of the
wiki's item icons: find one by file name or by the name of an item that uses it), its slots, weapon damage and delay,
AC, HP, Mana, attributes, resists and where it comes from, and watch its card as you type. Your items work like any
other: suggestions, **Wear**, Upgrades (marked **🛠 Your item**; they always count, but Recommended is drops only),
the Wishlist's suggestions and item cards. Pick one from the list at the top of 🛠 to change or delete it (characters
wearing a deleted item keep its name). They're saved with your board and travel in layout files (a loaded file's
items are added to yours).

Three views, as tabs:

**Current Gear.** A paper doll with all 21 positions: head, face, two ears, neck, shoulders, back on the left; chest, shirt, two wrists,
hands, two fingers on the right; waist, legs and feet in the middle under your totals; primary, offhand, ranged and
ammo along the bottom. Each filled slot shows the item's icon on the right (Worth the Camp has icons for most items).
The middle shows your race and class, how many slots are filled and your stats added up, over your race's portrait
from the [official races page](https://monstersandmemories.com/races) (dimmed so the text stays easy to read; **♂ / ♀**
in its corner switches portraits) and your class's glyph and colour from its [theme](#themes).

- Click a position to edit it: the search box is ready, so just type part of an item's name and pick it (Enter takes
  the first). Suggestions only show
  items that fit that slot and that your class and race can wear, best for you first, with the score change if you
  wore it.
- With an item in place: its stats, **📖** to look it up in the Wiki panel, **⭐** to add it to your
  [Wishlist](#wishlist) (the Wishlist panel opens if it's hidden), **Take off**, and **🔎 Upgrades for …** to see every upgrade for that slot in the Upgrades
  view. The name links to its Worth the Camp page.
- A two-handed weapon in the primary takes the offhand too (it shows "(two-hander)").
- **Stat weights** (under the doll): how much each point is worth to this character. Change any; the changed ones are
  highlighted, and **Reset to … defaults** puts them back. Suggestions and upgrades follow them.

**Upgrades.** Every item that would be better than what you wear, biggest gain first. Each shows the gain, the slot,
what changes (**+3 WIS −1 AC**, and what it replaces), **No drop** if it can't be traded, and how to get it: the
easiest mob that drops it (its con colour, level and zone, **🧭** to find it on the [Map](#map), the drop rate when
players have recorded one, and **+N more** if others drop it too), the tradeskill that makes it, or "Quest or other".
**Wear** puts it on the doll; **⭐** adds it to the Wishlist (and opens that panel). In a narrow panel ⭐ is left out of
the list so the item names aren't cut short. Filters:

- **Slot:** one slot, or all.
- **Mobs up to:** only drops from mobs whose lowest level is at most this. Leave it blank for your level + 3.
- **Drops**, **Crafted**, **Quest & other**, **Raid:** which sources count. "Quest & other" is anything with no known
  drop that isn't crafted: quest rewards, starting gear, vendor items, or simply not known yet (Worth the Camp's data
  doesn't say which). The mob level only limits drops, so crafted and quest items of any level show when they're on;
  that's why only drops (no raids) are on to start with.

**Recommended.** The biggest upgrade for each slot that you can get around your level: drops from mobs up to 3 levels
above you, no raid bosses, at most one per position (a second ring goes on the other finger, and a two-hander rules
out an offhand), the 12 biggest. It needs your level.

How an item is scored:

- **Stats × weights:** each stat point times the character's weight for it, added up. The default weights for every
  class are [Castanova's Arcane Ledger](https://arcaneledger.tools/)'s: a Shaman, for example, counts WIS 1, mana
  0.1, STA 0.2, DEX 0.15, HP 0.05 and AC 0.05; a Fighter STA 1, STR 0.7, AGI 0.5, AC 0.4, DEX 0.3, HP 0.1. Stats a
  class doesn't list (resists, for most) count 0.
- **Weapons:** damage ÷ delay × 100, times the class's weapon ratio weight (Arcane Ledger's "Ratio": Rogue 1.2,
  Archer, Monk, Ranger and others 1, Fighter and Bard 0.7, the knights and Inquisitor 0.5, casters and healers 0), in
  either hand and in the ranged slot. Arcane Ledger's Bard instrument weights aren't used: Worth the Camp's items
  don't list instrument bonuses.
- **Gain** is the score minus the score of what it replaces (for a pair, the weaker one; for a two-hander, both
  hands). Items you already wear aren't listed again.

Change the weights if you value things differently.

**The data:** the panel downloads Worth the Camp's `items.json` (a few MB) when you first open it, at most once a day,
and keeps the wearable items (about 3,000) in this browser's IndexedDB, so it opens instantly and works if their site
is down. Your characters and gear are saved with the board, and in layout files (loading one adds its characters to
yours). Item data is adapted from the [Monsters and Memories Wiki](https://monstersandmemories.miraheze.org/) under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); observed drop rates are from
[MnMdb](https://mnm-db.com/) (Copyright (c) 2026 Zak (threefires),
[MIT License](https://github.com/Boisteroux/mnm-tools/blob/main/LICENSE)). Worth the Camp doesn't have required
levels for items, so "around your level" means the level of the mobs that drop them. Item icons and race portraits
are Monsters & Memories art (© Niche Worlds Cult, not covered by the CC license): the icons load from Worth the Camp
and the portraits from the official site, straight into your browser; neither is copied into this app.

---

## Leveling

Where to hunt for your class and level, from [Worth the Camp](https://worththecamp.com/)'s NPC data. **🗺️ Leveling
Spots** in the toolbar shows or hides the panel (there's only one; it comes back in the same spot and size). Drag its
bottom-right corner to resize it.

| Action | How |
| --- | --- |
| Pick your class | The **Class** list. Until you pick one it follows your [theme](#themes)'s class. |
| Pick your level | Type it, or use **−** / **+**. The first time you open the panel it starts from the level in the [Group Range](#level-range) panel, if you've entered one there. 🗺️ on a leveling path step in [Class Guides](#classes) opens it on that level and class. |
| Solo or group | **Solo** aims at or below your level, lower for classes that find soloing hard. **Group** aims 2–3 levels above you. |
| See it on Worth the Camp | **Worth the Camp ↗** in the header opens their own leveling page with the same class, level and mode. |

Under the choices, **Aim for mobs 17–19, named 15–17** says what suits you, and a strip of levels shows each one in its
con colour with your target outlined (the named target dashed). Hover a level for its colour's meaning.

Then the zones, best first. Each lists its mobs in your range: the regular mobs lowest first, then the named. Each
mob shows its con colour (judged at its highest level, to stay on the safe side), **Named**, its level or level range
and how many items it's known to drop; click a name for its page on Worth the Camp. A zone shows the first six, with
**+N more** for the rest. In the zone heading: how many mobs fit and the zone's level range, **🧭** to open it in the
[Map](#map) panel, **📖** to look it up in the [Wiki](#wiki) panel, and **↗** for its Worth the Camp page (every NPC
and what it drops).

How it picks (following [Worth the Camp's rules](https://worththecamp.com/leveling)):

- **Solo target by class:** each class's community solo tier (from Worth the Camp's
  [class meta](https://worththecamp.com/meta)) sets the range: S −3 to your level, A −3 to −1, B −4 to −2, C −5 to
  −3, D −6 to −4.
- **Named mobs** (anything not called "a …" or "an …") hit harder than the regulars around them, so they're matched
  against the target moved 2 levels lower.
- **A mob counts** when its known level range overlaps the target. Raid bosses and mobs with no known level are left
  out.
- **Ranking:** zones with more mobs in range come first. Cities and hubs (Night Harbor, Ail'Vorith, Faelindral, and
  any zone whose mobs span 30 levels or more, marked **hub**) count for a little less, since they have mobs of every
  level. Worth the Camp doesn't publish its exact formula, so the order can differ slightly from their page.
- **Con colours** (relative to you): red 3+ above, yellow 1–2 above, white even, blue 1–3 below, light blue 4 below,
  green 5 below, grey further down.

**The data:** the panel downloads Worth the Camp's `npcs.json`, `zones.json` and `meta.json` from their free
[Data API](https://worththecamp.com/api) (no key needed) at most once a day, as they ask, and keeps a trimmed copy in
this browser, so it opens instantly and still works if their site is down. Their item, NPC and zone data is adapted
from the [Monsters and Memories Wiki](https://monstersandmemories.miraheze.org/) under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); the panel credits both, and what's built from it here
is shared under the same license. The site is fan-made and still in testing, so levels can be missing or change.

**The previous data, kept for later:** before Worth the Camp, the panel used the community
[leveling sheet](https://docs.google.com/spreadsheets/d/1z3O-QkdgvAwUXrCVF3fRQRBGxXxDq6FcoipuA52sdl0/edit?gid=1120375141#gid=1120375141)
(`data/leveling.csv`) and the wiki's
[Per-Level Hunting Guide](https://monstersandmemories.miraheze.org/wiki/Per-Level_Hunting_Guide)
(`data/hunting-guide.json`, CC BY-SA 4.0). Both files are still here, and `npm run leveling` still builds them into
`src/app/leveling/archive/leveling-data.ts`, but nothing in the app uses that file right now.

---

## Spells

Every class spell and ability with its kind, level, school, mana, vendor price, classes and effect.
**🪄 Spells** in the toolbar shows or hides the panel (there's only one; it comes back in the same spot and
size). Drag its bottom-right corner to resize it.

| Action | How |
| --- | --- |
| Pick a class | The class box (starts on Shaman). **All classes** shows everything, with each spell's classes beside its name. |
| Pick a level | The level box lists the levels at which that class gets something. **‹ ›** step to the previous / next such level. **All levels** groups the list by level, each with its cost; click a level heading to jump to it. |
| What a level costs | The line under the search box: the number of spells and their **total vendor price** at the chosen level, plus the running total for **levels 1 to that level**. Spells with no price listed are counted separately and left out of the total. |
| Search | Type part of a name. Searches of 3+ letters also look in the effect text (try `underwater`). Search covers every level of the chosen class and offers the matches in other classes. Esc clears it. |
| Spell details | Click a spell: kind(s), level, school, mana, price, classes and the full effect text. Click again to close. |
| Mark as bought | **Right-click** a spell (or open it and press **✓ Mark as bought**). Bought spells are struck through with a ✓ and left out of every total: the level, the level headings, and levels 1 to N. Right-click again to unmark. **⚙ → Clear bought spells** unmarks them all (it asks first). |

The colored dots on each row are the spell's kinds (damage, heal, buff, debuff, crowd control, defense, pet, cure,
threat, utility); hover one to see which. Prices use 100c = 1s and 100s = 1g. The class and level you picked are
remembered.

The list is only downloaded the first time you open the panel. It lives in `data/spells.txt`; after editing that
file run `npm run spells` to rebuild `public/spells.json`.

*Spell data from the Monsters and Memories Wiki — https://monstersandmemories.wiki/spells*

---

## Classes

How to play each of the 18 classes. **🛡️ Class Guides** in the toolbar shows or hides the panel (there's only one; it comes back in
the same spot and size). It starts on your [theme](#themes)'s class (Shaman by default) and remembers the class and
tab you last looked at.

**Snapshot** (always at the top): the class's role, armor, key stats, how well it solos, how much groups want it,
how hard it is, and its primary and secondary attributes. Pick a class from the box, or narrow the box with the
**Tank / Healer / DPS / Support / Hybrid** buttons.

| Tab | What's in it |
| --- | --- |
| **Overview** | How to play and four quick tips, strengths and weaknesses, and links to every section of the full guide. |
| **Build** | Each race's starting stats (the best in each column highlighted) and where it starts, and the recommended traits with alternatives. |
| **Abilities** | Key spells or abilities by level, and each ability line with when it starts and how it progresses. **📖 All … spells & abilities** opens the [Spells](#spells) panel on the class. |
| **Leveling** | The class's leveling path. **🗺️** opens those levels in the [Leveling](#leveling) panel; **🧭** opens the zone in the [Map](#map) panel. |
| **Gear** | Early gear and later upgrades: slot, stats and where to get it. |
| **More** | Class-specific tables (pet families, seasons, glyphs, instruments, known skill caps) and links to the guide's class-specific sections. |

The class facts, lists and tables come from [Stories of Monsters & Memories](https://storiesofmnm.com/classes/) and its
class guides; each class links to its full guide, which explains the reasoning (why each race or trait, tactics,
common mistakes, FAQ). The one-line summaries, "How to play" text and tips are written for this app, in
`data/class-notes.json`. To refresh the data, run `npm run classes -- --fetch` (downloads the 36 pages, 2 seconds
apart, into the git-ignored `data/.cache/`), or `npm run classes` to rebuild from the pages already downloaded.

*Class data: [Stories of Monsters & Memories](https://storiesofmnm.com/), an unofficial fan site.*

---

## Level range

Who can group with whom. **📊 Group Range** in the toolbar shows or hides the panel (there's only one, and it
comes back in the same spot).

- Type a level (or use **−** / **+**) and the panel immediately shows the **lowest** and **highest** levels it can
  group with, e.g. level 18 → 13 to 26.
- The chart below lists, for each lowest level in a group, how many levels above it the group can reach and the
  highest level that can join. Levels 1–13 reach 5 levels up; from 14 on it's half the level minus one, up to the
  level cap of 60.
- The entered level's row and its lowest partner's row are highlighted, and the rows between them are tinted. Click
  any row to look up that level.
- The last level you entered is remembered.

---

## Naughty and Nice lists

Two lists of players: the **😈 Naughty list** for people you'd rather not group with again, and the **😇 Nice
list** for people you'd happily group with again. Each list has one panel. **😈 Naughty** / **😇 Nice** in the
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

## The board

The page is a free-form board of panels: the [tools](#the-toolbar) you've opened, and the timers, Named / PH timers,
counters, Buff Trackers and notes you've added.

| Action | How |
| --- | --- |
| Move a panel | Drag it by its **header** (the title bar with ⠿). A dot grid appears while you drag. |
| Resize a panel | Drag its **bottom-right corner**. The size snaps to the grid; a red outline means it would overlap another panel, and the size stays as it was. Each kind of panel has a smallest size so its buttons never get cut off. Timer clocks and counter numbers grow with the panel. |
| See where it will land | A dashed outline shows the snap spot when it's free. |
| Drop into a gap | If the spot is a little too small, the panel fits itself in: it shrinks away from whatever it's overlapping, on any side, to fill the free space it was dropped on (never below its smallest size), or slides a cell or two to where it fits at full size, whichever keeps it bigger. A solid outline marked **Resized to fit** (or **Fits here**, when only sliding) shows its new spot and size before you let go. |
| Drop onto other panels | Only when even its smallest size won't fit does the panel keep its size and the panels in its way make room. First they try sliding **sideways** in their own row: each moves away from the side of the dropped panel it's on (left or right), nudging any neighbours along. If that would push one off the edge of the board, they're pushed straight **down** instead (and any they'd land on, in turn). They slide while you drag, so you can see the result, and slide back if you move on; the outline says how many will move and which way. Panels not in the way stay put. |
| Neat layout | **☰ → Tidy panels** packs every panel onto the grid, keeping their order. |
| Delete a panel | **✕** in its header asks for confirmation. **Shift + click ✕** deletes immediately. |
| Rename a panel | **Right-click its title**, type, then Enter (or click away). Esc cancels. Works on every panel type. |
| Panel settings | **⚙** in its header. |

New panels start 280px wide, and every panel snaps to a 20px grid with a built-in gutter, so panels placed side by
side are always evenly spaced. Sizes are saved with the layout, and a hidden tool panel comes back at its last size. (Boards saved when panels were narrower are tidied automatically if anything would overlap.)

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

**Give timers real names** (right-click the title, or the Name box in ⚙) so you hear *which* one is up. A list of every
NPC you've tracked opens as you rename, with kills and nameds for each; **✕** on a row forgets that NPC and its
history, after asking. A ↻ in the header means auto-repeat is on.

To count placeholder and named kills too, use a [Named / PH timer](#named--ph-timers) instead: the same countdown with
the camp's counts built in.

---

## Session timers

A timer that **counts up**, for tracking a play session: how long you've been at it and what you got
(**＋ Add → Session timer**). Each start → **End session** is one session; pauses don't count toward its time.

| Action | How |
| --- | --- |
| Start / pause / resume | Click the **big clock**, or **Start**, **Pause** and **Resume**. |
| End the session | **End session**. It's kept for the stats (a start of a few seconds with nothing counted isn't). |
| Add a counter | **＋ Counter**, type a name, Enter. Or pick a counter from the board in **or move in…**. |
| Drag a counter in | Drag a counter panel by its header onto the Session timer. It lights up; let go and confirm, and the counter moves into the timer (with its count) and its own panel leaves the board. |
| Count | **+** and **−** on each counter. Pressing **+** while no session is going starts one. |
| Fix a count | **Right-click the number**, type the count, Enter. Esc cancels. |
| Rename a counter | **Right-click its name**, type, Enter. |
| Delete a counter | **✕** at the end of its row (it asks first; Shift+click skips that). Its counts stay in the session stats. |
| Move a counter back out | **⚙** lists the timer's counters, each with **Move to board** and **Delete**. |

Starting a new session starts its counters from 0; what they reached is kept with the session it was counted in.
Deleting the Session timer deletes its counters and saved sessions too (it asks first).

### Stats (📊)

- **Session:** pick any session (the one going is first). It shows the session time, when it started and ended, how
  long it was paused, a **running-count chart** with a line per counter over the session's time (hover or use the
  arrow keys for every counter's count at that minute), and each counter's count and **per hour**.
- **All time:** sessions, time counted, average session; each counter's **total**, **per hour** (over the sessions it
  was counted in) and **best session**; a **bar per session** (the newest 30) for one counter, as totals or per hour;
  and the list of sessions. Click one to open it, **✕** deletes one, **Clear history** deletes every finished session.
- A counter keeps its colour in every chart. Counts by the minute are kept (not each click), so a long history stays
  small; up to 500 sessions are kept per timer.

---

## Named / PH timers

Built for camping a named mob and its placeholders: one panel with the camp's **respawn countdown** on top and its
**placeholder and named kills** below. Add one from **＋ Add → Named / PH timer** (6 minutes, a quick length, or any
respawn typed in the box).

| Button | Does |
| --- | --- |
| **+ PH** | +1 placeholder, logs the kill, restarts the countdown |
| **+ Named** | +1 named, logs the kill, restarts the countdown, then opens the [loot drawer](#recording-loot) |
| **−PH / −N** | Undo a mis-click. Removes the latest kill of that type (the countdown isn't touched). |
| **Reset counts** | Zeroes the counts (asks first). The kill log is **kept**. |
| **📜** | Opens the [camp history](#camp-history-and-loot) |
| **—** | Puts it away: it leaves the board (its countdown stops) but keeps its counts, respawn and history. **＋ Add** lists it under **Saved → Named / PH timers** (point at that row to see them); click it to bring it back, in its old spot if that's still free. **✕** there deletes it. |

The countdown works like a [timer](#timers): click the clock to start or restart it, right-click it to set the time left,
**−1m / +1m**, Pause and Reset. The restart happens **the instant you click** + PH or + Named; it never waits for loot
entry or anything else. Below the counts are **PH since the last named**, **how long ago the last named died**, and
the kill rate; hover the "named … ago" text for the named odds.

**⚙ settings:** name, respawn length, **Warn at**, auto-repeat, and the PH, named and PH-streak counts.

**Warn at** (off until you set it): a time before the respawn, typed like any other (`0:30`, `1m`, `90s`); empty turns
it off. When that much is left it says "Grimfang is up in 30 seconds" (or chimes, if the camp doesn't have an NPC's
name yet), and the panel turns amber and pulses gently until it's up, like a buff about to fade. It only counts when
it's shorter than the respawn.

**Name it after the named NPC** (right-click the title, e.g. *Grimfang*). Its kills and loot are then saved to
[Grimfang's history](#history-is-saved-per-named-npc), and when the countdown ends it says "Grimfang is up" (a camp
with the default name chimes). A list of NPCs you've tracked opens as you rename.

### Respawn estimate

Once the camp has a few respawns logged (four kills), a line under the clock shows **⟳ est. respawn 6:02**: the
estimated time between spawns, worked out from the camp's kill log (the last 40 kills). It isn't a plain average of
the gaps between kills, which every late press, missed spawn or break would throw off:

- **Double clicks** (a few seconds apart) count once.
- **Missed spawns:** each gap is read as a whole number of respawns, so 12 minutes on a 6 minute camp is two respawns,
  one of them not logged. The first guess at the respawn is the gap that explains the most other gaps this way, so
  even a log where most spawns were missed finds the real one.
- **Breaks and odd gaps are left out:** a gap that's halfway between (9 minutes on a 6 minute camp) or longer than
  three respawns splits the log into separate runs.
- **Late presses barely count:** within each run, every pair of kills gives an estimate (time apart ÷ respawns apart),
  and the middle of all of them wins. Kills far apart outweigh neighbours, and a press a minute late is one point
  among many, so it hardly moves the result. The estimate is then refined once more from its own result.

Hover the line to see how many respawns it's based on, how many odd gaps were left out or discounted, and how far a
single respawn usually is from the estimate. The pop-out window's compact panel shows the same line, and the camp's 📜
history shows the same **Est. respawn**.

**Boards from before Named / PH timers:** a Named/PH counter that was linked to a timer becomes one Named / PH timer
(the timer's name, length and position, the counter's counts and history). An unlinked one gets its own 6 minute
countdown. Links from standard counters are dropped.

---

## Counters

A single number starting at 0 (**＋ Add → Count**). Drag it onto a [Session timer](#session-timers) to count it per
session there.

- **+** or clicking the number adds one step. **−** subtracts.
- Shows a **per-hour rate** since the last reset.
- **Settings:** name, value, step size, optional **goal**. A goal displays as `12 / 20` and the counter turns
  highlighted when reached.

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
  **Reset counts** on the panel does the same.
- A new session also starts **automatically**: a + PH / + Named logged more than an hour after the camp's previous
  kill opens a fresh session before it's counted.

- **Stats:** placeholders, named, named odds ("1 in 7.0"), last named, estimated respawn (the same estimate the Named / PH timer shows),
  last respawn, longest PH streak, kills/hr, named/hr.
- **Loot summary:** every item with its count and drop rate per named kill.
- **Kill log:** newest first, with timestamps.
  - **loot** on a named kill adds or removes items inline.
  - **✕** deletes an entry (Shift + click skips the confirmation). Deleting a kill from the current session also
    corrects the counts.
- **Clear history** erases the log for this camp (counts unchanged).

The log keeps up to 5,000 kills per NPC.

### History is saved per named NPC

When a Named / PH timer has a name of your own (e.g. *Grimfang*), its kills are saved to **Grimfang's history**, not
to the panel:

- The NPC is remembered as soon as you name it, even before any kills.
- Delete the panel, and later add a new Named / PH timer: *Grimfang* is in the name list. Pick it, and all of
  Grimfang's past kills and loot are back.
- Kills logged before you named it move into the NPC's history.
- Rename it to a different NPC and it switches to that NPC's history. Each NPC keeps its own.
- One with the default name (*Named / PH*) keeps a history of its own, which is deleted with it. Deleting one always
  asks first and says how many kills would be lost, even with Shift + click; put it away (**—**) instead to keep it.

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
| Bring it back | **＋ Add** in the toolbar lists saved notes under **Saved → Notes** (and checklists under **Checklists**): point at the row to see them, with a preview of each. Click one to put it back on the board, in its old spot if that's still free. **✕** there deletes it for good. |
| Resize | Drag the bottom-right corner. The size snaps to the grid; a red outline means it would overlap another panel, and the size stays as it was. |

The text area takes up the whole panel and scrolls if the note gets long. The number on **＋ Add** shows how many notes
and Named / PH timers are put away.

### Checklists

**＋ Add → Checklist** adds a note whose content is a list of items you check off, such as a shopping list
for a tradeskill run. It has the same title, text size, put away and resize controls as a note.

| Action | How |
| --- | --- |
| Add an item | Type in the box at the bottom and press Enter: `18x Copper Ore`, `Copper Ore x18`, `18 Copper Ore` or just `Copper Ore`. |
| Paste a list | Paste several lines into the box to add them all, e.g. `-18xCopper Ore` lines. |
| Paste from the wiki | Copy the **Material / Total / From** table from a [tradeskill page](https://monstersandmemories.wiki/tradeskills) and paste it into the box. Names split over two lines ("Whitefish" / "or Basa or Grouper") become `Whitefish/Basa/Grouper`; the From column shows when you hover an item. |
| Check / uncheck | Click the item. The footer shows how many are done. |
| Edit an item | Right-click (or double-click) it, change it, press Enter. Esc cancels; clearing the text removes it. |
| Remove an item | Hover it and click **✕** (**Undo** appears for a few seconds). |
| Start over | **Uncheck all** |
| Tidy up | **Clear ✓** removes the checked items (with **Undo**). |
| Prices | **💰** in the header shows each item's typical Trem asking price ([Prices](#prices) data): per item and for the count, e.g. `12c ea · 2s 16c`, with **to buy ~…** in the footer for everything still unchecked. An item nobody on Trem has listed shows `–` and isn't counted. Click a price to open it in the Prices panel. |

Adding an item that's already on the list adds to its count and unchecks it, so pasting two recipes' materials
gives you the totals.

---

## Game time

The in-game clock is always in the toolbar (top right): **🕰️ 10:00 PM**, with **6 AM in 24m · 6 PM in 1h 0m**
underneath (soonest first). A gold dot appears next to the time while one of your windows is open. Your own **local
time** sits just left of it, smaller, for a quick glance (hover it for today's date). Click the game clock for the
rest:

- **The time**, **Day N of 20** and the **Eth-ur date** (e.g. *Sorophden, the 10th of Dyingember*), worked out the same
  way as the clock in the [community wiki](https://monstersandmemories.miraheze.org/)'s sidebar: game time runs 20×
  faster than real time from midnight UTC (one game hour is 3 real minutes, one game day 72), and the date is today's
  UTC weekday and month with their Eth-ur names. A bar shows how far through the game day it is.
- **Coming up**: how long until the next 12 AM, 6 AM, 12 PM and 6 PM game time, and the real clock time each happens.
- **Your windows**: **＋ Add** a span of game hours to watch, such as a named that only spawns at night (10 PM–4 AM).
  Each shows whether it's **open** and when it ends, or how long until it opens (and at what real time).
- **Off from your game?** **−5 / +5** shift the clock by game minutes; **Reset** goes back to the wiki's time.

When the app starts it reads the wiki clock's script (`MediaWiki:Gadget-mnmGameTimeSidebar.js`, one request a
session) and checks the formula: the popover says **✓ Matches the wiki's clock**. If the wiki's maintainers change the
speed, the app follows it and says so; if the wiki can't be reached, it uses the same formula and says that instead.

---

## Pop-out window

Keep a timer, a Named / PH timer, a counter or a Buff Tracker in a small window of its own, on top of the game.

- Click **⧉** on the panel's title bar. The panel moves into the pop-out window; its spot on the board shows
  *In the pop-out window* with a **⤓ Bring back** button.
- Pop out more panels and they stack in the same window.
- **Named / PH timer:** in the window it's a compact panel: the countdown and a pause button on top, the estimated
  respawn, then its PH and named counts and **+ PH** / **+ Named** (which restart the countdown, as on the board).
  Click the time to start or restart the countdown on its own. History, settings and undo are on the full panel on
  the board.
- It's the same panel, not a copy: clicks, kills, loot and history all go to the same place. A named kill's loot
  question and any "are you sure?" open in whichever window you clicked in.
- **⤓** on a popped-out panel, or closing the window, puts panels back on the board. Reloading or closing the main
  page closes the pop-out too.

How it stays on top depends on the browser:

- **Edge and Chrome:** the window is a browser Picture-in-Picture window and stays on top by itself. Drag it where
  you like; the browser remembers its size.
- **Firefox, Waterfox and others:** it's a normal pop-up window (allow pop-ups for the site if it's blocked). To pin
  it on top on Windows, click it and press **Win+Ctrl+T** with Microsoft
  [PowerToys Always On Top](https://learn.microsoft.com/windows/powertoys/always-on-top) installed; the window
  shows this tip until you dismiss it. Its size and position are remembered.

Either way the game has to run in **windowed or borderless** mode; nothing can draw over exclusive fullscreen.

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

### Anonymous usage stats

Your board, history, notes and lists never leave your browser. The site does count, anonymously, how it's used, so
I know which tools matter most. It uses [GoatCounter](https://www.goatcounter.com/), which sets no cookies and
keeps no ID for you. What's counted:

- a page view (with the referring site, browser, screen size and country, as GoatCounter counts them),
- a first visit (once per browser),
- which tools are open when the page loads, and each time you open a tool or add a panel (just its name, like
  "Opened Price Checker" or "Added a Timer").

Nothing you type, track or save is sent. **☰ → Share anonymous usage stats** turns it off (or back on) for this
browser. It starts off if your browser sends Do Not Track or Global Privacy Control. Running the app yourself
(`npm start`) sends nothing.

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

## Item suggestions when recording loot

While you type a drop's name, suggestions come from (in this order) what this NPC has dropped before, items you've
entered before, and [MnMdb](https://mnm-db.com/)'s list of about 2,000 items, each with its slot (gear) or its
typical Trem price (everything else). The MnMdb list works everywhere, including the hosted site, with no key; it
loads the first time you type an item name and is shared with the [Prices](#prices) panel. An item picked from it
links to its MnMdb page in the history.

### Wiki item search (optional, local only)

Loot entry can also suggest items from the [Monsters and Memories Wiki](https://monstersandmemories.wiki/) using
its partner API. This needs an API key (`mnmp_…`), which only a **wiki Site Admin** can issue.

1. Put the key in a file named **`wiki-api-key.txt`** in the project folder (git-ignored), **or** set the
   **`MNM_WIKI_KEY`** environment variable.
2. Restart `npm start`. The console prints `[wiki] Partner API key loaded — wiki item search enabled.`

How it works: the app calls `/api/partner/v1/...` on its own address, and the dev server (`proxy.conf.mjs`)
forwards those calls to the wiki with your key attached. The key never reaches the browser. Items picked from the
wiki link to their wiki page in the history.

Without a key everything else works, and suggestions come from your past entries and MnMdb.

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
- Set a Named / PH timer's respawn once and click + PH or + Named on every kill. That one click is the whole workflow.
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
    analytics.service.ts    Anonymous usage counts (GoatCounter), live site only
    idb-cache.ts            Small IndexedDB cache for big downloads (the Gear Planner's items)
    gear/                   Gear Planner: paper doll, upgrade finder and scoring (gear.ts), Worth the Camp items
    item-card/              Item cards (hover tooltip) for the Gear Planner, Wishlist and Price Checker, and 🛠 My items (your own items)
    leveling/               Leveling Spots panel, Worth the Camp data and rules (archive/: the old leveling data)
    timer-card/             Timer panel, the countdown face it shares with Named / PH timers, respawn line
    session-timer/          Session timer panel (count-up, its counters), session logic, stats dialog and its charts
    camp-card/              Named / PH timer panel (countdown + PH / named kills)
    counter-card/           Standard counter panel, camp-history dialog, respawn estimate
    popout/                 Pop-out window (and the compact Named / PH timer shown there)
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
npm test           # every test (logic, then the app in a browser)
npm run test:unit  # just the logic tests (seconds)
npm run test:app   # just the browser tests
npm run test:report  # open the last HTML report
```

**Tests** (Playwright, in `e2e/`)

- `e2e/unit/`: plain logic, no browser: duration parsing, the level-range chart, checklist parsing (including the
  wiki materials table), coin formatting, grid layout, and the game clock (checked against a copy of the wiki
  gadget's own calculation across a whole day).
- `e2e/app/`: the app in a browser, one file per area: board and toolbar, timers, camps and sessions, buffs, player
  lists, notes and checklists (with prices), every tool panel, the quick guide.
- The browser tests start `ng serve` on port 4300 (or reuse one already running there). They never touch the real
  outside sites: `e2e/support/fixtures.ts` answers MnMdb, the wiki API and MnM Atlas with the small sample data in
  `e2e/support/sample-data.ts`, so runs are quick, repeatable and offline.
- Each test starts with an empty board in a fresh browser. Use the `freshVisit` fixture for a first visit, and the
  helpers in `fixtures.ts` (`openTool`, `addPanel`, `savedState`, `loadState`, `dragBy`) to keep tests short.
- Locally the tests use the installed Microsoft Edge. In CI they use Playwright's Chromium (`npx playwright install
  chromium` installs it locally too; set `CI=1` to run the way CI does).

**Deployment (GitHub Pages)**

`.github/workflows/deploy.yml` runs the tests, then builds the app and publishes `dist/mnm-assistant/browser` to GitHub
Pages, on every push to `main`. **A failing test stops the deploy**; the HTML report is attached to the failed run. You can also run it by hand from the Actions tab. One-time repo setup:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. The repo must be **public** (it is). Pages on private repos needs a paid GitHub plan.

This is a project site served from `/mnmassistant/`, so the workflow builds with `--base-href /mnmassistant/`.
If the repo is renamed, update that path in the workflow. On the hosted site the wiki partner API item search is off
(the proxy that adds its key only exists in the local dev server); loot suggestions come from MnMdb instead.

The tool panels (Classes, Prices, Wiki, Map, Spells, Leveling, Level range, player lists) are loaded with
`@defer` when first shown, which keeps the app's first download small.

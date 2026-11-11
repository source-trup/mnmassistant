import { Component, computed, inject, signal } from '@angular/core';
import { COMMUNITY_WIKI, CommunityWikiService } from '../community-wiki/community-wiki.service';
import { formatAgo } from '../time';
import { TrackerStore } from '../tracker.store';
import {
  DEFAULT_SPEED,
  formatGameClock,
  formatGameHour,
  gameTime,
  msUntilGameMinute,
  ordinal,
  speedFromGadget,
  windowStatus,
} from './game-time';

/** The wiki gadget that shows game time in the wiki's sidebar; the app follows its formula. */
const GADGET = 'MediaWiki:Gadget-mnmGameTimeSidebar.js';

/**
 * The in-game clock, always in the toolbar: the time, and how long until 6 PM and 6 AM game time. Click it for the
 * date, all four marks, your spawn windows and the adjustment.
 */
@Component({
  selector: 'app-header-clock',
  templateUrl: './header-clock.html',
  styleUrl: './header-clock.scss',
})
export class HeaderClock {
  protected readonly store = inject(TrackerStore);
  private readonly wiki = inject(CommunityWikiService);

  protected readonly gadgetUrl = `${COMMUNITY_WIKI.url}wiki/${GADGET}`;
  protected readonly hourName = formatGameHour;
  protected readonly hours = Array.from({ length: 24 }, (_, h) => h);

  /** How the clock was checked against the wiki (once per session, when the app starts). */
  protected readonly check = signal<'checking' | 'match' | 'changed' | 'unreadable' | 'offline'>('checking');
  private readonly speed = signal(DEFAULT_SPEED);
  protected readonly gameSpeed = this.speed.asReadonly();

  constructor() {
    void this.checkWiki();
  }

  /** Reads the wiki gadget and uses its speed; the app's own (identical) formula if it can't. */
  private async checkWiki(): Promise<void> {
    try {
      const src = await this.wiki.source(GADGET);
      const s = src ? speedFromGadget(src) : null;
      if (s === null) {
        this.check.set('unreadable');
        return;
      }
      this.speed.set(s);
      this.check.set(s === DEFAULT_SPEED ? 'match' : 'changed');
    } catch {
      this.check.set('offline');
    }
  }

  private readonly offset = computed(() => this.store.gameClock().offset);
  protected readonly now = computed(() => gameTime(this.store.now(), this.speed(), this.offset()));
  protected readonly time = computed(() => formatGameClock(this.now().minutes));
  protected readonly date = computed(() => {
    const g = this.now();
    return `${g.weekday}, the ${ordinal(g.dayOfMonth)} of ${g.month}`;
  });
  protected readonly dayPct = computed(() => (this.now().minutes / 1440) * 100);

  /** Your own clock, shown small beside the game time for a quick reference. */
  protected readonly localTime = computed(() =>
    new Date(this.store.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  );
  protected readonly localDate = computed(() =>
    new Date(this.store.now()).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }),
  );
  protected readonly realPerHour = computed(() => 60 / this.speed());

  private mark(hour: number) {
    const t = this.store.now();
    const ms = msUntilGameMinute(t, hour * 60, this.speed(), this.offset());
    return { label: formatGameHour(hour), ms, at: t + ms };
  }

  /** Always shown in the toolbar: 6 PM and 6 AM, soonest first. */
  protected readonly dusk = computed(() => [this.mark(18), this.mark(6)].sort((a, b) => a.ms - b.ms));
  /** In the popover: all four marks, soonest first. */
  protected readonly upcoming = computed(() => [0, 6, 12, 18].map((h) => this.mark(h)).sort((a, b) => a.ms - b.ms));

  protected readonly windows = computed(() => {
    const t = this.store.now();
    return this.store.gameClock().windows.map((w) => {
      const s = windowStatus(t, w.from, w.to, this.speed(), this.offset());
      return { ...w, ...s, at: t + s.ms };
    });
  });

  /** A window that's open right now (shown as a dot on the toolbar clock). */
  protected readonly anyOpen = computed(() => this.windows().filter((w) => w.open));

  // ---------- editing ----------

  protected readonly adding = signal(false);

  protected addWindow(name: string, from: string, to: string): void {
    this.store.addGameWindow(name || 'Window', Number(from), Number(to));
    this.adding.set(false);
  }

  protected nudge(minutes: number): void {
    this.store.setGameClockOffset(this.offset() + minutes);
  }

  // ---------- display ----------

  protected countdown(ms: number): string {
    if (!Number.isFinite(ms)) return 'all day';
    return ms < 1000 ? 'now' : formatAgo(ms);
  }

  /** Short countdown for the toolbar: "16m", "1h 2m", "<1m" (whole minutes, like the popover). */
  protected short(ms: number): string {
    const m = Math.max(0, Math.floor(ms / 60_000));
    if (m === 0) return '<1m';
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }

  protected realClock(t: number): string {
    return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  protected offsetText(): string {
    const o = this.offset();
    return o === 0 ? '' : `${o > 0 ? '+' : '−'}${Math.abs(o)} game min`;
  }
}

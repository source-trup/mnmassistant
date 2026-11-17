import { Injectable, signal } from '@angular/core';

/**
 * Anonymous usage counts with GoatCounter (https://www.goatcounter.com): no cookies, nothing stored about you, no
 * identifier. What's sent: the page view (with the referrer and screen size GoatCounter's script adds), and the name of
 * a tool or panel when you open or add one. Never your timers, notes, character, lists or anything you type.
 *
 * Only on the live site (so `ng serve` and the tests send nothing), and not when you turn it off in ☰ or your
 * browser sends Do Not Track / Global Privacy Control (unless you turn it back on).
 */
const ENDPOINT = 'https://mnmassistant.goatcounter.com/count';
const SCRIPT = 'https://gc.zgo.at/count.js';
const LIVE_HOST = 'source-trup.github.io';
const SETTING_KEY = 'mnm-assistant.analytics';

interface GoatCounter {
  count(vars: { path: string; title?: string; event?: boolean }): void;
}

@Injectable({ providedIn: 'root' })
export class Analytics {
  /** Whether usage counts are sent (the ☰ menu switch). */
  readonly enabled = signal(readSetting());

  private readonly live = typeof location !== 'undefined' && location.hostname === LIVE_HOST;
  private state: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private queue: { path: string; title: string }[] = [];

  /** Loads GoatCounter, which counts the page view. Call once at startup. */
  start(): void {
    if (this.live && this.enabled()) this.load();
  }

  /** Counts an event, e.g. `open/wiki`. Does nothing when off, on a dev server, or if GoatCounter is blocked. */
  count(path: string, title = path): void {
    if (!this.live || !this.enabled() || this.state === 'failed') return;
    const gc = (window as { goatcounter?: Partial<GoatCounter> }).goatcounter;
    if (this.state === 'ready') gc?.count?.({ path, title, event: true });
    else {
      this.queue.push({ path, title });
      this.load();
    }
  }

  setEnabled(on: boolean): void {
    this.enabled.set(on);
    try {
      localStorage.setItem(SETTING_KEY, on ? 'on' : 'off');
    } catch {
      // Private mode: it still applies until the page is closed.
    }
    if (!on) this.queue = [];
    else this.start();
  }

  private load(): void {
    if (this.state !== 'idle') return;
    this.state = 'loading';
    const s = document.createElement('script');
    s.async = true;
    s.src = SCRIPT;
    s.dataset['goatcounter'] = ENDPOINT;
    s.onload = () => {
      this.state = 'ready';
      const queued = this.queue;
      this.queue = [];
      for (const e of queued) this.count(e.path, e.title);
    };
    s.onerror = () => {
      // Blocked (an ad blocker) or offline: fine, stay quiet.
      this.state = 'failed';
      this.queue = [];
    };
    document.head.appendChild(s);
  }
}

function readSetting(): boolean {
  try {
    const saved = localStorage.getItem(SETTING_KEY);
    if (saved) return saved === 'on';
  } catch {
    // No storage: fall through to the default.
  }
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { globalPrivacyControl?: boolean });
  return !(nav?.globalPrivacyControl === true || nav?.doNotTrack === '1');
}

/** "Price Checker" → "price-checker". */
export function eventSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

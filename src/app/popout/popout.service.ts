import { ApplicationRef, Injectable, Injector, computed, effect, inject, signal } from '@angular/core';
import { ConfirmService } from '../confirm.service';
import { GRID } from '../layout';
import { Panel, TrackerStore } from '../tracker.store';

/** Panel kinds that can go into the pop-out window. */
export type PoppablePanel = Extract<Panel, { kind: 'timer' | 'counter' | 'buffs' }>;

/** 'pip': Edge/Chrome's always-on-top Document Picture-in-Picture window. 'window': a plain pop-up (Firefox, Waterfox…). */
export type PopoutMode = 'pip' | 'window';

const GEOMETRY_KEY = 'mnm-assistant.popout';
const PAD = 8;
const GAP = 8;
/** Room for the "keep it on top" hint in a plain pop-up. */
const HINT_H = 64;

interface Geometry {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Moves timer, camp and buff panels into a small window of their own. It's the same running app (the panels'
 * elements are simply moved into the other window's document), so everything stays in sync.
 *
 * Edge and Chrome get a Document Picture-in-Picture window, which the browser keeps on top of other windows.
 * Elsewhere it's a normal pop-up window; Windows' PowerToys "Always On Top" (Win+Ctrl+T) pins that.
 */
@Injectable({ providedIn: 'root' })
export class PopoutService {
  private readonly store = inject(TrackerStore);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(Injector);

  /** Popped-out panel ids, in the order they were popped out. */
  readonly ids = signal<string[]>([]);
  /** Set while the pop-out window is open. */
  readonly mode = signal<PopoutMode | null>(null);

  readonly panels = computed(() => {
    const all = this.store.panels();
    return this.ids()
      .map((id) => all.find((p) => p.id === id))
      .filter((p): p is PoppablePanel => !!p && (p.kind === 'timer' || p.kind === 'counter' || p.kind === 'buffs'));
  });

  private win: Window | null = null;
  private hostEl: HTMLElement | null = null;
  private homeMarker: Comment | null = null;
  private cleanup: (() => void)[] = [];
  /** When the pop-out or the main window last had a click or key press (decides where a confirmation shows). */
  private lastPopoutInput = 0;
  private lastMainInput = 0;

  constructor() {
    // A popped-out panel that was deleted leaves the window; an empty window closes.
    effect(() => {
      const shown = this.panels().map((p) => p.id);
      const ids = this.ids();
      if (shown.length !== ids.length) this.ids.set(shown);
      else if (!ids.length && this.win) this.close();
    });
    const mark = () => (this.lastMainInput = Date.now());
    document.addEventListener('pointerdown', mark, true);
    document.addEventListener('keydown', mark, true);
    // The pop-out can't outlive the page it belongs to.
    window.addEventListener('pagehide', () => this.close());
  }

  /** The element the pop-out panels render into (the PopoutHost component). */
  register(host: HTMLElement): void {
    this.hostEl = host;
  }

  isPopped(id: string): boolean {
    return this.ids().includes(id);
  }

  /** True when the last click or key press was in the pop-out window. */
  inPopout(): boolean {
    return !!this.win && this.lastPopoutInput > this.lastMainInput;
  }

  toggle(id: string): void {
    if (this.isPopped(id)) this.dock(id);
    else void this.popOut(id);
  }

  /** Puts a panel back on the board. */
  dock(id: string): void {
    this.ids.update((ids) => ids.filter((x) => x !== id));
  }

  /** Puts every panel back and closes the window. */
  dockAll(): void {
    this.close();
  }

  async popOut(id: string): Promise<void> {
    const panel = this.store.panels().find((p) => p.id === id);
    if (!panel || this.isPopped(id)) return;
    if (!this.win) {
      // Must run straight from the click: both kinds of window need the user's gesture.
      const ok = await this.open(this.sizeFor([...this.panels(), panel as PoppablePanel]));
      if (!ok) return;
    }
    this.ids.update((ids) => [...ids, id]);
    this.win!.requestAnimationFrame(() => this.growToFit());
  }

  // ---------- the window ----------

  private sizeFor(panels: Panel[]): { width: number; height: number } {
    const width = Math.max(...panels.map((p) => (p.w - 1) * GRID)) + PAD * 2;
    const height = panels.reduce((sum, p) => sum + (p.h - 1) * GRID, 0) + GAP * (panels.length - 1) + PAD * 2;
    return { width, height };
  }

  private async open(size: { width: number; height: number }): Promise<boolean> {
    if (!this.hostEl) return false;
    const pip = (window as any).documentPictureInPicture;
    let win: Window | null = null;
    let mode: PopoutMode = 'window';
    if (pip?.requestWindow) {
      try {
        win = await pip.requestWindow({ width: size.width, height: size.height });
        mode = 'pip';
      } catch {
        win = null;
      }
    }
    if (!win) {
      const saved = readGeometry();
      const g = { width: saved?.width ?? size.width, height: Math.max(saved?.height ?? 0, size.height + HINT_H) };
      const at = saved ? `,left=${saved.left},top=${saved.top}` : '';
      win = window.open('', 'mnm-popout', `popup=yes,width=${g.width},height=${g.height}${at}`);
      if (!win) {
        await this.injector
          .get(ConfirmService)
          .ask('Pop-out blocked', 'The browser blocked the pop-out window. Allow pop-ups for this site, then try again.', 'OK', 'primary');
        return false;
      }
      // A fresh about:blank page is in quirks mode; give it a proper document.
      win.document.open();
      win.document.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
      win.document.close();
    }
    this.win = win;
    this.mode.set(mode);
    this.setUpDocument(win);
    return true;
  }

  private setUpDocument(win: Window): void {
    const doc = win.document;
    doc.title = 'MnM Assistant · pop-out';
    const base = doc.createElement('base');
    base.href = document.baseURI;
    doc.head.append(base);

    // Styles: copy what's there now, and anything Angular adds later (component styles load on first use).
    // Our own linked sheet is fetched and copied as text (a <link> in a fresh about:blank window doesn't reliably
    // load, and copying cssRules loses shorthands that use variables); other sites' sheets (fonts) are linked.
    const copy = (n: Node) => {
      if (n.nodeName === 'STYLE') doc.head.append(doc.importNode(n, true));
      else if (n.nodeName === 'LINK' && (n as HTMLLinkElement).rel === 'stylesheet') {
        const href = (n as HTMLLinkElement).href;
        const style = doc.createElement('style');
        doc.head.append(style); // keeps its place in the cascade while the text loads
        if (new URL(href).origin === location.origin) {
          fetch(href)
            .then((r) => (r.ok ? r.text() : Promise.reject()))
            .then((css) => (style.textContent = css))
            .catch(() => style.replaceWith(linkTo(doc, href)));
        } else {
          style.replaceWith(linkTo(doc, href));
        }
      }
    };
    document.head.childNodes.forEach(copy);
    const headWatch = new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach(copy)));
    headWatch.observe(document.head, { childList: true });

    // The theme lives on <html> (inline CSS variables and data-theme).
    const syncTheme = () => {
      const html = doc.documentElement;
      html.setAttribute('style', document.documentElement.getAttribute('style') ?? '');
      html.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') ?? '');
    };
    syncTheme();
    const themeWatch = new MutationObserver(syncTheme);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme'] });

    doc.body.classList.add('popout-body');
    const host = this.hostEl!;
    this.homeMarker = document.createComment('popout');
    host.before(this.homeMarker);
    doc.body.append(host);

    // If the main window is hidden behind the game its timers get throttled; the pop-out drives the clock then.
    const tick = () => {
      if (!document.hidden) return;
      this.store.tickNow();
      this.appRef.tick();
    };
    const timer = win.setInterval(tick, 250);
    const mark = () => {
      this.lastPopoutInput = Date.now();
      win.setTimeout(tick);
    };
    doc.addEventListener('pointerdown', mark, true);
    doc.addEventListener('keydown', mark, true);
    doc.addEventListener('click', () => win.setTimeout(tick), true);
    doc.addEventListener('input', () => win.setTimeout(tick), true);

    const remember = () => {
      if (this.mode() === 'window') saveGeometry({ left: win.screenX, top: win.screenY, width: win.innerWidth, height: win.innerHeight });
    };
    win.addEventListener('resize', remember);
    // Closed by the user (✕ on the window). Not every close fires pagehide, so check now and then too.
    win.addEventListener('pagehide', () => this.close(false));
    const watch = window.setInterval(() => win.closed && this.close(false), 500);

    this.cleanup = [
      () => headWatch.disconnect(),
      () => themeWatch.disconnect(),
      () => win.clearInterval(timer),
      () => window.clearInterval(watch),
      remember,
    ];
  }

  /** Grows the window when a panel is added and doesn't fit (never shrinks what the user chose). */
  private growToFit(): void {
    const win = this.win;
    if (!win) return;
    const extra = win.document.documentElement.scrollHeight - win.innerHeight;
    const wider = win.document.documentElement.scrollWidth - win.innerWidth;
    if (extra > 0 || wider > 0) {
      try {
        win.resizeBy(Math.max(0, wider), Math.max(0, extra));
      } catch {
        // Some windows can't be resized from script; the content scrolls instead.
      }
    }
  }

  private close(closeWindow = true): void {
    const win = this.win;
    if (!win) return;
    this.win = null;
    for (const fn of this.cleanup) fn();
    this.cleanup = [];
    // Bring the host element home before the window's document goes away.
    if (this.hostEl && this.homeMarker) this.homeMarker.replaceWith(this.hostEl);
    this.homeMarker = null;
    this.ids.set([]);
    this.mode.set(null);
    if (closeWindow && !win.closed) win.close();
  }
}

function linkTo(doc: Document, href: string): HTMLLinkElement {
  const l = doc.createElement('link');
  l.rel = 'stylesheet';
  l.href = href;
  return l;
}

function readGeometry(): Geometry | null {
  try {
    const g = JSON.parse(localStorage.getItem(GEOMETRY_KEY) ?? 'null');
    return g && [g.left, g.top, g.width, g.height].every((n) => Number.isFinite(n)) && g.width > 100 && g.height > 80 ? g : null;
  } catch {
    return null;
  }
}

function saveGeometry(g: Geometry): void {
  try {
    localStorage.setItem(GEOMETRY_KEY, JSON.stringify(g));
  } catch {
    // Not saved; the window opens at its default size next time.
  }
}

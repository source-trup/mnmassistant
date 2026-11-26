import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { CommunityWikiService, wikiPageUrl } from '../community-wiki/community-wiki.service';
import { SiteKind, dotWikiUrl } from './site-urls';

/** Tooltip for a monstersandmemories.wiki link built from a name (the site can't be checked). */
const GUESS_TIP =
  "Opens monstersandmemories.wiki in a new tab. That wiki's rules don't let apps look up its pages, so this link is made from the name and might not find one.";

/**
 * The same thing on the other community sites, as one compact group of links that open in a new tab:
 *
 *   [ Miraheze ↗ | .wiki ↗ | MnMdb ↗ ]
 *
 * - Miraheze: a page title, or left out to look the name up (shown only when the page exists).
 * - .wiki: an address that's known (from its search, or pasted in), else one built from the name and `kind`.
 *   Pages that aren't an item or an NPC (kind null) have no .wiki address to build.
 * - MnMdb: an address, when MnMdb has the item.
 */
@Component({
  selector: 'app-site-links',
  template: `
    @if (mirahezeUrl() || dotUrl() || mnmdb()) {
      <span class="links" role="group" [attr.aria-label]="'Open ' + name() + ' on other sites'">
        @if (mirahezeUrl(); as u) {
          <a [href]="u" target="_blank" rel="noopener" title="Open this page on the Miraheze wiki (new tab)">Miraheze <span class="arr">↗</span></a>
        }
        @if (dotUrl(); as u) {
          <a [href]="u" target="_blank" rel="noopener" [class.guess]="!dotWiki()" [title]="dotWiki() ? 'Open on monstersandmemories.wiki (new tab)' : GUESS_TIP"
            >.wiki <span class="arr">↗</span></a
          >
        }
        @if (mnmdb(); as u) {
          <a [href]="u" target="_blank" rel="noopener" title="Open on MnMdb (new tab)">MnMdb <span class="arr">↗</span></a>
        }
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      max-width: 100%;
      vertical-align: middle;
    }
    .links {
      display: inline-flex;
      align-items: stretch;
      max-width: 100%;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: color-mix(in srgb, var(--input-bg) 55%, transparent);
    }
    a {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 7px;
      font-size: 0.74rem;
      line-height: 1.55;
      color: var(--spirit);
      text-decoration: none;
      white-space: nowrap;
      transition: background-color 0.12s, color 0.12s;

      & + a {
        border-left: 1px solid var(--border);
      }
      &:hover {
        background: var(--spirit-soft);
        color: var(--bone);
      }
      &:focus-visible {
        outline: 2px solid var(--spirit-line);
        outline-offset: -2px;
      }
    }
    .arr {
      font-size: 0.85em;
      opacity: 0.65;
    }
    a:hover .arr {
      opacity: 1;
    }
  `,
})
export class SiteLinks {
  /** The item's or NPC's name (or the wiki page's title). */
  readonly name = input.required<string>();
  /** What it is, for its .wiki address; null when it's neither (no .wiki link). */
  readonly kind = input<SiteKind | null>('item');
  /** Its Miraheze page title; null for none; left out to look the name up. */
  readonly miraheze = input<string | null | undefined>(undefined);
  /** A known monstersandmemories.wiki address (otherwise one is built from the name). */
  readonly dotWiki = input<string | null>(null);
  /** Its MnMdb address, if MnMdb has it. */
  readonly mnmdb = input<string | null>(null);

  private readonly community = inject(CommunityWikiService);
  protected readonly GUESS_TIP = GUESS_TIP;

  /** The Miraheze page found by name, when no title was given. */
  private readonly found = signal<string | null>(null);
  private seq = 0;

  protected readonly mirahezeUrl = computed(() => {
    const given = this.miraheze();
    const title = given === undefined ? this.found() : given;
    return title ? wikiPageUrl(title) : null;
  });

  protected readonly dotUrl = computed(() => {
    const known = this.dotWiki();
    if (known) return known;
    const kind = this.kind();
    const name = this.name().trim();
    return kind && name ? dotWikiUrl(name, kind) : null;
  });

  constructor() {
    effect(() => {
      const name = this.name().trim();
      const lookUp = this.miraheze() === undefined;
      const n = ++this.seq;
      this.found.set(null);
      if (!lookUp || !name) return;
      this.community
        .resolve(name)
        .then((t) => n === this.seq && this.found.set(t))
        .catch(() => undefined);
    });
  }
}

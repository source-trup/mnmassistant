import { Component, input } from '@angular/core';
import { CardData } from './card-data';

/**
 * An item as a card, like the game's inspect window: icon and name, flags, slots, weapon damage and delay, stats,
 * who can wear it, and where it comes from. The hover tooltip of the Gear Planner, Wishlist and Price Checker.
 */
@Component({
  selector: 'app-item-card',
  template: `
    @let c = card();
    <div class="top">
      <span class="frame">
        @if (c.icon) {
          <img [src]="c.icon" alt="" referrerpolicy="no-referrer" (error)="$any($event.target).hidden = true" />
        }
      </span>
      <div class="title">
        <div class="name">{{ c.name }}</div>
        @if (c.flags.length) {
          <div class="flags">
            @for (f of c.flags; track f) {
              <span [class.nodrop]="f === 'NO DROP'">{{ f }}</span>
            }
          </div>
        }
      </div>
    </div>

    @if (c.missing) {
      <p class="missing">No item data available.</p>
      <p class="missing-hint">None of the item sites know it yet. Make it yourself with 🛠 My items (in the Gear Planner or Wishlist).</p>
    } @else {
    <dl class="facts">
      <dt>Slot</dt>
      <dd>{{ c.slots }}</dd>
      @if (c.weapon; as w) {
        <dt>Weapon</dt>
        <dd>
          <b>{{ w.dmg }}</b> dmg · <b>{{ w.delay }}</b> delay{{ w.note ? ' · ' + w.note : '' }}
          <span class="ratio" title="Damage ÷ delay">({{ w.ratio }})</span>
        </dd>
      }
    </dl>

    @if (c.headline.length || c.attributes.length || c.resists.length || c.extras.length) {
      <div class="stats">
        @if (c.headline.length) {
          <div class="head-stats">
            @for (s of c.headline; track s.label) {
              <span [class.neg]="s.value < 0"><small>{{ s.label }}</small>{{ s.text }}</span>
            }
          </div>
        }
        @if (c.attributes.length) {
          <div class="attrs">
            @for (s of c.attributes; track s.label) {
              <span [class.neg]="s.value < 0"><small>{{ s.label }}</small>{{ s.text }}</span>
            }
          </div>
        }
        @if (c.resists.length) {
          <div class="attrs resists">
            @for (s of c.resists; track s.label) {
              <span [class.neg]="s.value < 0"><small>{{ s.label }}</small>{{ s.text }}</span>
            }
          </div>
        }
        @if (c.extras.length) {
          <div class="extras">{{ c.extras.join(' · ') }}</div>
        }
      </div>
    } @else {
      <p class="nostats">No stats</p>
    }
    @if (c.effect) {
      <p class="effect">Effect: {{ c.effect }}</p>
    }

    <dl class="facts who">
      <dt>Class</dt>
      <dd>{{ c.classes }}</dd>
      <dt>Race</dt>
      <dd>{{ c.races }}</dd>
    </dl>

    <div class="source">
      @if (c.drops.length) {
        <div class="src-k">Drops from</div>
        @for (d of c.drops; track d.key) {
          <div class="drop">
            <span class="npc">{{ d.name }}</span>
            @if (d.levels) {
              <span class="lv">{{ d.levels }}</span>
            }
            @if (d.raid) {
              <span class="raid">Raid</span>
            }
            @if (d.zone) {
              <span class="zone">{{ d.zone }}</span>
            }
            @if (d.rate) {
              <span class="rate">{{ d.rate }}</span>
            }
          </div>
        }
        @if (c.moreDrops) {
          <div class="more">+{{ c.moreDrops }} more</div>
        }
      } @else if (c.zones.length) {
        <div class="src-k">Found in</div>
        <div class="drop"><span class="zone">{{ c.zones.join(', ') }}</span></div>
      }
      @if (c.crafted) {
        <div class="crafted">⚒ Crafted: {{ c.crafted }}</div>
      }
      @if (c.note) {
        <div class="crafted">📍 From: {{ c.note }}</div>
      }
      @if (!c.drops.length && !c.zones.length && !c.crafted && !c.note) {
        <div class="none">{{ c.source === 'your own item' ? 'Where it comes from isn’t noted' : 'Quest or other (no known drop)' }}</div>
      }
      <div class="via">Details: {{ c.source }}</div>
    </div>
    }
  `,
  styleUrl: './item-card.scss',
})
export class ItemCard {
  readonly card = input.required<CardData>();
}

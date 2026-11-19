import { Component, DestroyRef, ElementRef, computed, inject, input, signal } from '@angular/core';

/**
 * Series colours (categorical, in fixed order; a counter keeps its colour everywhere). The dark-surface steps of the
 * validated default palette: every theme here is dark, and each step clears 3:1 on the theme surfaces.
 */
export const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];

/** Past the eighth counter, colours would repeat; those fold out of the line chart (they're still in the table). */
export const MAX_SERIES = SERIES_COLORS.length;

export interface LineSeries {
  id: string;
  name: string;
  color: string;
  /** [minute, running total], minutes in order. */
  points: [number, number][];
}

export interface Bar {
  id: string;
  /** Short label under the bar (e.g. a date). */
  label: string;
  value: number;
  /** Shown in the tooltip under the value. */
  detail: string;
}

const H = 190;
const M = { top: 12, right: 40, bottom: 24, left: 38 };

/** Up to ~4 round tick values from 0 (or a negative min) to at least max. */
export function niceTicks(min: number, max: number): number[] {
  const lo = Math.min(0, min);
  const span = Math.max(1, max - lo);
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = Math.floor(lo / step) * step; v < max + step - 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
  if (ticks.length < 2) ticks.push(step);
  return ticks;
}

/** Minute ticks along a session: a round step that gives at most ~6 labels. */
export function minuteTicks(end: number): number[] {
  const step = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 360, 720].find((s) => end / s <= 6) ?? 1440;
  const out: number[] = [];
  for (let m = 0; m <= end + 1e-9; m += step) out.push(m);
  return out;
}

export function formatMinute(m: number): string {
  const total = Math.round(m);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const mm = total % 60;
  return mm ? `${h}h${String(mm).padStart(2, '0')}` : `${h}h`;
}

function compact(n: number): string {
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** Tracks the host's width so the chart draws in real pixels (text never stretches). */
abstract class Sized {
  protected readonly width = signal(520);
  protected readonly H = H;
  protected readonly M = M;

  constructor() {
    const ro = new ResizeObserver(([e]) => this.width.set(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
    inject(DestroyRef).onDestroy(() => ro.disconnect());
  }
}

/**
 * Running total of each counter through one session (one line per counter). The crosshair snaps to the nearest minute
 * and the tooltip lists every counter there; arrow keys move it too.
 */
@Component({
  selector: 'app-session-line-chart',
  template: `
    <svg
      [attr.width]="width()"
      [attr.height]="H"
      role="img"
      [attr.aria-label]="ariaLabel()"
      tabindex="0"
      (pointermove)="hover($event)"
      (pointerleave)="at.set(null)"
      (keydown)="key($event)"
      (blur)="at.set(null)"
    >
      @for (t of yTicks(); track t) {
        <line class="grid" [attr.x1]="M.left" [attr.x2]="width() - M.right" [attr.y1]="y(t)" [attr.y2]="y(t)" />
        <text class="tick" [attr.x]="M.left - 6" [attr.y]="y(t) + 4" text-anchor="end">{{ fmt(t) }}</text>
      }
      @for (t of xTicks(); track t) {
        <text class="tick" [attr.x]="x(t)" [attr.y]="H - 6" text-anchor="middle">{{ minute(t) }}</text>
      }
      @if (at() !== null) {
        <line class="cross" [attr.x1]="x(at()!)" [attr.x2]="x(at()!)" [attr.y1]="M.top" [attr.y2]="H - M.bottom" />
      }
      @for (s of series(); track s.id) {
        <path class="line" [attr.d]="path(s)" [attr.stroke]="s.color" />
        @if (s.points.at(-1); as end) {
          <circle class="dot" [attr.cx]="x(end[0])" [attr.cy]="y(end[1])" r="4" [attr.fill]="s.color" />
        }
      }
      @for (l of endLabels(); track l.id) {
        <text class="end" [attr.x]="width() - M.right + 8" [attr.y]="l.y + 4">{{ fmt(l.value) }}</text>
      }
    </svg>
    @if (readout(); as r) {
      <div class="tip" [style.left.px]="r.left">
        <div class="tt">{{ r.time }}</div>
        @for (v of r.rows; track v.id) {
          <div class="tr"><i [style.background]="v.color"></i><b>{{ fmt(v.value) }}</b><span>{{ v.name }}</span></div>
        }
      </div>
    }
  `,
  styleUrl: './session-charts.scss',
})
export class SessionLineChart extends Sized {
  readonly series = input.required<LineSeries[]>();
  /** How long the session ran, in minutes (the x axis ends there). */
  readonly end = input.required<number>();

  protected readonly at = signal<number | null>(null);
  protected readonly minute = formatMinute;
  protected readonly fmt = compact;

  private readonly xMax = computed(() => Math.max(1, this.end()));
  private readonly yRange = computed(() => {
    const ys = this.series().flatMap((s) => s.points.map((p) => p[1]));
    return { min: Math.min(0, ...ys), max: Math.max(1, ...ys) };
  });
  protected readonly yTicks = computed(() => niceTicks(this.yRange().min, this.yRange().max));
  protected readonly xTicks = computed(() => minuteTicks(this.xMax()));

  protected x(m: number): number {
    return M.left + (m / this.xMax()) * (this.width() - M.left - M.right);
  }

  protected y(v: number): number {
    const t = this.yTicks();
    const lo = t[0];
    const hi = t.at(-1)!;
    return H - M.bottom - ((v - lo) / (hi - lo || 1)) * (H - M.top - M.bottom);
  }

  protected path(s: LineSeries): string {
    return s.points.map((p, i) => `${i ? 'L' : 'M'}${this.x(p[0]).toFixed(1)},${this.y(p[1]).toFixed(1)}`).join('');
  }

  /** End values beside the last points, skipping any that would sit on top of another (the legend and tooltip have them). */
  protected readonly endLabels = computed(() => {
    if (this.series().length > 4) return [];
    const ends = this.series()
      .map((s) => ({ id: s.id, value: s.points.at(-1)?.[1] ?? 0, y: this.y(s.points.at(-1)?.[1] ?? 0) }))
      .sort((a, b) => a.y - b.y);
    const out: typeof ends = [];
    for (const e of ends) if (!out.some((o) => Math.abs(o.y - e.y) < 13)) out.push(e);
    return out;
  });

  /** Running total at a minute: the last point at or before it. */
  private valueAt(s: LineSeries, m: number): number {
    let v = 0;
    for (const [pm, pv] of s.points) {
      if (pm > m + 1e-9) break;
      v = pv;
    }
    return v;
  }

  protected readonly readout = computed(() => {
    const m = this.at();
    if (m === null) return null;
    const left = Math.min(this.width() - 150, Math.max(0, this.x(m) + 10));
    const rows = this.series()
      .map((s) => ({ id: s.id, name: s.name, color: s.color, value: this.valueAt(s, m) }))
      .sort((a, b) => b.value - a.value);
    return { left, time: m >= this.xMax() - 1e-9 ? `${formatMinute(m)} (end)` : formatMinute(m), rows };
  });

  protected readonly ariaLabel = computed(
    () => `Running count through the session: ${this.series().map((s) => `${s.name} ${s.points.at(-1)?.[1] ?? 0}`).join(', ')}`,
  );

  protected hover(e: PointerEvent): void {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const m = ((px - M.left) / (this.width() - M.left - M.right)) * this.xMax();
    const r = Math.round(m);
    this.at.set(r >= this.xMax() ? this.xMax() : Math.max(0, r));
  }

  protected key(e: KeyboardEvent): void {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const cur = this.at() ?? (e.key === 'ArrowLeft' ? this.xMax() : 0);
    const next = e.key === 'ArrowLeft' ? Math.ceil(cur) - 1 : Math.floor(cur) + 1;
    this.at.set(Math.max(0, Math.min(this.xMax(), next)));
  }
}

/** One bar per session for one measure (a counter's total or its rate). Hover or focus a bar for its value. */
@Component({
  selector: 'app-session-bar-chart',
  template: `
    <svg [attr.width]="width()" [attr.height]="H" role="img" [attr.aria-label]="ariaLabel()">
      @for (t of yTicks(); track t) {
        <line class="grid" [attr.x1]="M.left" [attr.x2]="width() - M.right" [attr.y1]="y(t)" [attr.y2]="y(t)" />
        <text class="tick" [attr.x]="M.left - 6" [attr.y]="y(t) + 4" text-anchor="end">{{ fmt(t) }}</text>
      }
      @for (b of bars(); track b.id; let i = $index) {
        <g
          class="bar"
          [class.on]="hovered() === i"
          tabindex="0"
          [attr.aria-label]="b.label + ': ' + fmt(b.value) + ', ' + b.detail"
          (pointerenter)="hovered.set(i)"
          (pointerleave)="hovered.set(null)"
          (focus)="hovered.set(i)"
          (blur)="hovered.set(null)"
        >
          <rect class="hit" [attr.x]="bandX(i)" [attr.y]="M.top" [attr.width]="band()" [attr.height]="H - M.top - M.bottom" />
          <path [attr.d]="barPath(i, b.value)" [attr.fill]="color()" />
          @if (i === peak() && b.value > 0) {
            <text class="end" [attr.x]="cx(i)" [attr.y]="y(b.value) - 5" text-anchor="middle">{{ fmt(b.value) }}</text>
          }
          @if (showLabel(i)) {
            <text class="tick" [attr.x]="cx(i)" [attr.y]="H - 6" text-anchor="middle">{{ b.label }}</text>
          }
        </g>
      }
    </svg>
    @if (hovered() !== null && bars()[hovered()!]; as b) {
      <div class="tip" [style.left.px]="tipLeft()">
        <div class="tr"><b>{{ fmt(b.value) }}</b><span>{{ unit() }}</span></div>
        <div class="tt">{{ b.detail }}</div>
      </div>
    }
  `,
  styleUrl: './session-charts.scss',
})
export class SessionBarChart extends Sized {
  readonly bars = input.required<Bar[]>();
  readonly color = input.required<string>();
  /** What the value is, for the tooltip ("kills", "per hour"). */
  readonly unit = input('');

  protected readonly hovered = signal<number | null>(null);
  protected readonly fmt = compact;

  protected readonly yTicks = computed(() => {
    const vs = this.bars().map((b) => b.value);
    return niceTicks(Math.min(0, ...vs), Math.max(1, ...vs));
  });

  protected readonly band = computed(() => (this.width() - M.left - M.right) / Math.max(1, this.bars().length));

  protected readonly peak = computed(() => {
    let best = -1;
    this.bars().forEach((b, i) => {
      if (best < 0 || b.value > this.bars()[best].value) best = i;
    });
    return best;
  });

  protected bandX(i: number): number {
    return M.left + i * this.band();
  }

  protected cx(i: number): number {
    return this.bandX(i) + this.band() / 2;
  }

  protected y(v: number): number {
    const t = this.yTicks();
    return H - M.bottom - ((v - t[0]) / (t.at(-1)! - t[0] || 1)) * (H - M.top - M.bottom);
  }

  /** A bar at most 24px wide, rounded 4px at its data end and square at the baseline. */
  protected barPath(i: number, v: number): string {
    const w = Math.max(3, Math.min(24, this.band() - 2));
    const x0 = this.cx(i) - w / 2;
    const base = this.y(0);
    const top = this.y(v);
    const h = Math.abs(base - top);
    if (h < 0.5) return '';
    const r = Math.min(4, w / 2, h);
    if (v >= 0) {
      return `M${x0},${base}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + w - r}Q${x0 + w},${top} ${x0 + w},${top + r}V${base}Z`;
    }
    return `M${x0},${base}V${top - r}Q${x0},${top} ${x0 + r},${top}H${x0 + w - r}Q${x0 + w},${top} ${x0 + w},${top - r}V${base}Z`;
  }

  /** Labels under the bars, thinned so they never overlap (about 44px each). */
  protected showLabel(i: number): boolean {
    const every = Math.max(1, Math.ceil(44 / this.band()));
    const n = this.bars().length;
    return (n - 1 - i) % every === 0; // always label the newest
  }

  protected tipLeft(): number {
    const i = this.hovered() ?? 0;
    return Math.min(this.width() - 160, Math.max(0, this.cx(i) + 10));
  }

  protected readonly ariaLabel = computed(() => `${this.unit()} per session: ${this.bars().map((b) => `${b.label} ${compact(b.value)}`).join(', ')}`);
}

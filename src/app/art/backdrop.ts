import { Component, computed, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MoteKind, themeById } from '../themes';
import { TrackerStore } from '../tracker.store';

interface Mote {
  kind: MoteKind;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  color: string;
  char: string;
}

/**
 * Decorative, non-interactive background, drawn for the active class theme: a faint slowly turning sigil built
 * from the class glyph, a prop in the corner(s), drifting mist, and ambient particles (spirit motes, embers,
 * leaves, ash, music notes or twinkling sparks). Everything sits behind the board.
 */
@Component({
  selector: 'app-backdrop',
  template: `
    <div class="sigil" [innerHTML]="sigil()"></div>

    @if (left(); as l) {
      <div class="corner left" [style.width.px]="l.width" [innerHTML]="l.html"></div>
    }
    @if (right(); as r) {
      <div class="corner right" [style.width.px]="r.width" [innerHTML]="r.html"></div>
    }

    <div class="fog low"></div>
    <div class="fog mid"></div>

    @for (m of motes(); track $index) {
      <span
        [class]="'mote ' + m.kind"
        [style.left.%]="m.left"
        [style.top.%]="m.kind === 'twinkle' ? m.top : null"
        [style.width.px]="m.kind === 'note' ? null : m.size"
        [style.height.px]="m.kind === 'note' ? null : m.kind === 'ember' ? m.size * 1.8 : m.size"
        [style.font-size.px]="m.kind === 'note' ? m.size : null"
        [style.color]="m.color"
        [style.background]="m.kind === 'note' ? null : m.color"
        [style.box-shadow]="m.kind === 'note' || m.kind === 'leaf' ? null : '0 0 ' + m.size * 3 + 'px ' + m.color"
        [style.animation-duration.s]="m.duration"
        [style.animation-delay.s]="m.delay"
        [style.--drift]="m.drift + 'px'"
        >{{ m.char }}</span
      >
    }
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .sigil {
      position: absolute;
      top: 50%;
      left: 50%;
      width: min(75vmin, 720px);
      height: min(75vmin, 720px);
      margin: calc(min(75vmin, 720px) / -2) 0 0 calc(min(75vmin, 720px) / -2);
      color: var(--spirit);
      opacity: 0.065;
      animation: spin 360s linear infinite;
    }
    .sigil ::ng-deep svg { width: 100%; height: 100%; }
    .corner {
      position: absolute;
      bottom: 0;
      opacity: 0.7;
    }
    .corner ::ng-deep svg { display: block; width: 100%; height: auto; }
    .corner.left { left: 0; }
    .corner.right { right: 18px; opacity: 0.6; }
    .fog {
      position: absolute;
      left: -10%;
      width: 120%;
      filter: blur(12px);
      animation: fog-drift 45s ease-in-out infinite alternate;
    }
    .fog.low {
      bottom: -40px;
      height: 260px;
      background:
        radial-gradient(ellipse 35% 55% at 28% 70%, color-mix(in srgb, var(--spirit) 8%, transparent), transparent 70%),
        radial-gradient(ellipse 30% 45% at 72% 80%, color-mix(in srgb, var(--spirit) 6%, transparent), transparent 70%),
        radial-gradient(ellipse 25% 40% at 50% 95%, color-mix(in srgb, var(--spirit) 5%, transparent), transparent 70%);
    }
    .fog.mid {
      top: 30%;
      height: 360px;
      animation-duration: 65s;
      animation-direction: alternate-reverse;
      background:
        radial-gradient(ellipse 28% 38% at 18% 50%, color-mix(in srgb, var(--spirit) 4.5%, transparent), transparent 70%),
        radial-gradient(ellipse 24% 32% at 84% 40%, var(--mist-2), transparent 70%);
    }
    @keyframes fog-drift {
      from { transform: translateX(-4%); }
      to { transform: translateX(4%); }
    }

    /* ---- particles ---- */
    .mote {
      position: absolute;
      top: 100%;
      border-radius: 50%;
      opacity: 0;
      animation: rise linear infinite;
      line-height: 1;
    }
    .mote.ember { border-radius: 50% 50% 40% 40%; animation-name: ember; animation-timing-function: ease-in; }
    .mote.fall { top: -2%; animation-name: fall; }
    .mote.leaf { top: -3%; border-radius: 0 70% 0 70%; animation-name: leaf; }
    .mote.note { background: none; border-radius: 0; font-family: 'Segoe UI Symbol', system-ui, sans-serif; animation-name: note; }
    .mote.twinkle { animation-name: twinkle; animation-timing-function: ease-in-out; }
    @keyframes rise {
      0% { transform: translate(0, 0); opacity: 0; }
      10% { opacity: 0.7; }
      50% { transform: translate(var(--drift), -55vh); }
      85% { opacity: 0.5; }
      100% { transform: translate(0, -105vh); opacity: 0; }
    }
    @keyframes ember {
      0% { transform: translate(0, 0) scale(1); opacity: 0; }
      8% { opacity: 0.9; }
      60% { transform: translate(var(--drift), -45vh) scale(0.7); opacity: 0.6; }
      100% { transform: translate(calc(var(--drift) * -0.5), -75vh) scale(0.3); opacity: 0; }
    }
    @keyframes fall {
      0% { transform: translate(0, 0); opacity: 0; }
      10% { opacity: 0.55; }
      50% { transform: translate(var(--drift), 55vh); }
      90% { opacity: 0.4; }
      100% { transform: translate(0, 106vh); opacity: 0; }
    }
    @keyframes leaf {
      0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
      10% { opacity: 0.7; }
      30% { transform: translate(var(--drift), 30vh) rotate(160deg); }
      60% { transform: translate(calc(var(--drift) * -0.6), 62vh) rotate(320deg); }
      90% { opacity: 0.55; }
      100% { transform: translate(calc(var(--drift) * 0.4), 106vh) rotate(480deg); opacity: 0; }
    }
    @keyframes note {
      0% { transform: translate(0, 0) rotate(-8deg); opacity: 0; }
      12% { opacity: 0.6; }
      50% { transform: translate(var(--drift), -55vh) rotate(8deg); }
      85% { opacity: 0.45; }
      100% { transform: translate(0, -105vh) rotate(-8deg); opacity: 0; }
    }
    @keyframes twinkle {
      0%, 100% { opacity: 0; transform: scale(0.4); }
      50% { opacity: 0.85; transform: scale(1); }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .sigil, .fog { animation: none; }
      .mote { display: none; }
    }
  `,
})
export class Backdrop {
  private readonly store = inject(TrackerStore);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly theme = computed(() => themeById(this.store.theme()));

  /** The theme's own trusted SVG constants (from themes.ts), never user input. */
  private trust(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  /** Rune circle with the class glyph at its heart and three small marks around it. */
  protected readonly sigil = computed(() => {
    const t = this.theme();
    const marks = [90, 210, 330]
      .map((deg) => {
        const r = (deg * Math.PI) / 180;
        const x = Math.cos(r) * 132;
        const y = -Math.sin(r) * 132;
        return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="11" stroke-width="2"/><circle r="3" fill="currentColor" stroke="none"/></g>`;
      })
      .join('');
    return this.trust(
      `<svg viewBox="-200 -200 400 400" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">` +
        `<circle r="190" stroke-width="2"/><circle r="176" stroke-width="10" stroke-dasharray="2 16"/><circle r="160" stroke-width="1.5"/>` +
        `<g transform="scale(4.6)" stroke-width="0.7"><path d="${t.glyph}"/></g>${marks}</g></svg>`,
    );
  });

  protected readonly left = computed(() => {
    const l = this.theme().left;
    return l ? { width: l.width, html: this.trust(l.svg) } : null;
  });

  protected readonly right = computed(() => {
    const r = this.theme().right;
    return r ? { width: r.width, html: this.trust(r.svg) } : null;
  });

  protected readonly motes = computed<Mote[]>(() => {
    const { kind, colors, count } = this.theme().motes;
    return Array.from({ length: count }, () => {
      const pick = colors[Math.floor(Math.random() * colors.length)];
      switch (kind) {
        case 'ember':
          return this.mote(kind, pick, 2 + Math.random() * 2, 9 + Math.random() * 8, 70);
        case 'leaf':
          return this.mote(kind, pick, 6 + Math.random() * 5, 20 + Math.random() * 14, 160);
        case 'fall':
          return this.mote(kind, pick, 1.5 + Math.random() * 2.5, 24 + Math.random() * 18, 60);
        case 'note': {
          const m = this.mote(kind, pick, 12 + Math.random() * 8, 22 + Math.random() * 14, 90);
          return { ...m, char: Math.random() < 0.5 ? '♪' : '♫' };
        }
        case 'twinkle':
          return this.mote(kind, pick, 1.5 + Math.random() * 2.5, 3 + Math.random() * 5, 0);
        default:
          return this.mote(kind, pick, 2 + Math.random() * 2.5, 18 + Math.random() * 16, 80);
      }
    });
  });

  private mote(kind: MoteKind, color: string, size: number, duration: number, drift: number): Mote {
    return {
      kind,
      color,
      size,
      duration,
      left: Math.random() * 100,
      top: 8 + Math.random() * 84,
      delay: -Math.random() * duration * 1.5,
      drift: (Math.random() - 0.5) * drift,
      char: '',
    };
  }
}

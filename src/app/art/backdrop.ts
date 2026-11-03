import { Component } from '@angular/core';

interface Mote {
  left: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  color: string;
}

/** Spiral path (Archimedean-ish, built from half-circle arcs) used for carvings and the rune circle. */
const SPIRAL = 'M0 0 a4 4 0 0 1 8 0 a8 8 0 0 1 -16 0 a12 12 0 0 1 24 0 a16 16 0 0 1 -32 0 a20 20 0 0 1 40 0';

/**
 * Decorative, non-interactive background: a faint spirit rune circle, glowing cave mushrooms,
 * a carved spirit stone, and a few drifting spirit motes. Everything sits behind the board.
 */
@Component({
  selector: 'app-backdrop',
  template: `
    <!-- Faint rotating rune circle ("the Spirals") -->
    <svg class="runes" viewBox="-200 -200 400 400">
      <g fill="none" stroke="currentColor">
        <circle r="190" stroke-width="2" />
        <circle r="176" stroke-width="10" stroke-dasharray="2 16" />
        <circle r="160" stroke-width="1.5" />
        <g stroke-width="1.2" transform="translate(-4 0) scale(3.4)"><path [attr.d]="spiral" /></g>
        @for (p of ancestorMarks; track $index) {
          <g [attr.transform]="'translate(' + p.x + ' ' + p.y + ')'">
            <circle r="11" stroke-width="2" />
            <circle r="3" fill="currentColor" stroke="none" />
          </g>
        }
      </g>
    </svg>

    <!-- Bioluminescent mushrooms, bottom left -->
    <svg class="shrooms" viewBox="0 0 220 170">
      <defs>
        <radialGradient id="bd-cap-teal" cx="0.5" cy="0.7" r="0.7">
          <stop offset="0" stop-color="#d2ffe6" />
          <stop offset="0.45" stop-color="#4fdc96" />
          <stop offset="1" stop-color="#11523a" />
        </radialGradient>
        <radialGradient id="bd-cap-violet" cx="0.5" cy="0.7" r="0.7">
          <stop offset="0" stop-color="#ecd2ff" />
          <stop offset="0.45" stop-color="#9a62d8" />
          <stop offset="1" stop-color="#3a1f5c" />
        </radialGradient>
        <filter id="bd-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      <ellipse cx="85" cy="115" rx="90" ry="45" fill="#66f2ae" opacity="0.14" filter="url(#bd-blur)" />
      <path d="M0 170 Q40 150 90 155 T220 160 V170 Z" fill="#0f1317" />
      <g fill="#cfdcd5" opacity="0.55">
        <path d="M70 160 Q66 120 74 92 L86 92 Q90 125 88 160 Z" />
        <path d="M30 162 Q28 140 33 128 L39 128 Q41 145 40 162 Z" />
        <path d="M132 160 Q134 135 128 118 L138 116 Q142 138 142 160 Z" />
        <path d="M166 160 L166 150 L170 150 L171 160 Z" />
      </g>
      <path d="M44 96 Q80 48 118 96 Q80 104 44 96 Z" fill="url(#bd-cap-teal)" />
      <path d="M18 131 Q36 106 54 131 Q36 135 18 131 Z" fill="url(#bd-cap-teal)" />
      <path d="M112 122 Q134 86 160 114 Q136 126 112 122 Z" fill="url(#bd-cap-violet)" />
      <path d="M158 152 Q168 138 178 152 Q168 154 158 152 Z" fill="url(#bd-cap-teal)" />
      <g fill="#effffc" opacity="0.65">
        <circle cx="70" cy="82" r="3" />
        <circle cx="88" cy="76" r="2.4" />
        <circle cx="101" cy="87" r="2.8" />
        <circle cx="132" cy="106" r="2" />
        <circle cx="34" cy="122" r="1.8" />
      </g>
    </svg>

    <!-- Carved spirit stone with feathers, bottom right -->
    <svg class="stone" viewBox="0 0 140 230">
      <defs>
        <linearGradient id="bd-stone" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#262d35" />
          <stop offset="1" stop-color="#11151a" />
        </linearGradient>
        <filter id="bd-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <ellipse cx="70" cy="110" rx="46" ry="46" fill="#66f2ae" opacity="0.1" filter="url(#bd-blur)" />
      <path
        d="M30 225 L22 120 Q20 60 48 22 Q70 4 92 20 Q120 55 118 120 L112 225 Z"
        fill="url(#bd-stone)"
        stroke="#303942"
        stroke-width="1.5"
      />
      <g fill="none" stroke="#66f2ae" stroke-width="3" stroke-linecap="round">
        <g filter="url(#bd-soft)" opacity="0.9"><path [attr.d]="spiral" transform="translate(68 102)" /></g>
        <path [attr.d]="spiral" transform="translate(68 102)" />
      </g>
      <path d="M96 30 Q106 52 104 76" stroke="#8a6a4a" stroke-width="1.5" fill="none" />
      <path d="M104 76 q7 11 0 28 q-7 -17 0 -28 z" fill="#c98a4b" opacity="0.85" />
      <path d="M99 64 q6 9 -1 23 q-5 -14 1 -23 z" fill="#8f5f34" opacity="0.85" />
    </svg>

    <!-- Slow-drifting spirit mist -->
    <div class="fog low"></div>
    <div class="fog mid"></div>

    <!-- Drifting spirit motes -->
    @for (m of motes; track $index) {
      <span
        class="mote"
        [style.left.%]="m.left"
        [style.width.px]="m.size"
        [style.height.px]="m.size"
        [style.background]="m.color"
        [style.box-shadow]="'0 0 ' + m.size * 3 + 'px ' + m.color"
        [style.animation-duration.s]="m.duration"
        [style.animation-delay.s]="m.delay"
        [style.--drift]="m.drift + 'px'"
      ></span>
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
    svg {
      position: absolute;
    }
    .runes {
      top: 50%;
      left: 50%;
      width: min(75vmin, 720px);
      height: min(75vmin, 720px);
      margin: calc(min(75vmin, 720px) / -2) 0 0 calc(min(75vmin, 720px) / -2);
      color: #66f2ae;
      opacity: 0.04;
      animation: spin 360s linear infinite;
    }
    .shrooms {
      left: 0;
      bottom: 0;
      width: 240px;
      opacity: 0.6;
    }
    .stone {
      right: 18px;
      bottom: 0;
      width: 120px;
      opacity: 0.5;
    }
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
        radial-gradient(ellipse 35% 55% at 28% 70%, rgb(102 242 174 / 0.08), transparent 70%),
        radial-gradient(ellipse 30% 45% at 72% 80%, rgb(102 242 174 / 0.06), transparent 70%),
        radial-gradient(ellipse 25% 40% at 50% 95%, rgb(102 242 174 / 0.05), transparent 70%);
    }
    .fog.mid {
      top: 30%;
      height: 360px;
      animation-duration: 65s;
      animation-direction: alternate-reverse;
      background:
        radial-gradient(ellipse 28% 38% at 18% 50%, rgb(102 242 174 / 0.045), transparent 70%),
        radial-gradient(ellipse 24% 32% at 84% 40%, rgb(150 120 230 / 0.04), transparent 70%);
    }
    @keyframes fog-drift {
      from { transform: translateX(-4%); }
      to { transform: translateX(4%); }
    }
    .mote {
      position: absolute;
      top: 100%;
      border-radius: 50%;
      opacity: 0;
      animation: rise linear infinite;
    }
    @keyframes rise {
      0% { transform: translate(0, 0); opacity: 0; }
      10% { opacity: 0.7; }
      50% { transform: translate(var(--drift), -55vh); }
      85% { opacity: 0.5; }
      100% { transform: translate(0, -105vh); opacity: 0; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    /* Spirit theme: the spirit art glows a little stronger. */
    :host-context([data-theme='spirit']) .runes { opacity: 0.065; }
    :host-context([data-theme='spirit']) .stone { opacity: 0.65; }
    :host-context([data-theme='spirit']) .shrooms { opacity: 0.75; }
    @media (prefers-reduced-motion: reduce) {
      .runes, .fog { animation: none; }
      .mote { display: none; }
    }
  `,
})
export class Backdrop {
  protected readonly spiral = SPIRAL;

  /** Three ancestor marks evenly spaced around the circle. */
  protected readonly ancestorMarks = [90, 210, 330].map((deg) => {
    const r = (deg * Math.PI) / 180;
    return { x: Math.cos(r) * 132, y: -Math.sin(r) * 132 };
  });

  protected readonly motes: Mote[] = Array.from({ length: 14 }, () => ({
    left: Math.random() * 100,
    size: 2 + Math.random() * 2.5,
    duration: 18 + Math.random() * 16,
    delay: -Math.random() * 30,
    drift: (Math.random() - 0.5) * 80,
    color: Math.random() < 0.7 ? '#66f2ae' : '#ffc933',
  }));
}

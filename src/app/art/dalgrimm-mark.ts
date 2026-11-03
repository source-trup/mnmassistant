import { Component } from '@angular/core';

/** Dalgrimm's glowing eyes peering out of the dark, used as the app's logo. Blinks now and then. */
@Component({
  selector: 'app-dalgrimm-mark',
  template: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="dg-eye" cx="0.45" cy="0.42" r="0.6">
          <stop offset="0" stop-color="#fff6b0" />
          <stop offset="0.55" stop-color="#ffd84a" />
          <stop offset="1" stop-color="#d99a1c" />
        </radialGradient>
        <filter id="dg-glow" x="-150%" y="-80%" width="400%" height="260%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>
      <g class="eyes">
        <g class="halo" filter="url(#dg-glow)" fill="#ffc933">
          <ellipse cx="21" cy="32" rx="8" ry="15" />
          <ellipse cx="43" cy="32" rx="8" ry="15" />
        </g>
        <ellipse cx="21" cy="32" rx="7" ry="14" fill="url(#dg-eye)" />
        <ellipse cx="43" cy="32" rx="7" ry="14" fill="url(#dg-eye)" />
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      width: 40px;
      height: 40px;
      flex: none;
    }
    svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .halo {
      opacity: 0.75;
      animation: glow 5s ease-in-out infinite;
    }
    .eyes {
      transform-box: fill-box;
      transform-origin: center;
      animation: blink 7s infinite;
    }
    @keyframes blink {
      0%, 94%, 100% { transform: scaleY(1); }
      96% { transform: scaleY(0.08); }
    }
    @keyframes glow {
      50% { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .eyes, .halo { animation: none; }
    }
  `,
})
export class DalgrimmMark {}

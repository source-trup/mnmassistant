/**
 * Class themes. Each Monsters & Memories class gets a palette (taken from the class concept art), a glyph (used for
 * the background sigil, the panel watermark and the theme picker), a corner prop, and ambient particles.
 *
 * Colors: a theme sets a handful of base colors as CSS variables; styles.scss derives every other color from them
 * (borders, soft fills, glows...). `overrides` can pin any derived variable when a theme needs an exact value.
 */

export type ThemeId =
  | 'shaman'
  | 'monk'
  | 'beastmaster'
  | 'spellblade'
  | 'elementalist'
  | 'enchanter'
  | 'druid'
  | 'necromancer'
  | 'wizard'
  | 'bard'
  | 'rogue'
  | 'archer'
  | 'ranger'
  | 'shadowknight'
  | 'inquisitor'
  | 'fighter'
  | 'cleric'
  | 'paladin'
  | 'classic';

export const DEFAULT_THEME: ThemeId = 'shaman';

/** How the ambient particles move. */
export type MoteKind = 'rise' | 'ember' | 'fall' | 'leaf' | 'note' | 'twinkle';

interface Palette {
  /** Page background (edges) and its lighter center. */
  bg: string;
  bgCenter: string;
  /** Toolbar, panels and dialogs are built from this. */
  surface: string;
  text: string;
  /** Titles and headings. */
  bone: string;
  muted: string;
  /** The theme's main color (buttons, borders, glows, counters). */
  accent: string;
  /** Running timers and secondary highlights. */
  accent2: string;
  /** Named spawns / goals. */
  named: string;
}

export interface CornerArt {
  /** SVG markup (a full <svg> element). */
  svg: string;
  width: number;
}

export interface ThemeDef {
  id: ThemeId;
  label: string;
  /** One line shown in the theme picker. */
  blurb: string;
  colors: Palette;
  /** Exact values for derived CSS variables (without the leading --). */
  overrides?: Record<string, string>;
  /** Glyph path in a -24..24 box, drawn as a stroke. */
  glyph: string;
  left?: CornerArt;
  right?: CornerArt;
  motes: { kind: MoteKind; colors: string[]; count: number };
  /** Tint for the second (upper) mist layer. */
  mist: string;
}

// ---------------------------------------------------------------------------------------------------------------
// Glyphs (stroke paths in a -24..24 box)

const G = {
  spiral: 'M0 0 a4 4 0 0 1 8 0 a8 8 0 0 1 -16 0 a12 12 0 0 1 24 0 a16 16 0 0 1 -32 0 a20 20 0 0 1 40 0',
  // An open ensō brush circle around a small lotus.
  enso:
    'M15 -13 A20 20 0 1 0 20 1 ' +
    'M0 8 Q-5 0 0 -9 Q5 0 0 8 Z M-1.5 8 Q-11 5 -11 -3 Q-4 -1 -1.5 8 Z M1.5 8 Q11 5 11 -3 Q4 -1 1.5 8 Z ' +
    'M-12 10.5 Q0 14 12 10.5',
  paw:
    'M-9 8 a9 7.5 0 1 0 18 0 a9 7.5 0 1 0 -18 0 M-15.5 -5 a3.5 4.5 0 1 0 7 0 a3.5 4.5 0 1 0 -7 0 ' +
    'M-7.5 -13 a3.5 4.5 0 1 0 7 0 a3.5 4.5 0 1 0 -7 0 M0.5 -13 a3.5 4.5 0 1 0 7 0 a3.5 4.5 0 1 0 -7 0 ' +
    'M8.5 -5 a3.5 4.5 0 1 0 7 0 a3.5 4.5 0 1 0 -7 0',
  blade: 'M0 -22 L3.5 -16 V8 H-3.5 V-16 Z M-9 8 H9 M0 8 V17 M0 20 a2.5 2.5 0 1 0 0.1 0 M-17 -4 Q-12 -14 -4 -16 M17 -4 Q12 -14 4 -16',
  elements:
    'M0 -21 L7 -9 H-7 Z M0 21 L-7 9 H7 Z M-21 0 L-9 -7 V7 Z M21 0 L9 7 V-7 Z M-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0',
  eye: 'M-21 0 Q0 -17 21 0 Q0 17 -21 0 Z M-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M-2.5 0 a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0 M-10 -21 V-11 M10 -21 V-11 M0 -23 V-13',
  moon: 'M4 -19 A19 19 0 1 0 4 19 A15 15 0 1 1 4 -19 Z M7 6 Q15 -2 19 -14 Q8 -9 7 6 Z',
  skull:
    'M-13 4 A14 14 0 1 1 13 4 V10 H7 V15 H-7 V10 H-13 Z M-8 -2 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 ' +
    'M1.6 -2 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 M0 4 L-2 8 H2 Z M-3 10 V15 M3 10 V15',
  hexagram: 'M0 -20 L17.3 10 H-17.3 Z M0 20 L-17.3 -10 H17.3 Z M-21 0 a21 21 0 1 0 42 0 a21 21 0 1 0 -42 0',
  notes:
    'M-15 14 a5 4 0 1 0 10 0 a5 4 0 1 0 -10 0 M4 10 a5 4 0 1 0 10 0 a5 4 0 1 0 -10 0 M-5 14 V-13 M14 10 V-17 ' +
    'M-5 -13 L14 -17 M-5 -7 L14 -11',
  daggers: 'M-17 -17 L9 9 M17 -17 L-9 9 M5 13 L13 5 M-5 13 L-13 5 M9 9 L16 16 M-9 9 L-16 16',
  target: 'M-18 0 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0 M-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 M-22 22 L0 0 M0 0 L-8 0 M0 0 L0 8 M-22 22 l-1 -6 M-22 22 l6 1',
  compass: 'M0 -21 L5 -5 L21 0 L5 5 L0 21 L-5 5 L-21 0 L-5 -5 Z M0 -5 L0 5 M-5 0 L5 0',
  helm:
    'M-12 -5 Q-12 -16 0 -16 Q12 -16 12 -5 V12 L0 19 L-12 12 Z M-8 1 H8 M0 1 V11 ' +
    'M-12 -8 Q-22 -11 -20 -23 M12 -8 Q22 -11 20 -23',
  ward: 'M-19 0 a19 19 0 1 0 38 0 a19 19 0 1 0 -38 0 M-13.5 -13.5 L13.5 13.5 M0 -6 L5 0 L0 6 L-5 0 Z',
  shield: 'M-12 -14 H12 V0 Q12 12 0 18 Q-12 12 -12 0 Z M-21 -21 L-14 -14 M21 -21 L14 -14 M14 14 L21 21 M-14 14 L-21 21 M0 -14 V18',
  sun:
    'M-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M0 -21 V-12 M0 12 V21 M-21 0 H-12 M12 0 H21 ' +
    'M-15 -15 L-9 -9 M15 15 L9 9 M15 -15 L9 -9 M-15 15 L-9 9',
  wings:
    'M-7 -9 H7 V0 Q7 8 0 12 Q-7 8 -7 0 Z M-9 -5 Q-20 -14 -23 -1 Q-18 -4 -16 2 Q-13 -2 -9 1 ' +
    'M9 -5 Q20 -14 23 -1 Q18 -4 16 2 Q13 -2 9 1 M0 -5 V8 M-4 -1 H4',
};

// ---------------------------------------------------------------------------------------------------------------
// Corner art. Every prop sits on the bottom edge; `glow` puts a soft pool of the accent color behind it.

function svg(viewBox: string, body: string, id: string): string {
  return (
    `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg"><defs>` +
    `<filter id="${id}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>` +
    `<filter id="${id}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>` +
    `</defs>${body}</svg>`
  );
}

const glow = (id: string, cx: number, cy: number, r: number, color: string, op = 0.14) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.8}" fill="${color}" opacity="${op}" filter="url(#${id}-blur)"/>`;

/** A stroked shape drawn twice: blurred underneath for a glow, crisp on top. */
const glowStroke = (id: string, d: string, color: string, w = 3) =>
  `<g fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">` +
  `<path d="${d}" filter="url(#${id}-soft)" opacity="0.9"/><path d="${d}"/></g>`;

const SHAMAN_SHROOMS = svg(
  '0 0 220 170',
  `<defs><radialGradient id="sh-teal" cx="0.5" cy="0.7" r="0.7"><stop offset="0" stop-color="#d2ffe6"/><stop offset="0.45" stop-color="#4fdc96"/><stop offset="1" stop-color="#11523a"/></radialGradient>
   <radialGradient id="sh-violet" cx="0.5" cy="0.7" r="0.7"><stop offset="0" stop-color="#ecd2ff"/><stop offset="0.45" stop-color="#9a62d8"/><stop offset="1" stop-color="#3a1f5c"/></radialGradient></defs>
   ${glow('sh', 85, 115, 90, '#66f2ae')}
   <path d="M0 170 Q40 150 90 155 T220 160 V170 Z" fill="#0f1317"/>
   <g fill="#cfdcd5" opacity="0.55"><path d="M70 160 Q66 120 74 92 L86 92 Q90 125 88 160 Z"/><path d="M30 162 Q28 140 33 128 L39 128 Q41 145 40 162 Z"/><path d="M132 160 Q134 135 128 118 L138 116 Q142 138 142 160 Z"/><path d="M166 160 L166 150 L170 150 L171 160 Z"/></g>
   <path d="M44 96 Q80 48 118 96 Q80 104 44 96 Z" fill="url(#sh-teal)"/><path d="M18 131 Q36 106 54 131 Q36 135 18 131 Z" fill="url(#sh-teal)"/>
   <path d="M112 122 Q134 86 160 114 Q136 126 112 122 Z" fill="url(#sh-violet)"/><path d="M158 152 Q168 138 178 152 Q168 154 158 152 Z" fill="url(#sh-teal)"/>
   <g fill="#effffc" opacity="0.65"><circle cx="70" cy="82" r="3"/><circle cx="88" cy="76" r="2.4"/><circle cx="101" cy="87" r="2.8"/><circle cx="132" cy="106" r="2"/><circle cx="34" cy="122" r="1.8"/></g>`,
  'sh',
);

const SHAMAN_STONE = svg(
  '0 0 140 230',
  `<defs><linearGradient id="st-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#262d35"/><stop offset="1" stop-color="#11151a"/></linearGradient></defs>
   ${glow('st', 70, 110, 46, '#66f2ae', 0.1)}
   <path d="M30 225 L22 120 Q20 60 48 22 Q70 4 92 20 Q120 55 118 120 L112 225 Z" fill="url(#st-g)" stroke="#303942" stroke-width="1.5"/>
   <g transform="translate(68 102)">${glowStroke('st', G.spiral, '#66f2ae')}</g>
   <path d="M96 30 Q106 52 104 76" stroke="#8a6a4a" stroke-width="1.5" fill="none"/>
   <path d="M104 76 q7 11 0 28 q-7 -17 0 -28 z" fill="#c98a4b" opacity="0.85"/><path d="M99 64 q6 9 -1 23 q-5 -14 1 -23 z" fill="#8f5f34" opacity="0.85"/>`,
  'st',
);

function corners(t: Omit<ThemeDef, 'left' | 'right'>): Pick<ThemeDef, 'left' | 'right'> {
  const c = t.colors;
  const a = c.accent;
  const a2 = c.accent2;
  const n = c.named;
  const id = t.id.slice(0, 3);
  const ground = (y = 222) => `<ellipse cx="70" cy="${y + 6}" rx="62" ry="10" fill="#000" opacity="0.35"/>`;
  switch (t.id) {
    case 'shaman':
    case 'classic':
      return { left: { svg: SHAMAN_SHROOMS, width: 240 }, right: { svg: SHAMAN_STONE, width: 120 } };

    case 'monk': // a balanced cairn with a curl of incense
      return {
        right: {
          width: 120,
          svg: svg(
            '0 0 140 230',
            `${glow(id, 70, 140, 50, a)}${ground()}
             <ellipse cx="70" cy="212" rx="48" ry="16" fill="#2c251c"/><ellipse cx="70" cy="186" rx="36" ry="14" fill="#352c21"/>
             <ellipse cx="72" cy="163" rx="26" ry="11" fill="#3d3326"/><ellipse cx="69" cy="144" rx="17" ry="8" fill="#463a2c"/>
             <path d="M69 136 V120" stroke="#6b4a2a" stroke-width="2"/><circle cx="69" cy="119" r="2" fill="${a2}"/>
             ${glowStroke(id, 'M69 116 C58 98 80 88 70 70 C60 52 84 42 72 22', a, 2)}`,
            id,
          ),
        },
      };

    case 'beastmaster': // claw marks raked into a boulder, and an old bone
      return {
        right: {
          width: 130,
          svg: svg(
            '0 0 140 230',
            `${glow(id, 70, 175, 55, a)}
             <path d="M6 230 Q10 150 58 138 Q112 126 134 230 Z" fill="#2a2118" stroke="#3a2e22" stroke-width="1.5"/>
             ${glowStroke(id, 'M48 156 Q60 182 54 214 M68 150 Q82 178 76 212 M88 152 Q102 176 98 206', a, 5)}
             <g fill="${c.bone}" opacity="0.55"><rect x="22" y="219" width="40" height="5" rx="2"/><circle cx="21" cy="219" r="4"/><circle cx="21" cy="225" r="4"/><circle cx="63" cy="219" r="4"/><circle cx="63" cy="225" r="4"/></g>`,
            id,
          ),
        },
      };

    case 'spellblade': // a sword planted in the ground, its blade humming with magic
      return {
        right: {
          width: 110,
          svg: svg(
            '0 0 140 230',
            `${glow(id, 70, 140, 50, a, 0.18)}${ground(214)}
             <path d="M65 70 H75 V200 L70 214 L65 200 Z" fill="${a}" opacity="0.35" filter="url(#${id}-soft)"/>
             <path d="M66 70 H74 V200 L70 212 L66 200 Z" fill="${a}" opacity="0.75"/>
             <path d="M70 72 V204" stroke="#fff" stroke-width="1" opacity="0.6"/>
             <rect x="46" y="62" width="48" height="8" rx="2" fill="#2b3550"/><rect x="66" y="34" width="8" height="28" fill="#3a2a22"/>
             <circle cx="70" cy="29" r="7" fill="#2b3550" stroke="${a2}" stroke-width="2"/>
             ${glowStroke(id, 'M30 120 q10 -10 20 0 M96 96 q10 -10 20 0 M24 170 q8 -8 16 0', a2, 2)}`,
            id,
          ),
        },
      };

    case 'elementalist': // a brazier of living flame, with a droplet and a stone in orbit
      return {
        right: {
          width: 120,
          svg: svg(
            '0 0 140 230',
            `${glow(id, 70, 120, 60, a, 0.22)}${ground()}
             <path d="M48 228 L60 182 M92 228 L80 182 M70 228 V184" stroke="#4a2e22" stroke-width="5" stroke-linecap="round"/>
             <path d="M36 150 H104 Q100 182 70 186 Q40 182 36 150 Z" fill="#3a2219" stroke="#5a3424" stroke-width="2"/>
             <path d="M70 62 C92 96 102 118 88 150 H52 C38 118 48 96 70 62 Z" fill="${a}" opacity="0.85"/>
             <path d="M70 98 C82 116 84 130 77 150 H63 C56 130 58 116 70 98 Z" fill="${n}"/>
             <path d="M24 92 q6 9 0 14 q-6 -5 0 -14 z" fill="${a2}" opacity="0.85"/>
             <path d="M112 70 l9 3 l2 8 l-8 4 l-7 -6 z" fill="#7a6a58"/>
             <path d="M18 132 q12 -8 24 0 M100 112 q10 -7 22 0" fill="none" stroke="${c.bone}" stroke-width="1.5" opacity="0.4"/>`,
            id,
          ),
        },
      };

    case 'enchanter': // a crystal hanging from puppet strings above a pedestal
      return {
        right: {
          width: 110,
          svg: svg(
            '0 0 140 230',
            `${glow(id, 70, 120, 52, a, 0.18)}${ground()}
             <path d="M48 228 L54 198 H86 L92 228 Z" fill="#1d2433" stroke="#2c3550" stroke-width="1.5"/>
             <g stroke="${c.bone}" stroke-width="0.8" opacity="0.4"><path d="M60 0 V76 M80 0 V76 M70 0 V66"/></g>
             <path d="M70 66 L90 112 L70 168 L50 112 Z" fill="${a}" opacity="0.35" filter="url(#${id}-soft)"/>
             <path d="M70 68 L88 112 L70 164 L52 112 Z" fill="${a}" opacity="0.45" stroke="${a}" stroke-width="1.5"/>
             <path d="M70 68 V164 M52 112 H88" stroke="#fff" stroke-width="0.8" opacity="0.5"/>
             <ellipse cx="70" cy="116" rx="46" ry="12" fill="none" stroke="${a2}" stroke-width="1.5" stroke-dasharray="3 6" opacity="0.8"/>`,
            id,
          ),
        },
      };

    case 'druid': // ferns on the left; a twisted staff crowned with a crescent moon on the right
      return {
        left: {
          width: 200,
          svg: svg(
            '0 0 200 160',
            `${glow(id, 80, 120, 80, a)}
             <path d="M0 160 Q50 142 100 148 T200 152 V160 Z" fill="#141a0e"/>
             <g fill="none" stroke="${a}" stroke-width="3" stroke-linecap="round" opacity="0.75">
               <path d="M40 156 Q30 110 52 70"/><path d="M60 156 Q66 112 98 88"/><path d="M84 156 Q104 120 140 112"/><path d="M28 156 Q10 128 8 100"/></g>
             <g fill="${a}" opacity="0.6">
               <ellipse cx="44" cy="100" rx="9" ry="3.5" transform="rotate(-60 44 100)"/><ellipse cx="50" cy="80" rx="8" ry="3" transform="rotate(-50 50 80)"/>
               <ellipse cx="74" cy="112" rx="9" ry="3.5" transform="rotate(-35 74 112)"/><ellipse cx="88" cy="96" rx="8" ry="3" transform="rotate(-30 88 96)"/>
               <ellipse cx="110" cy="124" rx="9" ry="3.5" transform="rotate(-15 110 124)"/><ellipse cx="128" cy="114" rx="8" ry="3" transform="rotate(-10 128 114)"/>
               <ellipse cx="16" cy="118" rx="8" ry="3" transform="rotate(-110 16 118)"/></g>`,
            id,
          ),
        },
        right: {
          width: 100,
          svg: svg(
            '0 0 140 230',
            `${glow(id, 74, 50, 40, n, 0.2)}${ground()}
             <path d="M74 228 C66 182 82 142 70 104 C62 80 78 64 72 50" fill="none" stroke="#5a4630" stroke-width="6" stroke-linecap="round"/>
             <path d="M78 18 A16 16 0 1 0 78 50 A12.5 12.5 0 1 1 78 18 Z" fill="${n}" opacity="0.9"/>
             <g fill="${a}" opacity="0.8"><ellipse cx="62" cy="120" rx="9" ry="3.5" transform="rotate(-30 62 120)"/><ellipse cx="80" cy="150" rx="9" ry="3.5" transform="rotate(25 80 150)"/></g>`,
            id,
          ),
        },
      };

    case 'necromancer': // a pile of bones; a gravestone with a glowing rune
      return {
        left: {
          width: 170,
          svg: svg(
            '0 0 180 130',
            `${glow(id, 80, 100, 60, a2, 0.12)}
             <path d="M0 130 Q60 112 120 118 T180 122 V130 Z" fill="#141016"/>
             <g fill="${c.bone}" opacity="0.5">
               <path d="M60 116 A20 20 0 1 1 100 116 V122 H60 Z"/>
               <rect x="20" y="118" width="60" height="5" rx="2" transform="rotate(-12 50 120)"/><rect x="96" y="114" width="56" height="5" rx="2" transform="rotate(14 124 116)"/></g>
             <g fill="#141016"><circle cx="72" cy="106" r="5"/><circle cx="88" cy="106" r="5"/></g>`,
            id,
          ),
        },
        right: {
          width: 110,
          svg: svg(
            '0 0 140 230',
            `${glow(id, 70, 140, 50, a2, 0.14)}${ground()}
             <path d="M32 228 V122 Q32 80 70 80 Q108 80 108 122 V228 Z" fill="#1d1820" stroke="#2c2530" stroke-width="2"/>
             <g transform="translate(70 140) scale(1.25)">${glowStroke(id, G.skull, a2, 2)}</g>
             <path d="M44 100 L52 96 M90 214 l8 -4" stroke="#2c2530" stroke-width="2"/>`,
            id,
          ),
        },
      };

    case 'wizard': // a tall staff with a burning tip and drifting glyphs
      return {
        right: {
          width: 110,
          svg: svg(
            '0 0 140 230',
            `${glow(id, 74, 50, 40, a2, 0.22)}${ground()}
             <path d="M76 228 L70 66 C60 58 62 40 76 40" fill="none" stroke="#5a4632" stroke-width="5" stroke-linecap="round"/>
             <path d="M78 10 C88 24 88 34 80 44 H72 C66 34 68 24 78 10 Z" fill="${a2}"/>
             <path d="M78 26 C82 32 82 38 79 44 H75 C73 38 74 32 78 26 Z" fill="#fff4cf"/>
             <g transform="translate(34 110) scale(0.6)">${glowStroke(id, G.hexagram, a, 2.5)}</g>
             <g transform="translate(108 150) scale(0.45)">${glowStroke(id, G.sun, a, 2.5)}</g>`,
            id,
          ),
        },
      };

    case 'bard': // a lute leaning on the edge, with a red feather
      return {
        right: {
          width: 120,
          svg: svg(
            '0 0 140 230',
            `${glow(id, 70, 160, 55, a)}${ground()}
             <g transform="rotate(-16 70 170)">
               <rect x="64" y="40" width="12" height="96" rx="3" fill="#4a3420"/>
               <path d="M64 42 L60 22 H80 L76 42 Z" fill="#3a2818"/>
               <ellipse cx="70" cy="172" rx="36" ry="46" fill="#7a5530" stroke="#9a7040" stroke-width="2"/>
               <circle cx="70" cy="160" r="9" fill="#2a1c10"/>
               <g stroke="${c.bone}" stroke-width="0.8" opacity="0.6"><path d="M67 40 V206 M70 40 V206 M73 40 V206"/></g>
               <rect x="56" y="198" width="28" height="5" rx="2" fill="#3a2818"/></g>
             <path d="M112 226 C104 190 112 160 128 136 C126 166 124 196 112 226 Z" fill="${n}" opacity="0.85"/>
             <path d="M112 226 C116 196 122 166 128 136" stroke="#5a1e16" stroke-width="1" fill="none"/>`,
            id,
          ),
        },
      };

    case 'rogue': // throwing knives in a post, and a vial of poison
      return {
        right: {
          width: 110,
          svg: svg(
            '0 0 140 230',
            `${ground()}
             <rect x="54" y="90" width="30" height="140" fill="#24221f" stroke="#302d29" stroke-width="1.5"/>
             <g fill="${a2}"><path d="M20 120 L58 126 L58 130 Z"/><path d="M14 152 L58 152 L58 156 Z"/><path d="M24 186 L58 180 L58 184 Z"/></g>
             <g fill="#1a1816"><rect x="8" y="117" width="14" height="5" rx="2" transform="rotate(9 15 120)"/><rect x="2" y="151" width="14" height="5" rx="2"/><rect x="12" y="186" width="14" height="5" rx="2" transform="rotate(-9 19 188)"/></g>
             ${glow(id, 110, 210, 22, a, 0.3)}
             <path d="M104 196 h12 v6 q10 6 10 16 q0 10 -16 10 q-16 0 -16 -10 q0 -10 10 -16 z" fill="#1d2620" stroke="#3a4a3e" stroke-width="1.5"/>
             <path d="M96 214 q14 -4 28 0 q0 12 -14 12 q-14 0 -14 -12 z" fill="${a}" opacity="0.8"/>`,
            id,
          ),
        },
      };

    case 'archer': // a quiver of fletched arrows
      return {
        right: {
          width: 110,
          svg: svg(
            '0 0 140 230',
            `${glow(id, 70, 150, 50, a)}${ground()}
             <g stroke="#8a6a48" stroke-width="2.5"><path d="M64 120 L54 30 M74 118 L72 22 M84 120 L94 34"/></g>
             <g fill="${a}"><path d="M54 30 l-6 -6 l2 12 z M54 30 l6 -6 l-2 12 z"/><path d="M72 22 l-6 -6 l2 12 z M72 22 l6 -6 l-2 12 z"/><path d="M94 34 l-6 -6 l2 12 z M94 34 l6 -6 l-2 12 z"/></g>
             <path d="M46 116 L94 110 L104 222 L58 228 Z" fill="#5a3a22" stroke="#7a5030" stroke-width="2"/>
             <path d="M50 140 L98 134 M54 190 L102 184" stroke="${n}" stroke-width="3" opacity="0.7"/>`,
            id,
          ),
        },
      };

    case 'ranger': { // pine trees on both sides
      const pine = (x: number, s: number, fill: string) =>
        `<g transform="translate(${x} ${230 - 210 * s}) scale(${s})"><path d="M0 0 L25 50 H12 L35 95 H18 L42 145 H-42 L-18 95 H-35 L-12 50 H-25 Z" fill="${fill}"/><rect x="-5" y="145" width="10" height="65" fill="#2a2016"/></g>`;
      return {
        left: {
          width: 170,
          svg: svg('0 0 180 230', `${glow(id, 90, 190, 70, a, 0.1)}${pine(50, 0.8, '#15211a')}${pine(110, 0.6, '#1b2a1f')}`, id),
        },
        right: {
          width: 130,
          svg: svg(
            '0 0 140 230',
            `${glow(id, 70, 190, 60, a, 0.12)}${pine(80, 1, '#17241a')}${pine(30, 0.55, '#1e2d21')}
             <path d="M80 6 L105 56" stroke="${a}" stroke-width="1.5" opacity="0.35"/>`,
            id,
          ),
        },
      };
    }

    case 'shadowknight': // a jagged black greatsword planted in the ground, bleeding red light
      return {
        right: {
          width: 110,
          svg: svg(
            '0 0 140 230',
            `${glow(id, 70, 200, 55, a, 0.25)}${ground(214)}
             <path d="M62 72 L78 72 L76 96 L82 104 L74 120 L80 132 L74 150 L78 166 L72 186 L70 214 L66 186 L60 166 L64 150 L58 132 L64 120 L56 104 L62 96 Z" fill="#1c191e" stroke="${a}" stroke-width="1.5"/>
             <path d="M70 76 V206" stroke="${a}" stroke-width="1" opacity="0.6" filter="url(#${id}-soft)"/>
             <path d="M38 66 L56 70 H84 L102 66 L96 76 H44 Z" fill="#2a262c"/>
             <rect x="66" y="40" width="8" height="26" fill="#2a1e1e"/>
             <g transform="translate(70 30) scale(0.45)"><path d="${G.skull}" fill="#2a262c" stroke="${a}" stroke-width="2.5"/></g>`,
            id,
          ),
        },
      };

    case 'inquisitor': // a lectern with a tome and a violet gem
      return {
        right: {
          width: 120,
          svg: svg(
            '0 0 140 230',
            `${glow(id, 70, 120, 48, a, 0.2)}${ground()}
             <path d="M54 228 L62 150 H78 L86 228 Z" fill="#221a2e" stroke="#332745" stroke-width="1.5"/>
             <path d="M26 136 L70 148 L114 136 L114 116 L70 128 L26 116 Z" fill="#3a2a52" stroke="#4d3a6a" stroke-width="1.5"/>
             <path d="M30 118 L70 130 L110 118 L110 112 L70 124 L30 112 Z" fill="${c.bone}" opacity="0.7"/>
             <path d="M70 92 L80 106 L70 120 L60 106 Z" fill="${a}" opacity="0.4" filter="url(#${id}-soft)"/>
             <path d="M70 94 L78 106 L70 118 L62 106 Z" fill="${a}"/>
             <path d="M70 94 L74 106 L70 118" fill="#fff" opacity="0.35"/>`,
            id,
          ),
        },
      };

    case 'fighter': // a round shield with a sword and a mace crossed behind it
      return {
        right: {
          width: 120,
          svg: svg(
            '0 0 140 230',
            `${glow(id, 70, 160, 55, a)}${ground()}
             <path d="M24 60 L118 226" stroke="${a2}" stroke-width="5"/><path d="M14 54 l14 -4 l-4 14 z" fill="${a2}"/>
             <path d="M116 60 L22 226" stroke="#5a4030" stroke-width="5"/>
             <circle cx="116" cy="58" r="10" fill="#3a3230" stroke="${a2}" stroke-width="2"/>
             <circle cx="70" cy="168" r="44" fill="#3a2e26" stroke="${a}" stroke-width="5"/>
             <circle cx="70" cy="168" r="30" fill="none" stroke="#2a221c" stroke-width="2"/>
             <circle cx="70" cy="168" r="10" fill="${a2}"/>`,
            id,
          ),
        },
      };

    case 'cleric': // a chalice shining with holy light
      return {
        right: {
          width: 110,
          svg: svg(
            '0 0 140 230',
            `${glow(id, 70, 100, 60, a, 0.22)}${ground()}
             <g stroke="${a}" stroke-width="2" opacity="0.45"><path d="M70 30 V60 M40 44 L52 66 M100 44 L88 66 M24 74 L46 84 M116 74 L94 84"/></g>
             <path d="M44 96 H96 Q94 140 70 146 Q46 140 44 96 Z" fill="${a}" stroke="#fff4d0" stroke-width="1.5"/>
             <rect x="66" y="146" width="8" height="52" fill="${a}" opacity="0.85"/>
             <ellipse cx="70" cy="204" rx="26" ry="8" fill="${a}"/>
             <path d="M52 104 Q70 110 88 104" stroke="#fff" stroke-width="2" fill="none" opacity="0.5"/>`,
            id,
          ),
        },
      };

    case 'paladin': // a winged golden shield
      return {
        right: {
          width: 130,
          svg: svg(
            '0 0 140 230',
            `<defs><linearGradient id="pal-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset="1" stop-color="${a}"/></linearGradient></defs>
             ${glow(id, 70, 150, 60, a, 0.22)}${ground()}
             <g fill="${c.bone}" opacity="0.8">
               <path d="M42 126 Q12 108 4 74 Q22 90 32 90 Q14 74 12 52 Q30 74 44 82 Z"/>
               <path d="M98 126 Q128 108 136 74 Q118 90 108 90 Q126 74 128 52 Q110 74 96 82 Z"/></g>
             <path d="M40 110 H100 V160 Q100 200 70 222 Q40 200 40 160 Z" fill="url(#pal-g)" stroke="#fff6d6" stroke-width="2"/>
             <path d="M70 120 V200 M52 146 H88" stroke="#8a6410" stroke-width="5" stroke-linecap="round"/>`,
            id,
          ),
        },
      };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Theme list (Shaman first: the default)

const BASE: Omit<ThemeDef, 'left' | 'right'>[] = [
  {
    id: 'shaman',
    label: 'Shaman',
    blurb: 'Spirits, ancestors and ghosts. Spirit green, the Spirals, glowing cave mushrooms.',
    colors: {
      bg: '#07100d', bgCenter: '#0c1a15', surface: '#0f1f19', text: '#e2f2ea', bone: '#d9fbe9',
      muted: '#84a797', accent: '#66f2ae', accent2: '#6cc4ff', named: '#ffc933',
    },
    overrides: { 'panel-2': '#163128', 'input-bg': '#08130f', 'dialog-bg': '#0e1c17', icon: '#7fc4a3', 'named-bg': '#3a2f10' },
    glyph: G.spiral,
    motes: { kind: 'rise', colors: ['#66f2ae', '#66f2ae', '#66f2ae', '#ffc933'], count: 14 },
    mist: 'rgb(150 120 230 / 0.04)',
  },
  {
    id: 'monk',
    label: 'Monk',
    blurb: 'Discipline and bare fists. Saffron sash, an ensō, a balanced cairn.',
    colors: {
      bg: '#110d08', bgCenter: '#1b150d', surface: '#1d160e', text: '#f0e6d6', bone: '#f7e7c4',
      muted: '#a8977c', accent: '#e8b04a', accent2: '#e07b3c', named: '#e4574a',
    },
    glyph: G.enso,
    motes: { kind: 'rise', colors: ['#e8b04a', '#f7e7c4'], count: 10 },
    mist: 'rgb(232 176 74 / 0.035)',
  },
  {
    id: 'beastmaster',
    label: 'Beastmaster',
    blurb: 'Fur, leather and a bonded beast. Amber and bone, claw-raked stone.',
    colors: {
      bg: '#0f0b07', bgCenter: '#18120b', surface: '#1c150e', text: '#efe4d4', bone: '#ecdcc0',
      muted: '#a39178', accent: '#d99a4e', accent2: '#8fbf6a', named: '#f2e6c8',
    },
    glyph: G.paw,
    motes: { kind: 'twinkle', colors: ['#ffcf6b', '#d99a4e'], count: 12 },
    mist: 'rgb(143 191 106 / 0.03)',
  },
  {
    id: 'spellblade',
    label: 'Spellblade',
    blurb: 'Sword and sorcery. Midnight blue, a humming blade, blink-sparks.',
    colors: {
      bg: '#070b14', bgCenter: '#0c1424', surface: '#0e1728', text: '#e2e9f7', bone: '#d9e6ff',
      muted: '#8696b5', accent: '#6ea8ff', accent2: '#b48cff', named: '#ffd166',
    },
    glyph: G.blade,
    motes: { kind: 'twinkle', colors: ['#6ea8ff', '#b9d4ff', '#b48cff'], count: 16 },
    mist: 'rgb(180 140 255 / 0.04)',
  },
  {
    id: 'elementalist',
    label: 'Elementalist',
    blurb: 'Fire, water, earth and air. Terracotta and flame, a living brazier.',
    colors: {
      bg: '#120806', bgCenter: '#1e0f0a', surface: '#21110b', text: '#f6e6dc', bone: '#ffe2cc',
      muted: '#b08f80', accent: '#ff7a45', accent2: '#4fc3e8', named: '#ffd34d',
    },
    glyph: G.elements,
    motes: { kind: 'ember', colors: ['#ff7a45', '#ffb347', '#ffd34d'], count: 18 },
    mist: 'rgb(79 195 232 / 0.035)',
  },
  {
    id: 'enchanter',
    label: 'Enchanter',
    blurb: 'Perception bent and minds enthralled. Mint and violet, a crystal on strings.',
    colors: {
      bg: '#0a0d14', bgCenter: '#121827', surface: '#131a28', text: '#e4f6f2', bone: '#dcfff8',
      muted: '#8fa6b0', accent: '#8ff0dc', accent2: '#c39bff', named: '#ffd36b',
    },
    glyph: G.eye,
    motes: { kind: 'twinkle', colors: ['#8ff0dc', '#c39bff', '#ffffff'], count: 18 },
    mist: 'rgb(195 155 255 / 0.05)',
  },
  {
    id: 'druid',
    label: 'Druid',
    blurb: 'Flora, fauna and the seasons. Leaf green, moonlight, falling leaves.',
    colors: {
      bg: '#0a0f07', bgCenter: '#121a0c', surface: '#15200e', text: '#eaf2dc', bone: '#f0f6d8',
      muted: '#9aab84', accent: '#9bd46a', accent2: '#7fd0c8', named: '#f2e39a',
    },
    glyph: G.moon,
    motes: { kind: 'leaf', colors: ['#9bd46a', '#c9b44a', '#d98a3a'], count: 10 },
    mist: 'rgb(242 227 154 / 0.035)',
  },
  {
    id: 'necromancer',
    label: 'Necromancer',
    blurb: 'Death, decay and stolen life. Bone and shadow, a grave-rune, drifting ash.',
    colors: {
      bg: '#0b090c', bgCenter: '#141016', surface: '#171319', text: '#e8e4e0', bone: '#e6dfcf',
      muted: '#948a92', accent: '#cfc6aa', accent2: '#a3d65c', named: '#d64545',
    },
    glyph: G.skull,
    motes: { kind: 'fall', colors: ['#8a8590', '#b0aab4', '#a3d65c'], count: 16 },
    mist: 'rgb(163 214 92 / 0.03)',
  },
  {
    id: 'wizard',
    label: 'Wizard',
    blurb: 'Glyphs and raw arcana. Starlit grey-blue, a burning staff, glyph sparks.',
    colors: {
      bg: '#0a0a12', bgCenter: '#12121f', surface: '#141423', text: '#e6e6f2', bone: '#eceaf8',
      muted: '#9090ad', accent: '#8fa2ff', accent2: '#ffb35c', named: '#ffd86b',
    },
    glyph: G.hexagram,
    motes: { kind: 'twinkle', colors: ['#8fa2ff', '#ffffff', '#ffb35c'], count: 20 },
    mist: 'rgb(143 162 255 / 0.04)',
  },
  {
    id: 'bard',
    label: 'Bard',
    blurb: 'Songs that turn a fight. Bright yellow and blue, a lute, drifting notes.',
    colors: {
      bg: '#0c0a10', bgCenter: '#16121c', surface: '#19141f', text: '#f2ece0', bone: '#fff1c4',
      muted: '#a69c8c', accent: '#ffcf3f', accent2: '#5aa2ff', named: '#ff7a6b',
    },
    glyph: G.notes,
    motes: { kind: 'note', colors: ['#ffcf3f', '#5aa2ff', '#fff1c4'], count: 10 },
    mist: 'rgb(90 162 255 / 0.04)',
  },
  {
    id: 'rogue',
    label: 'Rogue',
    blurb: 'Shadows, poison and throwing knives. Near-black with a poison-green glint.',
    colors: {
      bg: '#070808', bgCenter: '#0e1010', surface: '#111313', text: '#dfe3df', bone: '#e3e8e0',
      muted: '#858c87', accent: '#9be15d', accent2: '#a9b7c4', named: '#ffcf5a',
    },
    glyph: G.daggers,
    motes: { kind: 'fall', colors: ['#3a3f3c', '#4a504c', '#9be15d'], count: 10 },
    mist: 'rgb(0 0 0 / 0.1)',
  },
  {
    id: 'archer',
    label: 'Archer',
    blurb: 'Bows, gadgets and custom arrowheads. Rust and leather, a full quiver.',
    colors: {
      bg: '#0f0a07', bgCenter: '#1a110b', surface: '#1d130c', text: '#f1e4d6', bone: '#f5dfc4',
      muted: '#a8907c', accent: '#e0773e', accent2: '#7fb8d6', named: '#ffd166',
    },
    glyph: G.target,
    motes: { kind: 'rise', colors: ['#e0b48a', '#f5dfc4'], count: 10 },
    mist: 'rgb(127 184 214 / 0.03)',
  },
  {
    id: 'ranger',
    label: 'Ranger',
    blurb: 'Fieldcraft, bow and blade. Forest green, pines and fireflies.',
    colors: {
      bg: '#080d08', bgCenter: '#0f170f', surface: '#121b11', text: '#e4ecdc', bone: '#e9efd7',
      muted: '#8fa18a', accent: '#a3c26a', accent2: '#d1a866', named: '#ffd36b',
    },
    glyph: G.compass,
    motes: { kind: 'twinkle', colors: ['#e8f06b', '#a3c26a'], count: 14 },
    mist: 'rgb(209 168 102 / 0.03)',
  },
  {
    id: 'shadowknight',
    label: 'Shadow Knight',
    blurb: 'Darkness, life drain and bent souls. Black iron bleeding red light.',
    colors: {
      bg: '#0a0708', bgCenter: '#140c0e', surface: '#170f11', text: '#ece2e2', bone: '#e8d8d8',
      muted: '#9a8a8c', accent: '#e04848', accent2: '#8e98a8', named: '#ffb347',
    },
    glyph: G.helm,
    motes: { kind: 'ember', colors: ['#e04848', '#8a1e1e', '#ff7a6b'], count: 14 },
    mist: 'rgb(224 72 72 / 0.035)',
  },
  {
    id: 'inquisitor',
    label: 'Inquisitor',
    blurb: 'Armored enemy of magic. Violet and silver, a warded tome.',
    colors: {
      bg: '#0c0812', bgCenter: '#150f20', surface: '#181124', text: '#ece6f6', bone: '#efe6ff',
      muted: '#9d92b0', accent: '#b07cff', accent2: '#d9d2ea', named: '#ffd36b',
    },
    glyph: G.ward,
    motes: { kind: 'fall', colors: ['#b07cff', '#d9d2ea'], count: 12 },
    mist: 'rgb(176 124 255 / 0.05)',
  },
  {
    id: 'fighter',
    label: 'Fighter',
    blurb: 'Master of every weapon. Bronze and steel, shield and mace, forge sparks.',
    colors: {
      bg: '#0d0b0a', bgCenter: '#171412', surface: '#1a1715', text: '#ebe6e0', bone: '#efe2cf',
      muted: '#9b928a', accent: '#c99b62', accent2: '#a9b6c4', named: '#e2583e',
    },
    glyph: G.shield,
    motes: { kind: 'ember', colors: ['#ffb347', '#ff7a45'], count: 12 },
    mist: 'rgb(169 182 196 / 0.03)',
  },
  {
    id: 'cleric',
    label: 'Cleric',
    blurb: 'Faith, healing and resurrection. Ivory and gold, a shining chalice.',
    colors: {
      bg: '#0e0d0a', bgCenter: '#191712', surface: '#1c1a14', text: '#f6f2e6', bone: '#fffaf0',
      muted: '#aca594', accent: '#f4e3a1', accent2: '#9fd0ff', named: '#ffb454',
    },
    glyph: G.sun,
    motes: { kind: 'rise', colors: ['#fffaf0', '#f4e3a1'], count: 14 },
    mist: 'rgb(255 250 240 / 0.03)',
  },
  {
    id: 'paladin',
    label: 'Paladin',
    blurb: 'Oath, plate and consecrated ground. Gleaming gold, a winged shield.',
    colors: {
      bg: '#0f0c06', bgCenter: '#1b150a', surface: '#1e180b', text: '#f7efd8', bone: '#fff3c4',
      muted: '#b0a17a', accent: '#ffcc40', accent2: '#8fd1ff', named: '#ff8a4c',
    },
    glyph: G.wings,
    motes: { kind: 'rise', colors: ['#ffcc40', '#fff3c4'], count: 14 },
    mist: 'rgb(255 204 64 / 0.035)',
  },
  {
    id: 'classic',
    label: 'Classic',
    blurb: 'The original look: grey cave stone with green accents.',
    colors: {
      bg: '#0b0e12', bgCenter: '#10151b', surface: '#181e25', text: '#e4e6e2', bone: '#efe3c8',
      muted: '#8a939b', accent: '#66f2ae', accent2: '#5ee0a0', named: '#ffc933',
    },
    overrides: {
      panel: 'rgb(21 25 31 / 0.9)', 'panel-2': '#222931', 'button-bg': '#222931', 'input-bg': '#0b0e12',
      'dialog-bg': '#161b21', border: '#2d353f', icon: '#8a939b', 'spirit-soft': 'rgb(102 242 174 / 0.13)',
      'spirit-line': 'rgb(102 242 174 / 0.45)', 'title-glow': 'rgb(255 201 51 / 0.25)', 'card-glow': 'rgb(0 0 0 / 0)',
      watermark: '#efe3c8', 'watermark-opacity': '0.06', 'grid-dot': '#1f262d', 'grid-dot-strong': '#3f4a55',
      'named-bg': '#3a2f10', goal: 'var(--running)', 'glow-a': 'rgb(102 242 174 / 0.07)', 'glow-b': 'rgb(140 90 210 / 0.06)',
    },
    glyph: G.spiral,
    motes: { kind: 'rise', colors: ['#66f2ae', '#66f2ae', '#ffc933'], count: 10 },
    mist: 'rgb(150 120 230 / 0.04)',
  },
];

export const THEMES: ThemeDef[] = BASE.map((t) => ({ ...t, ...corners(t) }));

export function themeById(id: string | null | undefined): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Upgrades theme ids saved by older versions ("spirit" was the Shaman look). */
export function normalizeThemeId(raw: unknown): ThemeId {
  if (raw === 'spirit') return 'shaman';
  return THEMES.some((t) => t.id === raw) ? (raw as ThemeId) : DEFAULT_THEME;
}

/** The glyph as a small standalone SVG, for masks and the picker. */
export function glyphSvg(t: ThemeDef, stroke = 'black', width = 2.5): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -24 48 48"><path d="${t.glyph}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

const BASE_VARS: Record<keyof Palette, string> = {
  bg: 'bg',
  bgCenter: 'bg-center',
  surface: 'surface',
  text: 'text',
  bone: 'bone',
  muted: 'muted',
  accent: 'spirit',
  accent2: 'accent-2',
  named: 'named',
};

let applied: string[] = [];

/** Puts a theme's colors and glyph on <html> as CSS variables (styles.scss derives the rest). */
export function applyTheme(t: ThemeDef): void {
  const style = document.documentElement.style;
  for (const name of applied) style.removeProperty(name);
  const vars: Record<string, string> = {};
  for (const [key, cssName] of Object.entries(BASE_VARS)) vars[`--${cssName}`] = t.colors[key as keyof Palette];
  vars['--mist-2'] = t.mist;
  vars['--watermark-mask'] = `url("data:image/svg+xml,${encodeURIComponent(glyphSvg(t))}")`;
  for (const [k, v] of Object.entries(t.overrides ?? {})) vars[`--${k}`] = v;
  for (const [k, v] of Object.entries(vars)) style.setProperty(k, v);
  applied = Object.keys(vars);
  document.documentElement.setAttribute('data-theme', t.id);
}

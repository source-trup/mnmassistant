/** A checklist line read from typed or pasted text. */
export interface ParsedItem {
  text: string;
  qty: number | null;
  from?: string;
}

const NUM = /^\d+$/;

/**
 * Reads one line like "-18xCopper Ore", "18 x Copper Ore", "Copper Ore x18", "18 Copper Ore", "[x] Wood"
 * or plain "Copper Ore".
 */
export function parseLine(raw: string): ParsedItem | null {
  const line = raw
    .trim()
    .replace(/^(?:[-*•+]|\d+[.)])\s+/, '') // "- ", "* ", "1. "
    .replace(/^[-*•+](?=\d)/, '') // "-18x…"
    .replace(/^\[[ xX✓]?\]\s*/, '') // "[ ]", "[x]"
    .trim();
  if (!line) return null;
  let m = line.match(/^(\d+)\s*[x×]\s*(.+)$/i);
  if (m) return item(m[2], +m[1]);
  m = line.match(/^(.+?)\s*[x×]\s*(\d+)$/i);
  if (m) return item(m[1], +m[2]);
  m = line.match(/^(.+?)\s*\((\d+)\)$/);
  if (m) return item(m[1], +m[2]);
  m = line.match(/^(\d+)\s+(.+)$/);
  if (m) return item(m[2], +m[1]);
  return item(line, null);
}

function item(text: string, qty: number | null): ParsedItem | null {
  const t = text.trim().replace(/\s+/g, ' ');
  return t ? { text: t, qty: qty && qty > 0 ? qty : null } : null;
}

/** True if the text looks like a table copied from the wiki's tradeskill pages (tab separated). */
function isTable(lines: string[]): boolean {
  return lines.some((l) => /^\s*material\s*\t/i.test(l) || /^[^\t]*\t\s*\d+\s*(\t|$)/.test(l));
}

/**
 * Reads the wiki's "Material / Total / From" table. Browsers paste it with the name on its own line(s)
 * and the numbers on the next line:
 *
 *   Whitefish
 *   or Basa or Grouper
 *   \t10\tgathered or bought
 *
 * Rows that arrive on one line ("Copper Ore\t18\tgathered") work too.
 */
function parseTable(lines: string[]): ParsedItem[] {
  const out: ParsedItem[] = [];
  let name: string[] = [];
  const push = (qty: number | null, from: string) => {
    const text = name.join(' ').replace(/\s+or\s+/gi, '/').replace(/\s+/g, ' ').trim();
    name = [];
    if (text) out.push({ text, qty: qty && qty > 0 ? qty : null, ...(from ? { from } : {}) });
  };
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const cells = raw.split('\t').map((c) => c.trim());
    if (/^material$/i.test(cells[0]) && cells.length > 1) continue; // header row
    const first = cells.findIndex((c) => c !== '');
    if (first > 0 || (cells.length > 1 && NUM.test(cells[0]))) {
      // Numbers row for the name collected so far.
      const rest = cells.slice(first).filter((c) => c !== '');
      const qty = NUM.test(rest[0] ?? '') ? +rest[0] : null;
      push(qty, rest.slice(1).join(' '));
    } else if (cells.length > 1 && NUM.test(cells[1] ?? '')) {
      // Whole row on one line.
      if (name.length) push(null, '');
      name = [cells[0]];
      push(+cells[1], cells.slice(2).filter(Boolean).join(' '));
    } else {
      name.push(cells.filter(Boolean).join(' '));
    }
  }
  if (name.length) push(null, '');
  return out;
}

/** Turns typed or pasted text into checklist items (one per line, or the wiki table format). */
export function parseChecklist(text: string): ParsedItem[] {
  const lines = text.replace(/\r/g, '').split('\n');
  if (isTable(lines)) return parseTable(lines);
  return lines.map(parseLine).filter((x): x is ParsedItem => x !== null);
}

/** "18× Copper Ore" — the inverse of parseLine, used when editing a line. */
export function formatItem(i: { text: string; qty: number | null }): string {
  return i.qty ? `${i.qty}x ${i.text}` : i.text;
}

/** "1p 4g 5s 20c" from copper (100c = 1s, 100s = 1g, 100g = 1p). */
export function coin(copper: number | null | undefined): string {
  if (copper == null || !Number.isFinite(copper)) return '–';
  let c = Math.round(copper);
  if (c === 0) return '0c';
  const parts: string[] = [];
  for (const [unit, size] of [['p', 1_000_000], ['g', 10_000], ['s', 100]] as const) {
    if (c >= size) {
      parts.push(`${Math.floor(c / size)}${unit}`);
      c %= size;
    }
  }
  if (c) parts.push(`${c}c`);
  // Big prices: the two largest units are plenty ("2g 35s", not "2g 35s 12c").
  return parts.slice(0, 2).join(' ');
}

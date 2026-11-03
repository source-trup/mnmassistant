// Dev-server proxy for the Monsters and Memories Wiki partner API.
//
// The app calls /api/partner/v1/... on its own origin; this forwards those requests to
// https://monstersandmemories.wiki and attaches your partner key, so the key never reaches the browser.
//
// Provide the key (mnmp_…, issued by a wiki Site Admin) in either:
//   - the MNM_WIKI_KEY environment variable, or
//   - a file named wiki-api-key.txt next to this one (git-ignored).
// Without a key the app still works; item suggestions just come from items you've entered before.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const keyFile = join(here, 'wiki-api-key.txt');
const key = (process.env.MNM_WIKI_KEY || (existsSync(keyFile) ? readFileSync(keyFile, 'utf8') : '')).trim();

console.log(key ? '[wiki] Partner API key loaded — wiki item search enabled.' : '[wiki] No partner API key — wiki item search disabled.');

export default {
  '/api/partner': {
    target: 'https://monstersandmemories.wiki',
    changeOrigin: true,
    secure: true,
    headers: key ? { Authorization: `Bearer ${key}` } : {},
  },
};

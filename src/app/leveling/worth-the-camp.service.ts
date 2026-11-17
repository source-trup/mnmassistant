import { Injectable, signal } from '@angular/core';
import { SoloTier, WtcClass, WtcNpc, WtcZone } from './wtc-leveling';

/** Worth the Camp's public Data API (https://worththecamp.com/api): free JSON for M&M tools, no key, open CORS. */
export const WTC_URL = 'https://worththecamp.com/';
const API = 'https://worththecamp.com/api/v1/';
const CACHE_KEY = 'mnm-assistant.wtc.v1';
/** They ask for at most hourly; daily is plenty. */
const MAX_AGE_MS = 24 * 3_600_000;

export interface WtcData {
  npcs: WtcNpc[];
  zones: WtcZone[];
  classes: WtcClass[];
  /** The attribution line their data comes with. */
  attribution: string;
  /** When it was downloaded (epoch ms). */
  fetchedAt: number;
}

const TIERS: readonly SoloTier[] = ['S', 'A', 'B', 'C', 'D'];

/**
 * Worth the Camp's NPC, zone and class-tier data for the Leveling Spots panel. Downloaded at most once a day and kept
 * in this browser (trimmed to what the panel needs); if a refresh fails, the last copy is used.
 */
@Injectable({ providedIn: 'root' })
export class WorthTheCampService {
  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly data = signal<WtcData | null>(null);
  private pending: Promise<void> | null = null;

  load(): Promise<void> {
    if (this.pending) return this.pending;
    this.pending = this.fetchOrCache().finally(() => (this.pending = null));
    return this.pending;
  }

  private async fetchOrCache(): Promise<void> {
    const cached = readCache();
    if (cached) {
      this.data.set(cached);
      this.status.set('ready');
      if (Date.now() - cached.fetchedAt < MAX_AGE_MS) return;
    } else {
      this.status.set('loading');
    }
    try {
      const [npcs, zones, meta] = await Promise.all(['npcs', 'zones', 'meta'].map(getJson));
      const data = trim(npcs, zones, meta);
      this.data.set(data);
      this.status.set('ready');
      writeCache(data);
    } catch {
      // Offline or their API is down: keep the last copy if there is one.
      if (!cached) this.status.set('error');
    }
  }
}

async function getJson(name: string): Promise<any> {
  const res = await fetch(`${API}${name}.json`);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return res.json();
}

/** Keeps only what the panel uses: NPCs with known levels (no raid bosses), zone pages and class solo tiers. */
function trim(npcsRaw: any, zonesRaw: any, metaRaw: any): WtcData {
  const npcs: WtcNpc[] = (Array.isArray(npcsRaw?.npcs) ? npcsRaw.npcs : [])
    .filter((n: any) => n && typeof n.name === 'string' && typeof n.zone === 'string' && n.zone && !n.raid)
    .filter((n: any) => Number.isFinite(n.level_min) && Number.isFinite(n.level_max))
    .map((n: any) => ({
      id: String(n.id),
      name: n.name.trim(),
      zone: n.zone.trim(),
      lo: Math.min(n.level_min, n.level_max),
      hi: Math.max(n.level_min, n.level_max),
      drops: Array.isArray(n.item_ids) ? n.item_ids.length : 0,
    }));
  const zones: WtcZone[] = (Array.isArray(zonesRaw?.zones) ? zonesRaw.zones : [])
    .filter((z: any) => z && typeof z.name === 'string' && typeof z.url === 'string' && z.url.startsWith(WTC_URL))
    .map((z: any) => ({ name: z.name, url: z.url }));
  const classes: WtcClass[] = (Array.isArray(metaRaw?.classes) ? metaRaw.classes : [])
    .filter((c: any) => c && typeof c.class === 'string' && TIERS.includes(c.solo?.grade))
    .map((c: any) => ({ name: c.class, tier: c.solo.grade as SoloTier }))
    .sort((a: WtcClass, b: WtcClass) => a.name.localeCompare(b.name));
  if (!npcs.length || !classes.length) throw new Error('Worth the Camp: no data');
  const attribution = typeof npcsRaw?.attribution === 'string' ? npcsRaw.attribution : '';
  return { npcs, zones, classes, attribution, fetchedAt: Date.now() };
}

function readCache(): WtcData | null {
  try {
    const d = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    return d && Array.isArray(d.npcs) && Array.isArray(d.classes) && Number.isFinite(d.fetchedAt) ? d : null;
  } catch {
    return null;
  }
}

function writeCache(d: WtcData): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(d));
  } catch {
    // Too big or storage blocked: it's downloaded again next time.
  }
}

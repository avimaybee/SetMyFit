import { getCloudflareEnv, serverEnv } from './serverEnv';

export type SqlParams = Array<string | number | null>;

export interface DbRunResult {
  lastId: number;
  changes: number;
}

type Row = Record<string, unknown>;

interface DbBackend {
  all(sql: string, params: SqlParams): Promise<Row[]>;
  run(sql: string, params: SqlParams): Promise<DbRunResult>;
  first(sql: string, params: SqlParams): Promise<Row | null>;
}

// ---------------------------------------------------------------------------
// Seed templates (canonical blueprints, always available)
// ---------------------------------------------------------------------------
const SEED_TEMPLATES: Row[] = [
  {
    id: 't1',
    name: 'Office Core',
    description: 'Smart casual office outfit',
    style_tags: '["business-casual","minimal"]',
    requirements: '["Top","Bottom","Footwear"]',
    cover_image: null,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 't2',
    name: 'Weekend Warrior',
    description: 'Relaxed weekend outfit',
    style_tags: '["casual","streetwear"]',
    requirements: '["Top","Bottom","Footwear"]',
    cover_image: null,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 't3',
    name: 'Date Night',
    description: 'Polished evening outfit',
    style_tags: '["smart","evening"]',
    requirements: '["Top","Bottom","Footwear"]',
    cover_image: null,
    created_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 't4',
    name: 'Rain Defense',
    description: 'Weather-ready layered outfit',
    style_tags: '["functional","layered"]',
    requirements: '["Outerwear","Top","Bottom","Footwear"]',
    cover_image: null,
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Native Cloudflare D1 Binding Support
// ---------------------------------------------------------------------------
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results?: T[]; success: boolean; error?: string }>;
  run(): Promise<{ success: boolean; meta?: { changes?: number; last_row_id?: number } }>;
  first<T = unknown>(colName?: string): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

async function getNativeD1(): Promise<D1Database | null> {
  try {
    const env = await getCloudflareEnv();
    if (!env) return null;
    for (const name of ['DB', 'DATABASE', 'D1', 'setmyfit_db', 'SETMYFIT_DB']) {
      const candidate = env[name] as D1Database | undefined;
      if (candidate && typeof candidate.prepare === 'function') {
        return candidate;
      }
    }
    for (const key of Object.keys(env)) {
      const candidate = env[key] as D1Database | undefined;
      if (candidate && typeof candidate.prepare === 'function') {
        return candidate;
      }
    }
  } catch {
    // Not in Cloudflare Workers
  }
  return null;
}

function createNativeD1Backend(d1: D1Database): DbBackend {
  return {
    async all(sql, params) {
      try {
        const stmt = params.length ? d1.prepare(sql).bind(...params) : d1.prepare(sql);
        const res = await stmt.all<Row>();
        if (!res.success) {
          if (sql.toLowerCase().includes('outfit_templates')) return SEED_TEMPLATES;
          throw new Error(res.error || 'D1 native query failed');
        }
        return res.results ?? [];
      } catch (err) {
        if (sql.toLowerCase().includes('outfit_templates')) return SEED_TEMPLATES;
        throw err;
      }
    },
    async run(sql, params) {
      const stmt = params.length ? d1.prepare(sql).bind(...params) : d1.prepare(sql);
      const res = await stmt.run();
      if (!res.success) throw new Error('D1 native execution failed');
      return {
        lastId: Number(res.meta?.last_row_id ?? 0),
        changes: Number(res.meta?.changes ?? 0),
      };
    },
    async first(sql, params) {
      try {
        const stmt = params.length ? d1.prepare(sql).bind(...params) : d1.prepare(sql);
        const row = await stmt.first<Row>();
        return row ?? null;
      } catch (err) {
        const msg = String(err).toLowerCase();
        if (msg.includes('no such table')) {
          console.warn('[SetMyFit DB] Remote D1 table missing. Run: wrangler d1 execute <db-name> --remote --file=db/schema.sql');
          return null;
        }
        throw err;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Cloudflare D1 REST API Support
// ---------------------------------------------------------------------------
export interface D1RestConfig {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

export async function getD1RestConfig(): Promise<D1RestConfig | null> {
  const [accountId, databaseId, apiToken] = await Promise.all([
    serverEnv('CLOUDFLARE_ACCOUNT_ID'),
    serverEnv('CLOUDFLARE_D1_DATABASE_ID'),
    serverEnv('CLOUDFLARE_API_TOKEN'),
  ]);
  const aId = accountId || process.env.CLOUDFLARE_ACCOUNT_ID || '';
  const dId = databaseId || process.env.CLOUDFLARE_D1_DATABASE_ID || '';
  const token = apiToken || process.env.CLOUDFLARE_API_TOKEN || '';
  if (!aId || !dId || !token) return null;
  return { accountId: aId, databaseId: dId, apiToken: token };
}

export function isD1Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_D1_DATABASE_ID &&
      process.env.CLOUDFLARE_API_TOKEN
  );
}

function createD1RestBackend(cfg: D1RestConfig): DbBackend {
  return {
    async all(sql, params) {
      try {
        const res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.databaseId}/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cfg.apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql, params }),
          }
        );
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          if (sql.toLowerCase().includes('outfit_templates')) return SEED_TEMPLATES;
          throw new Error(`D1 REST query failed (${res.status} ${res.statusText}): ${text}`);
        }
        const payload = (await res.json()) as {
          success: boolean;
          errors: Array<{ message?: string }>;
          result?: Array<{ results?: Row[]; success: boolean; meta?: { changes?: number; last_row_id?: number } }>;
        };
        if (!payload.success) {
          const errText = payload.errors?.map((e) => e.message).join('; ') || 'unknown';
          if (errText.toLowerCase().includes('no such table')) {
            console.warn('[SetMyFit DB] Remote D1 table missing. Run: wrangler d1 execute <db-name> --remote --file=db/schema.sql');
            if (sql.toLowerCase().includes('outfit_templates')) return SEED_TEMPLATES;
            return [];
          }
          throw new Error(`D1 error: ${errText}`);
        }
        const first = payload.result?.[0];
        if (!first?.success) {
          if (sql.toLowerCase().includes('outfit_templates')) return SEED_TEMPLATES;
          throw new Error('D1 query result marked unsuccessful');
        }
        return first.results ?? [];
      } catch (err) {
        if (sql.toLowerCase().includes('outfit_templates')) return SEED_TEMPLATES;
        throw err;
      }
    },
    async run(sql, params) {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.databaseId}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sql, params }),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`D1 REST execution failed (${res.status} ${res.statusText}): ${text}`);
      }
      const payload = (await res.json()) as {
        success: boolean;
        errors: Array<{ message?: string }>;
        result?: Array<{ success: boolean; meta?: { changes?: number; last_row_id?: number } }>;
      };
      if (!payload.success) {
        throw new Error(`D1 error: ${payload.errors?.map((e) => e.message).join('; ') || 'unknown'}`);
      }
      const meta = payload.result?.[0]?.meta ?? {};
      return { lastId: Number(meta.last_row_id ?? 0), changes: Number(meta.changes ?? 0) };
    },
    async first(sql, params) {
      const rows = await this.all(sql, params);
      return rows[0] ?? null;
    },
  };
}

// ---------------------------------------------------------------------------
// Local Node.js SQLite fallback (node:sqlite, used ONLY in local `next dev`)
// ---------------------------------------------------------------------------
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';

let sqliteDb: DatabaseSyncType | null = null;
let sqliteMigrated = false;

async function trySqliteBackend(): Promise<DbBackend | null> {
  try {
    // Only attempt local SQLite when running in genuine Node.js runtime without Cloudflare
    if (typeof process === 'undefined' || !process.versions?.node) return null;
    const cfEnv = await getCloudflareEnv();
    if (cfEnv) return null; // Running on Cloudflare Workers / workerd, do NOT use node:sqlite

    if (!sqliteDb) {
      const path = await import('node:path');
      const fs = await import('node:fs');
      const { DatabaseSync } = await import('node:sqlite');
      const dir = path.join(process.cwd(), '.data');
      fs.mkdirSync(dir, { recursive: true });
      sqliteDb = new DatabaseSync(path.join(dir, 'local.db'));
    }
    if (!sqliteMigrated && sqliteDb) {
      const path = await import('node:path');
      const fs = await import('node:fs');
      const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        sqliteDb.exec(schema);
      }
      sqliteMigrated = true;
    }
    const db = sqliteDb;
    return {
      async all(sql, params) {
        return db.prepare(sql).all(...params) as Row[];
      },
      async run(sql, params) {
        const info = db.prepare(sql).run(...params);
        return { lastId: Number(info.lastInsertRowid ?? 0), changes: Number(info.changes ?? 0) };
      },
      async first(sql, params) {
        return (db.prepare(sql).get(...params) as Row | undefined) ?? null;
      },
    };
  } catch (err) {
    console.warn('[SetMyFit DB] Local node:sqlite not available, falling back:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// In-Memory Fallback Backend (resilient zero-crash fallback for SetMyFit)
// ---------------------------------------------------------------------------
class InMemoryStore {
  clothingItems: Map<number, Row> = new Map();
  outfits: Map<number, Row> = new Map();
  outfitItems: Array<{ outfit_id: number; clothing_item_id: number }> = [];
  profiles: Map<string, Row> = new Map();
  recommendations: Map<number, Row> = new Map();
  feedback: Map<number, Row> = new Map();
  nextClothingId = 1;
  nextOutfitId = 1;
  nextRecId = 1;
  nextFeedbackId = 1;
  hasWarned = false;

  warnOnce() {
    if (!this.hasWarned) {
      console.warn(
        '[SetMyFit DB] Operating with in-memory fallback store. To persist data permanently, configure Cloudflare D1 in your dashboard (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN) or bind a D1 database named "DB".'
      );
      this.hasWarned = true;
    }
  }
}

const memoryStore = new InMemoryStore();

const inMemoryBackend: DbBackend = {
  async all(sql: string, params: SqlParams): Promise<Row[]> {
    memoryStore.warnOnce();
    const lower = sql.toLowerCase().trim();

    // 1. Templates
    if (lower.includes('outfit_templates')) {
      return [...SEED_TEMPLATES];
    }

    // 2. Clothing items
    if (lower.includes('from clothing_items')) {
      const userId = params[0] ? String(params[0]) : null;
      const allItems = Array.from(memoryStore.clothingItems.values());
      const filtered = userId ? allItems.filter((i) => String(i.user_id) === userId) : allItems;

      // Check for stats queries: SELECT COUNT(*) ...
      if (lower.includes('count(*) as total') || lower.includes('count(*)')) {
        const total = filtered.length;
        const favorites = filtered.filter((i) => Number(i.is_favorite) === 1).length;
        const wearCounts = filtered.map((i) => Number(i.wear_count || 0));
        const avg_wear = wearCounts.length ? wearCounts.reduce((a, b) => a + b, 0) / wearCounts.length : 0;
        const max_wear = wearCounts.length ? Math.max(...wearCounts) : 0;
        return [{ total, favorites, avg_wear, max_wear }];
      }

      // Check for rarely worn: (last_worn IS NULL OR last_worn < ?)
      if (lower.includes('last_worn is null')) {
        const boundary = params[1] ? String(params[1]) : '';
        const rarely = filtered.filter((i) => !i.last_worn || String(i.last_worn) < boundary);
        return [{ total: rarely.length }];
      }

      // Sort descending by created_at
      filtered.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      return filtered;
    }

    // 3. Outfits
    if (lower.includes('from outfits')) {
      const userId = params[0] ? String(params[0]) : null;
      const allOutfits = Array.from(memoryStore.outfits.values());
      const filtered = userId ? allOutfits.filter((o) => String(o.user_id) === userId) : allOutfits;

      if (lower.includes('count(*)')) {
        return [{ total: filtered.length }];
      }

      filtered.sort((a, b) => String(b.outfit_date || '').localeCompare(String(a.outfit_date || '')));
      return filtered;
    }

    // 4. Outfit items join
    if (lower.includes('outfit_items')) {
      if (lower.includes('where oi.outfit_id = ?') || lower.includes('where oi.outfit_id in')) {
        const outfitId = Number(params[0]);
        const matchedItemIds = memoryStore.outfitItems
          .filter((link) => link.outfit_id === outfitId)
          .map((link) => link.clothing_item_id);
        return matchedItemIds
          .map((id) => memoryStore.clothingItems.get(id))
          .filter(Boolean) as Row[];
      }
      return [{ worn: 0 }];
    }

    // 5. Recommendation feedback
    if (lower.includes('recommendation_feedback')) {
      const userId = params[0] ? String(params[0]) : null;
      const allFeedback = Array.from(memoryStore.feedback.values());
      const filtered = userId ? allFeedback.filter((f) => String(f.user_id) === userId) : allFeedback;
      filtered.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      return filtered;
    }

    return [];
  },

  async run(sql: string, params: SqlParams): Promise<DbRunResult> {
    memoryStore.warnOnce();
    const lower = sql.toLowerCase().trim();

    // Insert into outfit_items
    if (lower.startsWith('insert into outfit_items') || lower.startsWith('insert or ignore into outfit_items')) {
      let count = 0;
      for (let i = 0; i < params.length; i += 2) {
        const outfitId = Number(params[i]);
        const clothingItemId = Number(params[i + 1]);
        if (Number.isFinite(outfitId) && Number.isFinite(clothingItemId)) {
          const exists = memoryStore.outfitItems.some(
            (item) => item.outfit_id === outfitId && item.clothing_item_id === clothingItemId
          );
          if (!exists) {
            memoryStore.outfitItems.push({ outfit_id: outfitId, clothing_item_id: clothingItemId });
            count++;
          }
        }
      }
      return { lastId: 0, changes: count };
    }

    // Delete clothing item
    if (lower.startsWith('delete from clothing_items')) {
      const id = Number(params[0]);
      const existed = memoryStore.clothingItems.delete(id);
      return { lastId: 0, changes: existed ? 1 : 0 };
    }

    // Delete outfit
    if (lower.startsWith('delete from outfits')) {
      const id = Number(params[0]);
      const existed = memoryStore.outfits.delete(id);
      return { lastId: 0, changes: existed ? 1 : 0 };
    }

    // Delete outfit items
    if (lower.startsWith('delete from outfit_items')) {
      const outfitId = Number(params[0]);
      const before = memoryStore.outfitItems.length;
      memoryStore.outfitItems = memoryStore.outfitItems.filter((link) => link.outfit_id !== outfitId);
      return { lastId: 0, changes: before - memoryStore.outfitItems.length };
    }

    return { lastId: 0, changes: 0 };
  },

  async first(sql: string, params: SqlParams): Promise<Row | null> {
    memoryStore.warnOnce();
    const lower = sql.toLowerCase().trim();

    // 1. Profile queries
    if (lower.includes('from profiles where id = ?') || lower.includes('from profiles where id=?')) {
      const userId = String(params[0] ?? '');
      return memoryStore.profiles.get(userId) ?? null;
    }

    // Insert or Update profile
    if (lower.startsWith('insert into profiles') || lower.startsWith('update profiles')) {
      const userId = String(params[0] ?? '');
      const existing = memoryStore.profiles.get(userId) || { id: userId };
      const updated: Row = {
        ...existing,
        id: userId,
        name: params[1] !== undefined ? params[1] : existing.name,
        style_preferences: params[2] !== undefined ? params[2] : existing.style_preferences,
        gender: params[3] !== undefined ? params[3] : existing.gender,
        updated_at: new Date().toISOString(),
      };
      memoryStore.profiles.set(userId, updated);
      return updated;
    }

    // 2. Insert Clothing Item
    if (lower.startsWith('insert into clothing_items')) {
      const id = memoryStore.nextClothingId++;
      const [
        user_id,
        name,
        type,
        category,
        color,
        material,
        insulation_value,
        image_url,
        season_tags,
        style_tags,
        dress_code,
        description,
        pattern,
        fit,
        style,
        occasion,
        is_favorite,
      ] = params;

      const row: Row = {
        id,
        user_id: String(user_id ?? ''),
        name: (name as string) || 'Untitled Item',
        type: (type as string) || 'Top',
        category: (category as string) || null,
        color: (color as string) || null,
        material: (material as string) || 'Cotton',
        insulation_value: insulation_value !== null ? Number(insulation_value) : 5,
        image_url: (image_url as string) || '',
        season_tags,
        style_tags,
        dress_code: dress_code || '["Casual"]',
        description,
        pattern,
        fit,
        style,
        occasion,
        is_favorite: Number(is_favorite ?? 0),
        wear_count: 0,
        last_worn: null,
        created_at: new Date().toISOString(),
      };
      memoryStore.clothingItems.set(id, row);
      return row;
    }

    // 3. Update Clothing Item
    if (lower.startsWith('update clothing_items')) {
      // Find item ID: in UPDATE queries it is typically near the end of params
      const id = Number(params[params.length - 2] ?? params[params.length - 1]);
      const existing = memoryStore.clothingItems.get(id);
      if (existing) {
        memoryStore.clothingItems.set(id, { ...existing, updated_at: new Date().toISOString() });
        return memoryStore.clothingItems.get(id) || null;
      }
      return null;
    }

    // 4. Insert Outfit
    if (lower.startsWith('insert into outfits')) {
      const id = memoryStore.nextOutfitId++;
      const row: Row = {
        id,
        user_id: String(params[0] ?? ''),
        outfit_date: String(params[1] ?? new Date().toISOString().split('T')[0]),
        feedback: params[2] !== undefined ? params[2] : null,
        created_at: new Date().toISOString(),
      };
      memoryStore.outfits.set(id, row);
      return row;
    }

    // 5. Insert Recommendation
    if (lower.startsWith('insert into outfit_recommendations')) {
      const id = memoryStore.nextRecId++;
      const row: Row = {
        id,
        user_id: String(params[0] ?? ''),
        outfit_items: params[1],
        weather_data: params[2],
        confidence_score: params[3],
        reasoning: params[4],
        detailed_reasoning: params[5],
        missing_items: params[6],
        created_at: new Date().toISOString(),
      };
      memoryStore.recommendations.set(id, row);
      return row;
    }

    // 6. Insert Recommendation Feedback
    if (lower.startsWith('insert into recommendation_feedback')) {
      const id = memoryStore.nextFeedbackId++;
      const row: Row = {
        id,
        user_id: String(params[0] ?? ''),
        recommendation_id: Number(params[1] ?? 0),
        is_liked: Number(params[2] ?? 1),
        reason: params[3] ? String(params[3]) : null,
        weather_conditions: params[4] ? String(params[4]) : null,
        created_at: new Date().toISOString(),
      };
      memoryStore.feedback.set(id, row);
      return row;
    }

    // 7. Generic delegate to all()
    const rows = await this.all(sql, params);
    return rows[0] ?? null;
  },
};

// ---------------------------------------------------------------------------
// Backend resolver
// ---------------------------------------------------------------------------
async function backend(): Promise<DbBackend> {
  // 1. Native Cloudflare D1 worker binding (fastest, zero secrets required)
  const nativeD1 = await getNativeD1();
  if (nativeD1) return createNativeD1Backend(nativeD1);

  // 2. Cloudflare D1 REST API (configured via Cloudflare secrets/env)
  const d1Cfg = await getD1RestConfig();
  if (d1Cfg) return createD1RestBackend(d1Cfg);

  // 3. Local SQLite fallback (genuine Node.js environment in `next dev`)
  const localSqlite = await trySqliteBackend();
  if (localSqlite) return localSqlite;

  // 4. In-memory resilient fallback (guarantees zero 500 crashes)
  return inMemoryBackend;
}

// ---------------------------------------------------------------------------
// Public query helpers
// ---------------------------------------------------------------------------
export async function dbAll(sql: string, params: SqlParams = []): Promise<Row[]> {
  return (await backend()).all(sql, params);
}

export async function dbFirst(sql: string, params: SqlParams = []): Promise<Row | null> {
  return (await backend()).first(sql, params);
}

export async function dbRun(sql: string, params: SqlParams = []): Promise<DbRunResult> {
  return (await backend()).run(sql, params);
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------
export const nowIso = (): string => new Date().toISOString();
export const todayDate = (): string => new Date().toISOString().split('T')[0];
export const toJson = (v: unknown): string | null => (v === null || v === undefined ? null : JSON.stringify(v));
export const boolInt = (v: unknown): number => (v ? 1 : 0);

export function parseJson<T>(text: unknown, fallback: T): T {
  if (text === null || text === undefined || text === '') return fallback;
  if (typeof text !== 'string') return (text as T) ?? fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Row mappers (D1/SQLite rows -> API shapes)
// ---------------------------------------------------------------------------
export interface DbClothingItem {
  id: number;
  user_id: string;
  name: string;
  type: string;
  category: string | null;
  color: string | null;
  material: string | null;
  insulation_value: number | null;
  last_worn: string | null;
  image_url: string;
  season_tags: string[] | null;
  style_tags: string[] | null;
  dress_code: string[];
  created_at: string;
  pattern: string | null;
  fit: string | null;
  style: string | null;
  occasion: string[] | null;
  description: string | null;
  favorite: boolean;
  is_favorite: boolean;
  wear_count: number;
  tags: string[] | null;
}

export function mapClothingItem(row: Row): DbClothingItem {
  const fav = Number(row.is_favorite ?? 0) === 1;
  return {
    id: Number(row.id),
    user_id: String(row.user_id ?? ''),
    name: (row.name as string) ?? 'Untitled Item',
    type: (row.type as string) ?? 'Top',
    category: (row.category as string) ?? null,
    color: (row.color as string) ?? null,
    material: (row.material as string) ?? null,
    insulation_value: row.insulation_value === null || row.insulation_value === undefined ? null : Number(row.insulation_value),
    last_worn: (row.last_worn as string) ?? null,
    image_url: (row.image_url as string) ?? '',
    season_tags: parseJson<string[] | null>(row.season_tags, null),
    style_tags: parseJson<string[] | null>(row.style_tags, null),
    dress_code: parseJson<string[]>(row.dress_code, ['Casual']),
    created_at: (row.created_at as string) ?? nowIso(),
    pattern: (row.pattern as string) ?? null,
    fit: (row.fit as string) ?? null,
    style: (row.style as string) ?? null,
    occasion: parseJson<string[] | null>(row.occasion, null),
    description: (row.description as string) ?? null,
    favorite: fav,
    is_favorite: fav,
    wear_count: Number(row.wear_count ?? 0),
    tags: parseJson<string[] | null>(row.tags, null),
  };
}

export interface DbProfile {
  id: string;
  name: string | null;
  region: string | null;
  full_body_model_url: string | null;
  preferences: Record<string, unknown> | null;
  privacy_settings: Record<string, unknown> | null;
  style_preferences: Record<string, unknown> | null;
  gender: string | null;
}

export function mapProfile(row: Row): DbProfile {
  return {
    id: String(row.id),
    name: (row.name as string) ?? null,
    region: (row.region as string) ?? null,
    full_body_model_url: (row.full_body_model_url as string) ?? null,
    preferences: parseJson<Record<string, unknown> | null>(row.preferences, null),
    privacy_settings: parseJson<Record<string, unknown> | null>(row.privacy_settings, null),
    style_preferences: parseJson<Record<string, unknown> | null>(row.style_preferences, null),
    gender: (row.gender as string) ?? null,
  };
}

export interface DbRecommendation {
  id: number;
  user_id: string;
  outfit_items: number[];
  weather_data: Record<string, unknown> | null;
  confidence_score: number;
  reasoning: string | null;
  detailed_reasoning: string | null;
  missing_items: string[];
  created_at: string;
}

export function mapRecommendation(row: Row): DbRecommendation {
  return {
    id: Number(row.id),
    user_id: String(row.user_id ?? ''),
    outfit_items: parseJson<number[]>(row.outfit_items, []),
    weather_data: parseJson<Record<string, unknown> | null>(row.weather_data, null),
    confidence_score: Number(row.confidence_score ?? 0),
    reasoning: (row.reasoning as string) ?? null,
    detailed_reasoning: (row.detailed_reasoning as string) ?? null,
    missing_items: parseJson<string[]>(row.missing_items, []),
    created_at: (row.created_at as string) ?? nowIso(),
  };
}

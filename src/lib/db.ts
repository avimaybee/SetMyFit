/**
 * Database layer — Cloudflare D1 (SQLite) via HTTPS API, with a zero-config
 * local SQLite fallback (node:sqlite) for `next dev`.
 *
 * Conventions (see db/schema.sql):
 * - dates: TEXT (ISO), arrays/JSON: TEXT (JSON), booleans: INTEGER 0/1
 * - identity: Firebase UID in user_id / profiles.id (TEXT)
 * - D1 has no RLS: every query MUST filter by user_id (callers enforce this)
 */

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
// D1 over HTTPS (works on Cloudflare Pages via secrets AND in plain next dev)
// POST https://api.cloudflare.com/client/v4/accounts/{acct}/d1/database/{db}/query
// ---------------------------------------------------------------------------
function d1RestConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID || '';
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
  if (!accountId || !databaseId || !apiToken) return null;
  return { accountId, databaseId, apiToken };
}

export function isD1Configured(): boolean {
  return d1RestConfig() !== null;
}

const d1Backend: DbBackend = {
  async all(sql, params) {
    const cfg = d1RestConfig();
    if (!cfg) throw new Error('D1 is not configured (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / CLOUDFLARE_API_TOKEN)');
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
    if (!res.ok) throw new Error(`D1 request failed: ${res.status} ${res.statusText}`);
    const payload = (await res.json()) as {
      success: boolean;
      errors: Array<{ message?: string }>;
      result?: Array<{ results?: Row[]; success: boolean; meta?: { changes?: number; last_row_id?: number } }>;
    };
    if (!payload.success) {
      throw new Error(`D1 error: ${payload.errors?.map((e) => e.message).join('; ') || 'unknown'}`);
    }
    const first = payload.result?.[0];
    if (!first?.success) throw new Error('D1 query was not successful');
    return first.results ?? [];
  },
  async run(sql, params) {
    const cfg = d1RestConfig();
    if (!cfg) throw new Error('D1 is not configured');
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
    if (!res.ok) throw new Error(`D1 request failed: ${res.status} ${res.statusText}`);
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
    const rows = await d1Backend.all(sql, params);
    return rows[0] ?? null;
  },
};

// ---------------------------------------------------------------------------
// Local SQLite fallback (node:sqlite, zero-config for `next dev`)
// ---------------------------------------------------------------------------
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';

let sqliteDb: DatabaseSyncType | null = null;
let sqliteMigrated = false;

async function sqliteBackend(): Promise<DbBackend> {
  if (!sqliteDb) {
    const path = await import('node:path');
    const fs = await import('node:fs');
    const { DatabaseSync } = await import('node:sqlite');
    const dir = path.join(process.cwd(), '.data');
    fs.mkdirSync(dir, { recursive: true });
    sqliteDb = new DatabaseSync(path.join(dir, 'local.db'));
  }
  if (!sqliteMigrated) {
    const path = await import('node:path');
    const fs = await import('node:fs');
    const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    sqliteDb.exec(schema);
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
}

async function backend(): Promise<DbBackend> {
  if (isD1Configured()) return d1Backend;
  return sqliteBackend();
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

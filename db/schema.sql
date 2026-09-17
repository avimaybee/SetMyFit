-- SetMyFit canonical schema (Cloudflare D1 / SQLite)
-- Applied via: wrangler d1 migrations apply / wrangler d1 execute --file
-- Fresh start: no data migration from Supabase.
-- Conventions: dates as TEXT (ISO), arrays/JSON as TEXT (JSON), booleans as INTEGER 0/1.
-- Auth identity is the Firebase UID stored in user_id / profiles.id (TEXT).

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT,
  region TEXT,
  full_body_model_url TEXT,
  preferences TEXT,
  privacy_settings TEXT,
  style_preferences TEXT,
  gender TEXT DEFAULT 'neutral',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS clothing_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Item',
  type TEXT NOT NULL DEFAULT 'Top',
  category TEXT,
  color TEXT,
  material TEXT DEFAULT 'Cotton',
  insulation_value INTEGER DEFAULT 5,
  dress_code TEXT DEFAULT '["Casual"]',
  season_tags TEXT,
  style_tags TEXT,
  image_url TEXT NOT NULL,
  last_worn TEXT,
  pattern TEXT,
  fit TEXT,
  style TEXT,
  occasion TEXT,
  description TEXT,
  wear_count INTEGER NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  tags TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_clothing_items_user ON clothing_items(user_id);

CREATE TABLE IF NOT EXISTS outfits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  outfit_date TEXT NOT NULL,
  rendered_image_url TEXT,
  feedback INTEGER,
  reasoning TEXT,
  weather_data TEXT,
  visual_image_url TEXT,
  visual_metadata TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_outfits_user_date ON outfits(user_id, outfit_date);

CREATE TABLE IF NOT EXISTS outfit_items (
  outfit_id INTEGER NOT NULL,
  clothing_item_id INTEGER NOT NULL,
  PRIMARY KEY (outfit_id, clothing_item_id)
);
CREATE INDEX IF NOT EXISTS idx_outfit_items_outfit ON outfit_items(outfit_id);
CREATE INDEX IF NOT EXISTS idx_outfit_items_item ON outfit_items(clothing_item_id);

CREATE TABLE IF NOT EXISTS outfit_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  outfit_items TEXT NOT NULL DEFAULT '[]',
  weather_data TEXT,
  confidence_score REAL NOT NULL DEFAULT 0,
  reasoning TEXT,
  detailed_reasoning TEXT,
  missing_items TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_recommendations_user ON outfit_recommendations(user_id, created_at);

CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recommendation_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  is_liked INTEGER NOT NULL,
  reason TEXT,
  weather_conditions TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON recommendation_feedback(user_id, created_at);

CREATE TABLE IF NOT EXISTS outfit_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  style_tags TEXT,
  cover_image TEXT,
  requirements TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  preferred_silhouette TEXT DEFAULT 'neutral',
  preferred_styles TEXT DEFAULT '[]',
  preferred_color_palette TEXT,
  saved_style_presets TEXT DEFAULT '[]',
  default_preview_count INTEGER DEFAULT 3,
  default_preview_quality TEXT DEFAULT 'medium',
  consent_to_generative_ai INTEGER DEFAULT 1,
  delete_images_after_use INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS outfit_item_swaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  outfit_id INTEGER NOT NULL,
  original_item_id INTEGER,
  swapped_item_id INTEGER,
  swap_reason TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS outfit_visuals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  recommendation_id TEXT,
  seed INTEGER,
  style TEXT,
  prompt_text TEXT,
  preview_urls TEXT,
  final_urls TEXT,
  job_id TEXT,
  job_status TEXT DEFAULT 'queued',
  job_error_message TEXT,
  preview_quality TEXT,
  item_ids TEXT,
  silhouette TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  preview_generated_at TEXT,
  final_generated_at TEXT,
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  retention_days INTEGER DEFAULT 90,
  scheduled_deletion_at TEXT,
  user_opted_in_to_retain INTEGER DEFAULT 1
);

-- Seed templates (INSERT OR IGNORE so re-applying is safe)
INSERT OR IGNORE INTO outfit_templates (id, name, description, style_tags, requirements) VALUES
  ('t1', 'Office Core', 'Smart casual office outfit', '["business-casual","minimal"]', '["Top","Bottom","Footwear"]'),
  ('t2', 'Weekend Warrior', 'Relaxed weekend outfit', '["casual","streetwear"]', '["Top","Bottom","Footwear"]'),
  ('t3', 'Date Night', 'Polished evening outfit', '["smart","evening"]', '["Top","Bottom","Footwear"]'),
  ('t4', 'Rain Defense', 'Weather-ready layered outfit', '["functional","layered"]', '["Outerwear","Top","Bottom","Footwear"]');

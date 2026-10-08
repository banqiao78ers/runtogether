-- 路跑路線儲存（Phase 4）；pwa_ 前綴，不改舊系統表結構以外欄位
-- 於 Supabase SQL Editor 執行本檔

CREATE TABLE IF NOT EXISTS pwa_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  distance_m INT NOT NULL CHECK (distance_m >= 0),
  elevation_gain_m INT,
  geometry JSONB NOT NULL,
  waypoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  prefs JSONB,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pwa_routes_creator_created
  ON pwa_routes (creator_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE pwa_routes ENABLE ROW LEVEL SECURITY;

-- 開團可選綁定路線
ALTER TABLE pwa_runs
  ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES pwa_routes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pwa_runs_route_id
  ON pwa_runs (route_id)
  WHERE route_id IS NOT NULL;

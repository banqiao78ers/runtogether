-- 板橋約跑 PWA schema（隔離前綴 pwa_，不修改既有表）
-- 於 Supabase SQL Editor 執行本檔

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. 會員主表
CREATE TABLE IF NOT EXISTS pwa_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_uid VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'super_member', 'admin')),
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  pace_min INT,
  pace_max INT,
  push_subscription JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 集合地點表
CREATE TABLE IF NOT EXISTS pwa_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city VARCHAR(50) NOT NULL DEFAULT '新北市',
  district VARCHAR(50) NOT NULL DEFAULT '板橋區',
  title VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 約跑活動主表
CREATE TABLE IF NOT EXISTS pwa_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE RESTRICT,
  location_id UUID REFERENCES pwa_locations(id) ON DELETE SET NULL,
  custom_location VARCHAR(150),
  location_detail VARCHAR(255),
  destination VARCHAR(150),
  start_time TIMESTAMPTZ NOT NULL,
  estimated_duration_minutes INT NOT NULL DEFAULT 60,
  distance_km NUMERIC(5, 2) NOT NULL,
  pace_min INT NOT NULL,
  pace_max INT NOT NULL,
  max_participants INT NOT NULL DEFAULT 10,
  note TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'delayed', 'ongoing', 'completed', 'cancelled')),
  delay_count INT NOT NULL DEFAULT 0 CHECK (delay_count <= 2),
  total_delayed_minutes INT NOT NULL DEFAULT 0 CHECK (total_delayed_minutes <= 60),
  cancel_reason TEXT,
  completion_reminder_sent_at TIMESTAMPTZ,
  start_reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 4. 報名與出席
CREATE TABLE IF NOT EXISTS pwa_run_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES pwa_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'arrived', 'attended', 'cancelled', 'no_show')),
  arrived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_run_user UNIQUE (run_id, user_id)
);

-- 5. 留言板
CREATE TABLE IF NOT EXISTS pwa_run_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES pwa_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 6. 主揪黑名單
CREATE TABLE IF NOT EXISTS pwa_host_blocklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_host_blocked UNIQUE (host_id, blocked_user_id)
);

-- 7. 惡意取消檢舉投票
CREATE TABLE IF NOT EXISTS pwa_run_cancellation_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES pwa_runs(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE RESTRICT,
  is_malicious BOOLEAN NOT NULL DEFAULT TRUE,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_run_voter UNIQUE (run_id, voter_id)
);

-- 8. 停權申訴
CREATE TABLE IF NOT EXISTS pwa_penalty_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES pwa_users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pwa_runs_start_time ON pwa_runs(start_time) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pwa_runs_status ON pwa_runs(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pwa_runs_host ON pwa_runs(host_id);
CREATE INDEX IF NOT EXISTS idx_pwa_participants_run_status ON pwa_run_participants(run_id, status);
CREATE INDEX IF NOT EXISTS idx_pwa_participants_user ON pwa_run_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_pwa_comments_run ON pwa_run_comments(run_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pwa_locations_active ON pwa_locations(is_active, district);

-- updated_at helper
CREATE OR REPLACE FUNCTION pwa_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pwa_users_updated ON pwa_users;
CREATE TRIGGER trg_pwa_users_updated
  BEFORE UPDATE ON pwa_users
  FOR EACH ROW EXECUTE FUNCTION pwa_set_updated_at();

DROP TRIGGER IF EXISTS trg_pwa_runs_updated ON pwa_runs;
CREATE TRIGGER trg_pwa_runs_updated
  BEFORE UPDATE ON pwa_runs
  FOR EACH ROW EXECUTE FUNCTION pwa_set_updated_at();

DROP TRIGGER IF EXISTS trg_pwa_participants_updated ON pwa_run_participants;
CREATE TRIGGER trg_pwa_participants_updated
  BEFORE UPDATE ON pwa_run_participants
  FOR EACH ROW EXECUTE FUNCTION pwa_set_updated_at();

-- 時段重疊：同一用戶在已有活動時間區間內不可再發起或報名
CREATE OR REPLACE FUNCTION pwa_user_has_time_overlap(
  p_user_id UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_exclude_run_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_overlap BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pwa_runs r
    LEFT JOIN pwa_run_participants p
      ON p.run_id = r.id AND p.user_id = p_user_id AND p.status IN ('registered', 'arrived', 'attended')
    WHERE r.deleted_at IS NULL
      AND r.status IN ('open', 'delayed', 'ongoing')
      AND (p_exclude_run_id IS NULL OR r.id <> p_exclude_run_id)
      AND (r.host_id = p_user_id OR p.id IS NOT NULL)
      AND r.start_time < p_end
      AND (r.start_time + make_interval(mins => r.estimated_duration_minutes)) > p_start
  ) INTO v_overlap;
  RETURN v_overlap;
END;
$$;

-- 原子報名 RPC
CREATE OR REPLACE FUNCTION pwa_register_for_run(p_run_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_run pwa_runs%ROWTYPE;
  v_user pwa_users%ROWTYPE;
  v_count INT;
  v_end TIMESTAMPTZ;
  v_existing pwa_run_participants%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM pwa_users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'USER_NOT_FOUND');
  END IF;
  IF v_user.is_banned THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BANNED');
  END IF;

  SELECT * INTO v_run FROM pwa_runs WHERE id = p_run_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'RUN_NOT_FOUND');
  END IF;
  IF v_run.status NOT IN ('open', 'delayed', 'ongoing') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'RUN_CLOSED');
  END IF;
  IF v_run.host_id = p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'IS_HOST');
  END IF;

  IF EXISTS (
    SELECT 1 FROM pwa_host_blocklists
    WHERE host_id = v_run.host_id AND blocked_user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BLOCKED');
  END IF;

  SELECT * INTO v_existing
  FROM pwa_run_participants
  WHERE run_id = p_run_id AND user_id = p_user_id;

  IF FOUND AND v_existing.status IN ('registered', 'arrived', 'attended') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_REGISTERED');
  END IF;

  v_end := v_run.start_time + make_interval(mins => v_run.estimated_duration_minutes);
  IF pwa_user_has_time_overlap(p_user_id, v_run.start_time, v_end, p_run_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TIME_OVERLAP');
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM pwa_run_participants
  WHERE run_id = p_run_id AND status IN ('registered', 'arrived', 'attended');

  IF v_count >= v_run.max_participants THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FULL');
  END IF;

  IF FOUND AND v_existing.status = 'cancelled' THEN
    UPDATE pwa_run_participants
    SET status = 'registered', arrived_at = NULL, updated_at = NOW()
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO pwa_run_participants (run_id, user_id, status)
    VALUES (p_run_id, p_user_id, 'registered');
  END IF;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FULL');
END;
$$;

-- 惡意取消計票後自動停權（僅 member）
CREATE OR REPLACE FUNCTION pwa_apply_malicious_cancel_ban(p_host_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_role VARCHAR(20);
  v_count INT;
BEGIN
  SELECT role INTO v_role FROM pwa_users WHERE id = p_host_id;
  IF v_role IS DISTINCT FROM 'member' THEN
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT r.id) INTO v_count
  FROM pwa_runs r
  WHERE r.host_id = p_host_id
    AND r.status = 'cancelled'
    AND r.created_at >= NOW() - INTERVAL '30 days'
    AND EXISTS (
      SELECT 1 FROM pwa_run_cancellation_votes v
      WHERE v.run_id = r.id AND v.is_malicious = TRUE
    );

  IF v_count >= 3 THEN
    UPDATE pwa_users SET is_banned = TRUE, updated_at = NOW() WHERE id = p_host_id;
  END IF;
END;
$$;

-- 種子：板橋常見集合點（可後台再改）
INSERT INTO pwa_locations (city, district, title, description)
SELECT * FROM (VALUES
  ('新北市', '板橋區', '板橋車站西側出口', '捷運／台鐵板橋站西側'),
  ('新北市', '板橋區', '縣民大道自行車道起點', '縣民大道一段附近'),
  ('新北市', '板橋區', '大漢橋下廣場', '大漢橋板橋端'),
  ('新北市', '板橋區', '江子翠捷運站', '板南線江子翠站')
) AS v(city, district, title, description)
WHERE NOT EXISTS (SELECT 1 FROM pwa_locations LIMIT 1);

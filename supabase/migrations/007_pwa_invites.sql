-- 邀請／魔法登入連結：無 LINE 開通與救援回登
-- 於 Supabase SQL Editor 執行本檔

-- 1. 邀請開通者可無 LINE UID（仍維持非空值唯一）
ALTER TABLE pwa_users
  ALTER COLUMN line_uid DROP NOT NULL;

-- 2. 邀請／登入 token（只存 hash）
CREATE TABLE IF NOT EXISTS pwa_invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('register', 'login')),
  user_id UUID REFERENCES pwa_users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES pwa_users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_invite_login_has_user CHECK (
    purpose <> 'login' OR user_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_pwa_invite_tokens_created
  ON pwa_invite_tokens (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pwa_invite_tokens_user
  ON pwa_invite_tokens (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE pwa_invite_tokens ENABLE ROW LEVEL SECURITY;

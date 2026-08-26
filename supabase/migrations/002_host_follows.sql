-- 追蹤主揪：追蹤者收到該主揪開團推播時略過配速過濾
CREATE TABLE IF NOT EXISTS pwa_host_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES pwa_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_follower_host UNIQUE (follower_id, host_id),
  CONSTRAINT chk_not_self_follow CHECK (follower_id <> host_id)
);

CREATE INDEX IF NOT EXISTS idx_pwa_host_follows_host ON pwa_host_follows(host_id);
CREATE INDEX IF NOT EXISTS idx_pwa_host_follows_follower ON pwa_host_follows(follower_id);

ALTER TABLE pwa_host_follows ENABLE ROW LEVEL SECURITY;

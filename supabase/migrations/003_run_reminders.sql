-- 開跑前提醒：一天前、六小時前（一小時前沿用 start_reminder_sent_at）
ALTER TABLE pwa_runs
  ADD COLUMN IF NOT EXISTS reminder_1d_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_6h_sent_at TIMESTAMPTZ;

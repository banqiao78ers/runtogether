-- 進行中仍可報名；僅 completed / cancelled 關閉報名
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

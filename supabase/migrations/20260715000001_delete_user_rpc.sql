-- delete_user_account: raderar ALL användardata + auth-posten i ett anrop.
-- Körs med SECURITY DEFINER så funktionen kan ta bort från auth.users.
-- Klienten har inte delete-rättigheter på auth.users direkt.

CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- task_completions refererar daily_logs via FK, men vi raderar explicit
  DELETE FROM task_completions
    WHERE daily_log_id IN (
      SELECT id FROM daily_logs WHERE user_id = _uid
    );

  DELETE FROM daily_logs            WHERE user_id = _uid;
  DELETE FROM workout_completions   WHERE user_id = _uid;

  -- session_exercises kaskadas av FK om ON DELETE CASCADE finns,
  -- annars raderar vi explicit
  DELETE FROM session_exercises
    WHERE session_id IN (
      SELECT id FROM workout_sessions WHERE user_id = _uid
    );

  DELETE FROM workout_sessions      WHERE user_id = _uid;
  DELETE FROM task_templates        WHERE user_id = _uid;
  DELETE FROM user_schedules        WHERE user_id = _uid;
  DELETE FROM user_challenges       WHERE user_id = _uid;
  DELETE FROM quiz_results          WHERE user_id = _uid;
  DELETE FROM progress_photos       WHERE user_id = _uid;
  DELETE FROM profiles              WHERE id      = _uid;

  -- Sist: ta bort själva auth-posten
  DELETE FROM auth.users            WHERE id      = _uid;
END;
$$;

REVOKE ALL ON FUNCTION delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;

-- ANDRAS STREAK: atletprofilen visar streak i stället för totalt km.
-- daily_logs är privata (RLS), så siffran hämtas via definer-RPC gated av
-- samma synlighetsregel som statistiken (can_view_workouts_of). Klienten
-- skickar sitt lokala datum så midnatt inte slår fel över tidszoner.

CREATE OR REPLACE FUNCTION get_streak_of(target UUID, today DATE)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  cid UUID;
  streak INT := 0;
  check_date DATE := today;
BEGIN
  IF NOT can_view_workouts_of(target) THEN
    RETURN 0;
  END IF;
  SELECT id INTO cid FROM user_challenges
  WHERE user_id = target AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  IF cid IS NULL THEN
    RETURN 0;
  END IF;
  -- Är dagens dag inte klarad än räknas svansen från igår (som i appen)
  IF NOT EXISTS (
    SELECT 1 FROM daily_logs
    WHERE challenge_id = cid AND date = today AND status = 'completed'
  ) THEN
    check_date := today - 1;
  END IF;
  WHILE streak < 75 LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM daily_logs
      WHERE challenge_id = cid AND date = check_date AND status = 'completed'
    );
    streak := streak + 1;
    check_date := check_date - 1;
  END LOOP;
  RETURN streak;
END $$;

REVOKE ALL ON FUNCTION get_streak_of(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_streak_of(UUID, DATE) TO authenticated;

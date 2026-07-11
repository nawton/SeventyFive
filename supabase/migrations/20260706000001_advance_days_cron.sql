-- =============================================================================
-- AUTOMATISK DAGS-FRAMSTEG FÖR AKTIVA UTMANINGAR
--
-- Kör varje natt 00:00 Stockholm-tid (22:00 UTC sommartid, 23:00 UTC vintertid).
-- Beräknar rätt current_day från start_date och markerar avklarade utmaningar.
--
-- Kräver att pg_cron är aktiverat i Supabase-projektet:
--   Dashboard → Database → Extensions → pg_cron → Enable
-- =============================================================================

-- SQL-funktion som uppdaterar alla aktiva utmaningar
CREATE OR REPLACE FUNCTION advance_challenge_days()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ch          RECORD;
  new_day     INT;
  updated_cnt INT := 0;
  completed_cnt INT := 0;
BEGIN
  FOR ch IN
    SELECT id, start_date
    FROM user_challenges
    WHERE status = 'active'
  LOOP
    -- Dagar sedan start (dag 1 = startdagen själv)
    new_day := LEAST(
      (CURRENT_DATE - ch.start_date::date)::int + 1,
      75
    );

    UPDATE user_challenges
    SET
      current_day = new_day,
      status = CASE WHEN new_day >= 75 THEN 'completed' ELSE 'active' END
    WHERE id = ch.id;

    updated_cnt := updated_cnt + 1;
    IF new_day >= 75 THEN
      completed_cnt := completed_cnt + 1;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'updated', updated_cnt,
    'completed', completed_cnt,
    'ran_at', now()
  );
END;
$$;

-- Ge service-rollen rätt att köra funktionen
GRANT EXECUTE ON FUNCTION advance_challenge_days() TO service_role;

-- Schemalägg som pg_cron-jobb (22:00 UTC ≈ 00:00 CEST sommartid)
-- OBS: ta bort eventuellt gammalt jobb med samma namn först
SELECT cron.unschedule('advance-challenge-days') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'advance-challenge-days'
);

SELECT cron.schedule(
  'advance-challenge-days',
  '0 22 * * *',
  'SELECT advance_challenge_days()'
);

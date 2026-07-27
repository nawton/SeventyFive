-- =============================================================================
-- DEMODATA FÖR SKÄRMBILDER
--
-- Fyller ETT dedikerat demokonto med 6 veckor träningshistorik: aktiv
-- Hard-utmaning på dag 42 med full streak, ~25 GPS-spårade cardiopass i Åre,
-- ~18 gymdagar med progressiv volym, veckoschema med avbockade övningar
-- (muskelkartan), en grupp med medlemmar och inlägg, följare, gillamarkeringar
-- och kommentarer.
--
-- SÅ KÖR DU:
--   1. Skapa ett nytt konto i appen (t.ex. demo@nawton.net) och logga in en gång.
--   2. Fyll i e-postadresserna i variablerna direkt nedanför.
--   3. Klistra in HELA filen i Supabase-panelen → SQL Editor → Run.
--   4. Logga in som demokontot i appen och ta skärmbilderna.
--
-- VARNING: skriptet RENSAR demokontots pass, utmaningar och scheman innan det
-- fyller på, så kör det ALDRIG med din riktiga e-post. Vännernas konton får
-- bara följen/medlemskap/gillamarkeringar, deras data rörs inte.
-- Skriptet går att köra om, det städar och bygger upp igen.
-- =============================================================================

DO $$
DECLARE
  -- ▼▼▼ FYLL I DESSA ▼▼▼
  demo_email    TEXT   := 'demo@nawton.net';
  demo_name     TEXT   := 'Elin Berg';
  friend_emails TEXT[] := ARRAY['anton.wretenberg04@outlook.com'];  -- test-/vänkonton som redan finns
  -- ▲▲▲ FYLL I DESSA ▲▲▲

  uid        UUID;
  friend_ids UUID[];
  fid        UUID;
  lvl_id     UUID;
  ch_id      UUID;
  dl_id      UUID;
  grp_id     UUID;
  sess_upper UUID;
  sess_lower UUID;
  sess_full  UUID;
  d          INT;
  day_date   DATE;
  wd         INT;
  wk         INT;
  dist       NUMERIC;
  dur        INT;
  run_route  JSONB;
  post_keys  TEXT[];
  start_d    DATE := CURRENT_DATE - 41;   -- dag 1 för 41 dagar sedan → idag är dag 42

  -- Två rundor i Åre: strandpromenaden runt och upp mot Totten
  route_strand JSONB := '[[63.3991,13.0810],[63.3985,13.0768],[63.3979,13.0724],[63.3975,13.0678],[63.3978,13.0632],[63.3986,13.0596],[63.3998,13.0570],[63.4012,13.0558],[63.4026,13.0566],[63.4036,13.0592],[63.4041,13.0630],[63.4043,13.0676],[63.4041,13.0724],[63.4036,13.0772],[63.4029,13.0818],[63.4022,13.0862],[63.4016,13.0906],[63.4012,13.0948],[63.4010,13.0990],[63.4006,13.1030],[63.4000,13.1064],[63.3993,13.1040],[63.3989,13.0996],[63.3988,13.0950],[63.3989,13.0902],[63.3990,13.0856],[63.3991,13.0810]]'::jsonb;
  route_totten JSONB := '[[63.3990,13.0806],[63.4002,13.0792],[63.4016,13.0780],[63.4030,13.0770],[63.4044,13.0762],[63.4058,13.0756],[63.4072,13.0752],[63.4086,13.0750],[63.4100,13.0752],[63.4112,13.0760],[63.4120,13.0776],[63.4114,13.0796],[63.4102,13.0810],[63.4088,13.0820],[63.4074,13.0826],[63.4060,13.0828],[63.4046,13.0826],[63.4032,13.0822],[63.4018,13.0816],[63.4004,13.0810],[63.3990,13.0806]]'::jsonb;
BEGIN
  -- ── Slå upp kontona ─────────────────────────────────────────────────────────
  SELECT id INTO uid FROM auth.users WHERE email = demo_email;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Hittar inget konto med e-posten %. Skapa kontot i appen först.', demo_email;
  END IF;

  SELECT COALESCE(array_agg(id), '{}') INTO friend_ids
  FROM auth.users WHERE email = ANY(friend_emails);
  IF COALESCE(array_length(friend_ids, 1), 0) < COALESCE(array_length(friend_emails, 1), 0) THEN
    RAISE NOTICE 'Obs: alla vänkonton hittades inte, fortsätter med de som finns.';
  END IF;

  -- ── Städa demokontots gamla data (bara demokontot!) ─────────────────────────
  DELETE FROM user_workouts     WHERE user_id = uid;
  DELETE FROM user_challenges   WHERE user_id = uid;   -- daily_logs + task_completions följer med via CASCADE
  DELETE FROM workout_sessions  WHERE user_id = uid;   -- session_exercises + completions via CASCADE
  DELETE FROM groups            WHERE owner_id = uid AND name = 'Team Åre';

  UPDATE profiles SET name = demo_name WHERE id = uid;

  -- ── Utmaningen: Hard, dag 42, felfri streak ────────────────────────────────
  SELECT id INTO lvl_id FROM challenge_levels WHERE slug = 'hard';
  INSERT INTO user_challenges (user_id, level_id, start_date, current_day, status)
  VALUES (uid, lvl_id, start_d, 42, 'active')
  RETURNING id INTO ch_id;

  FOR d IN 1..41 LOOP
    day_date := start_d + (d - 1);
    INSERT INTO daily_logs (challenge_id, user_id, day_number, date, status, completed_at)
    VALUES (ch_id, uid, d, day_date, 'completed', day_date + TIME '21:30')
    RETURNING id INTO dl_id;

    INSERT INTO task_completions (daily_log_id, task_template_id, completed)
    SELECT dl_id, tt.id, TRUE FROM task_templates tt WHERE tt.level_id = lvl_id;
  END LOOP;

  -- ── Cardio: löprundor, cykel och promenader över sex veckor ────────────────
  FOR d IN 1..41 LOOP
    day_date := start_d + (d - 1);
    wd := EXTRACT(ISODOW FROM day_date);
    wk := ((d - 1) / 7) + 1;

    IF wd IN (2, 6) THEN
      -- Löprunda: distansen växer sakta vecka för vecka
      dist := ROUND((4.0 + wk * 0.55 + (d % 3) * 0.4)::numeric, 2);
      dur  := ROUND(dist * (352 - wk * 4));   -- tempot förbättras med veckorna
      run_route := CASE WHEN d % 4 = 0 THEN route_totten ELSE route_strand END;
      INSERT INTO user_workouts (user_id, name, is_favorite, exercises, created_at)
      VALUES (uid, CASE WHEN wd = 6 THEN 'Långpass' ELSE 'Löpning' END, FALSE, jsonb_build_array(jsonb_build_object(
        'category', 'cardio', 'type', 'running',
        'distance_km', dist, 'duration_seconds', dur,
        'calories', ROUND(dist * 68), 'route', run_route, 'effort', 3 + (d % 3)
      )), day_date + TIME '18:05');
    ELSIF wd = 4 THEN
      -- Cykeltur varje torsdag
      dist := ROUND((14 + wk * 1.6)::numeric, 2);
      INSERT INTO user_workouts (user_id, name, is_favorite, exercises, created_at)
      VALUES (uid, 'Cykling', FALSE, jsonb_build_array(jsonb_build_object(
        'category', 'cardio', 'type', 'cycling',
        'distance_km', dist, 'duration_seconds', ROUND(dist * 150),
        'calories', ROUND(dist * 26), 'route', route_strand, 'effort', 3
      )), day_date + TIME '17:40');
    ELSIF wd = 7 THEN
      -- Promenad varje söndag
      INSERT INTO user_workouts (user_id, name, is_favorite, exercises, created_at)
      VALUES (uid, 'Promenad', FALSE, jsonb_build_array(jsonb_build_object(
        'category', 'cardio', 'type', 'walking',
        'distance_km', 4.2, 'duration_seconds', 3120,
        'calories', 210, 'route', route_totten, 'effort', 2
      )), day_date + TIME '11:15');
    END IF;

    -- ── Gym mån/ons/fre med progressiv överbelastning ────────────────────────
    IF wd IN (1, 3, 5) THEN
      INSERT INTO user_workouts (user_id, name, is_favorite, exercises, created_at)
      SELECT uid, ex.exercise_name, FALSE, jsonb_build_array(jsonb_build_object(
        'category', 'strength',
        'exercise_id', COALESCE((SELECT e.id::text FROM exercises e WHERE e.name = ex.exercise_name LIMIT 1), gen_random_uuid()::text),
        'exercise_name', ex.exercise_name,
        'sets', ex.sets,
        'workout_date', to_char(day_date, 'YYYY-MM-DD')
      )), day_date + TIME '07:20' + (ex.ord || ' minutes')::interval
      FROM (VALUES
        -- Måndag: överkropp / Onsdag: underkropp / Fredag: helkropp
        (1, 1, 'Bänkpress',  jsonb_build_array(jsonb_build_object('reps', 8, 'weight_kg', 55 + wk * 2.5), jsonb_build_object('reps', 8, 'weight_kg', 55 + wk * 2.5), jsonb_build_object('reps', 6, 'weight_kg', 60 + wk * 2.5))),
        (1, 2, 'Hantelrodd', jsonb_build_array(jsonb_build_object('reps', 10, 'weight_kg', 26 + wk), jsonb_build_object('reps', 10, 'weight_kg', 26 + wk), jsonb_build_object('reps', 8, 'weight_kg', 28 + wk))),
        (1, 3, 'Axelpress',  jsonb_build_array(jsonb_build_object('reps', 10, 'weight_kg', 30 + wk), jsonb_build_object('reps', 8, 'weight_kg', 32 + wk))),
        (1, 4, 'Bicepscurl', jsonb_build_array(jsonb_build_object('reps', 12, 'weight_kg', 12 + wk * 0.5), jsonb_build_object('reps', 10, 'weight_kg', 14 + wk * 0.5))),
        (3, 1, 'Knäböj',     jsonb_build_array(jsonb_build_object('reps', 6, 'weight_kg', 75 + wk * 3), jsonb_build_object('reps', 6, 'weight_kg', 75 + wk * 3), jsonb_build_object('reps', 5, 'weight_kg', 82 + wk * 3))),
        (3, 2, 'Marklyft',   jsonb_build_array(jsonb_build_object('reps', 5, 'weight_kg', 95 + wk * 3.5), jsonb_build_object('reps', 5, 'weight_kg', 100 + wk * 3.5))),
        (3, 3, 'Utfall',     jsonb_build_array(jsonb_build_object('reps', 12, 'weight_kg', 16 + wk), jsonb_build_object('reps', 12, 'weight_kg', 16 + wk))),
        (5, 1, 'Bänkpress',  jsonb_build_array(jsonb_build_object('reps', 10, 'weight_kg', 50 + wk * 2), jsonb_build_object('reps', 10, 'weight_kg', 50 + wk * 2))),
        (5, 2, 'Knäböj',     jsonb_build_array(jsonb_build_object('reps', 8, 'weight_kg', 70 + wk * 2.5), jsonb_build_object('reps', 8, 'weight_kg', 70 + wk * 2.5))),
        (5, 3, 'Latsdrag',   jsonb_build_array(jsonb_build_object('reps', 10, 'weight_kg', 45 + wk), jsonb_build_object('reps', 10, 'weight_kg', 45 + wk))),
        (5, 4, 'Plankan',    jsonb_build_array(jsonb_build_object('reps', 60, 'weight_kg', 0), jsonb_build_object('reps', 45, 'weight_kg', 0)))
      ) AS ex(gday, ord, exercise_name, sets)
      WHERE ex.gday = wd;
    END IF;
  END LOOP;

  -- ── Veckoschema + avbockade övningar (fyller muskelkartan) ─────────────────
  INSERT INTO workout_sessions (user_id, name, weekdays, sort_order)
  VALUES (uid, 'Överkropp', '{1}', 0) RETURNING id INTO sess_upper;
  INSERT INTO workout_sessions (user_id, name, weekdays, sort_order)
  VALUES (uid, 'Underkropp', '{3}', 1) RETURNING id INTO sess_lower;
  INSERT INTO workout_sessions (user_id, name, weekdays, sort_order)
  VALUES (uid, 'Helkropp', '{5}', 2) RETURNING id INTO sess_full;

  INSERT INTO session_exercises (session_id, exercise_name, sets, reps, sort_order)
  VALUES
    (sess_upper, 'Bänkpress', 3, '8', 0),
    (sess_upper, 'Hantelrodd', 3, '10', 1),
    (sess_upper, 'Axelpress', 2, '10', 2),
    (sess_upper, 'Bicepscurl', 2, '12', 3),
    (sess_lower, 'Knäböj', 3, '6', 0),
    (sess_lower, 'Marklyft', 2, '5', 1),
    (sess_lower, 'Utfall', 2, '12', 2),
    (sess_full, 'Bänkpress', 2, '10', 0),
    (sess_full, 'Knäböj', 2, '8', 1),
    (sess_full, 'Latsdrag', 2, '10', 2),
    (sess_full, 'Plankan', 2, '60 sek', 3);

  -- Bocka av schemats övningar på gymdagarna de senaste två veckorna
  FOR d IN 0..13 LOOP
    day_date := CURRENT_DATE - d;
    wd := EXTRACT(ISODOW FROM day_date);
    IF wd IN (1, 3, 5) THEN
      INSERT INTO exercise_completions (exercise_id, user_id, completed_date)
      SELECT se.id, uid, day_date
      FROM session_exercises se
      JOIN workout_sessions ws ON ws.id = se.session_id
      WHERE ws.user_id = uid AND wd = ANY(ws.weekdays)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RAISE NOTICE 'Träningsdata klar: utmaning, dagar, cardio, gym och schema.';

  -- ── Gruppen: Team Åre med vänner, topplista och inlägg ─────────────────────
  BEGIN
  INSERT INTO groups (owner_id, name, description, sport, tags, is_private, location)
  VALUES (uid, 'Team Åre', 'Vi kör 75 dagar tillsammans. Alla pass räknas, ingen lämnas kvar.', 'all', '{Löpning,Gym}', FALSE, 'Åre')
  RETURNING id INTO grp_id;

  INSERT INTO group_members (group_id, user_id, role, status) VALUES (grp_id, uid, 'owner', 'accepted')
  ON CONFLICT DO NOTHING;
  FOREACH fid IN ARRAY friend_ids LOOP
    INSERT INTO group_members (group_id, user_id, status, invited_by)
    VALUES (grp_id, fid, 'accepted', uid)
    ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO group_posts (group_id, author_id, body, pinned, created_at)
  VALUES (grp_id, uid, 'Vecka 6 avklarad! Nu är vi fler än någonsin, kom ihåg långpasset på lördag.', TRUE, NOW() - INTERVAL '26 hours');
  IF array_length(friend_ids, 1) >= 1 THEN
    INSERT INTO group_posts (group_id, author_id, body, created_at)
    VALUES (grp_id, friend_ids[1], 'Grym vecka allihop! Vem hänger med på Totten på söndag?', NOW() - INTERVAL '3 hours');
  END IF;

  -- ── Följen, gillamarkeringar och kommentarer ───────────────────────────────
  SELECT array_agg(id::text ORDER BY created_at DESC) INTO post_keys
  FROM (SELECT id, created_at FROM user_workouts
        WHERE user_id = uid AND exercises->0->>'category' = 'cardio'
        ORDER BY created_at DESC LIMIT 3) w;

  FOREACH fid IN ARRAY friend_ids LOOP
    INSERT INTO follows (follower_id, followee_id) VALUES (fid, uid) ON CONFLICT DO NOTHING;
    INSERT INTO follows (follower_id, followee_id) VALUES (uid, fid) ON CONFLICT DO NOTHING;
    IF post_keys IS NOT NULL THEN
      INSERT INTO post_likes (post_key, owner_id, liker_id)
      SELECT pk, uid, fid FROM unnest(post_keys) pk
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  IF post_keys IS NOT NULL AND array_length(friend_ids, 1) >= 1 THEN
    INSERT INTO post_comments (post_key, owner_id, author_id, body)
    VALUES (post_keys[1], uid, friend_ids[1], 'Grym fart, sista kilometern var snabbast!');
  END IF;
  RAISE NOTICE 'Social data klar: grupp, medlemmar, följen och gillamarkeringar.';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Sociala delen hoppades över (%). Träningsdatan är ändå sparad.', SQLERRM;
  END;

  RAISE NOTICE 'Klart! Demokontot % är fyllt: utmaning dag 42, % pass, grupp Team Åre med % medlemmar.',
    demo_email,
    (SELECT COUNT(*) FROM user_workouts WHERE user_id = uid),
    1 + COALESCE(array_length(friend_ids, 1), 0);
END $$;

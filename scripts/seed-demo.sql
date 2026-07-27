-- =============================================================================
-- DEMODATA FÖR SKÄRMBILDER
--
-- Fyller ETT dedikerat demokonto med 6 veckor träningshistorik: aktiv
-- Hard-utmaning på dag 42 med full streak, ~25 GPS-spårade cardiopass i
-- Stockholm, ~18 gymdagar med naturligt böljande volym (deload-veckor),
-- veckoschema med avbockade övningar (muskelkartan), en grupp med medlemmar
-- och inlägg, följare, gillamarkeringar och kommentarer.
--
-- SÅ KÖR DU:
--   1. Skapa ett nytt konto i appen (t.ex. demo@nawton.net) och logga in en gång.
--   2. Fyll i e-postadresserna i variablerna direkt nedanför.
--   3. Klistra in HELA filen i Supabase-panelen → SQL Editor → Run.
--   4. Logga ut och in som demokontot i appen och ta skärmbilderna.
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
  wfac       NUMERIC;   -- veckans formkurva: upp, ner (deload), upp igen
  dist       NUMERIC;
  dur        INT;
  run_route  JSONB;
  post_keys  TEXT[];
  start_d    DATE := CURRENT_DATE - 41;   -- dag 1 för 41 dagar sedan → idag är dag 42

  -- Två riktiga rundor i Stockholm (OSRM längs gatunätet):
  -- Djurgården runt 7,0 km och Rålambshov/Norr Mälarstrand 4,1 km
  route_djurg JSONB := '[[59.33251,18.09538],[59.33244,18.09350],[59.33194,18.09384],[59.33168,18.09386],[59.33154,18.09377],[59.33088,18.09414],[59.32961,18.09541],[59.32885,18.09629],[59.32820,18.09679],[59.32809,18.09692],[59.32801,18.09718],[59.32755,18.09680],[59.32736,18.09667],[59.32698,18.09648],[59.32661,18.09637],[59.32614,18.09667],[59.32576,18.09697],[59.32547,18.09722],[59.32501,18.09759],[59.32452,18.09824],[59.32434,18.09866],[59.32423,18.09853],[59.32403,18.09898],[59.32379,18.09976],[59.32339,18.10075],[59.32291,18.10146],[59.32228,18.10212],[59.32169,18.10190],[59.32151,18.10179],[59.32083,18.10209],[59.32155,18.10175],[59.32214,18.10213],[59.32257,18.10174],[59.32298,18.10179],[59.32299,18.10237],[59.32313,18.10301],[59.32312,18.10350],[59.32322,18.10402],[59.32320,18.10443],[59.32322,18.10489],[59.32332,18.10484],[59.32318,18.10688],[59.32320,18.10778],[59.32345,18.10901],[59.32377,18.10997],[59.32398,18.11031],[59.32415,18.11047],[59.32418,18.11080],[59.32414,18.11125],[59.32345,18.11343],[59.32345,18.11397],[59.32383,18.11632],[59.32396,18.11713],[59.32397,18.11783],[59.32381,18.11890],[59.32331,18.12160],[59.32295,18.12378],[59.32293,18.12436],[59.32334,18.12363],[59.32411,18.12292],[59.32416,18.12411],[59.32451,18.12607],[59.32470,18.12815],[59.32493,18.12929],[59.32482,18.13064],[59.32527,18.13133],[59.32574,18.13121],[59.32600,18.13135],[59.32617,18.13203],[59.32631,18.13280],[59.32646,18.13303],[59.32646,18.13349],[59.32693,18.13336],[59.32746,18.13317],[59.32862,18.13246],[59.32923,18.13205],[59.32940,18.13199],[59.32954,18.13204],[59.32990,18.13240],[59.33014,18.13117],[59.33032,18.13028],[59.33045,18.12950],[59.33068,18.12910],[59.33082,18.12886],[59.33092,18.12832],[59.33125,18.12739],[59.33156,18.12633],[59.33157,18.12574],[59.33129,18.12448],[59.33113,18.12355],[59.33114,18.12254],[59.33118,18.12001],[59.33115,18.11829],[59.33179,18.11562],[59.33197,18.11483],[59.33212,18.11364],[59.33223,18.11266],[59.33244,18.11118],[59.33263,18.11017],[59.33291,18.10952],[59.33292,18.10845],[59.33297,18.10709],[59.33310,18.10375],[59.33311,18.10303],[59.33266,18.10088],[59.33273,18.10008],[59.33292,18.09913],[59.33294,18.09843],[59.33288,18.09794],[59.33270,18.09742],[59.33236,18.09695],[59.33244,18.09668],[59.33226,18.09644],[59.33251,18.09538]]'::jsonb;
  route_malar JSONB := '[[59.32680,18.04800],[59.32679,18.04733],[59.32678,18.04713],[59.32676,18.04642],[59.32675,18.04597],[59.32683,18.04578],[59.32684,18.04354],[59.32685,18.04243],[59.32686,18.04226],[59.32686,18.04178],[59.32688,18.04162],[59.32684,18.04157],[59.32700,18.04056],[59.32733,18.03831],[59.32778,18.03537],[59.32781,18.03525],[59.32783,18.03508],[59.32777,18.03499],[59.32762,18.03491],[59.32757,18.03476],[59.32760,18.03439],[59.32765,18.03401],[59.32764,18.03350],[59.32765,18.03325],[59.32773,18.03285],[59.32783,18.03235],[59.32785,18.03203],[59.32792,18.03168],[59.32800,18.03135],[59.32806,18.03097],[59.32809,18.03061],[59.32816,18.02988],[59.32825,18.02941],[59.32843,18.02855],[59.32851,18.02814],[59.32891,18.02671],[59.32905,18.02589],[59.32919,18.02570],[59.32935,18.02534],[59.32945,18.02502],[59.32946,18.02488],[59.32944,18.02451],[59.32944,18.02432],[59.32949,18.02413],[59.33010,18.02286],[59.33023,18.02226],[59.33029,18.02184],[59.33026,18.02161],[59.33008,18.02129],[59.33005,18.02114],[59.33015,18.02034],[59.33045,18.01938],[59.33073,18.01897],[59.33081,18.01891],[59.33081,18.01891],[59.33123,18.01888],[59.33132,18.01915],[59.33124,18.01954],[59.33124,18.01975],[59.33129,18.02004],[59.33139,18.02030],[59.33152,18.02044],[59.33160,18.02090],[59.33170,18.02352],[59.33168,18.02378],[59.33167,18.02423],[59.33169,18.02446],[59.33170,18.02526],[59.33172,18.02624],[59.33174,18.02670],[59.33163,18.02735],[59.33157,18.02779],[59.33155,18.02793],[59.33168,18.02836],[59.33166,18.02850],[59.33166,18.02859],[59.33128,18.03050],[59.33130,18.03065],[59.33160,18.03100],[59.33126,18.03093],[59.33120,18.03097],[59.33111,18.03097],[59.33101,18.03089],[59.33093,18.03084],[59.33080,18.03128],[59.33071,18.03137],[59.33053,18.03217],[59.33046,18.03222],[59.33040,18.03226],[59.33005,18.03209],[59.32972,18.03224],[59.32945,18.03245],[59.32893,18.03302],[59.32827,18.03262],[59.32801,18.03391],[59.32783,18.03508],[59.32781,18.03525],[59.32778,18.03537],[59.32733,18.03831],[59.32700,18.04056],[59.32684,18.04157],[59.32688,18.04162],[59.32686,18.04178],[59.32686,18.04226],[59.32685,18.04243],[59.32684,18.04354],[59.32683,18.04578],[59.32675,18.04597],[59.32676,18.04642],[59.32678,18.04713],[59.32679,18.04733],[59.32680,18.04800]]'::jsonb;
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
  DELETE FROM groups            WHERE owner_id = uid AND name IN ('Team Åre', 'Team Sthlm');

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

  -- ── Cardio och gym över sex veckor, med form som böljar ────────────────────
  FOR d IN 1..41 LOOP
    day_date := start_d + (d - 1);
    wd := EXTRACT(ISODOW FROM day_date);
    wk := ((d - 1) / 7) + 1;
    -- Vecka 1 lugn start, vecka 3 tung, vecka 4 deload, sen uppåt igen
    wfac := (ARRAY[0.0, 2.0, 3.4, 1.2, 3.0, 4.6])[wk];

    IF wd IN (2, 6) THEN
      -- Löprunda: distans och tempo följer formkurvan, med dagsvariation
      dist := ROUND((4.2 + wfac * 0.65 + (d % 3) * 0.5 - CASE WHEN d % 7 = 0 THEN 0.8 ELSE 0 END)::numeric, 2);
      dur  := ROUND(dist * (354 - wfac * 6 - (d % 4) * 3));
      run_route := CASE WHEN d % 4 = 0 THEN route_malar ELSE route_djurg END;
      INSERT INTO user_workouts (user_id, name, is_favorite, exercises, created_at)
      VALUES (uid, CASE WHEN wd = 6 THEN 'Långpass' ELSE 'Löpning' END, FALSE, jsonb_build_array(jsonb_build_object(
        'category', 'cardio', 'type', 'running',
        'distance_km', dist, 'duration_seconds', dur,
        'calories', ROUND(dist * 68), 'route', run_route, 'effort', 3 + (d % 3)
      )), day_date + TIME '18:05');
    ELSIF wd = 4 THEN
      -- Cykeltur varje torsdag
      dist := ROUND((13 + wfac * 1.8 + (d % 2) * 2)::numeric, 2);
      INSERT INTO user_workouts (user_id, name, is_favorite, exercises, created_at)
      VALUES (uid, 'Cykling', FALSE, jsonb_build_array(jsonb_build_object(
        'category', 'cardio', 'type', 'cycling',
        'distance_km', dist, 'duration_seconds', ROUND(dist * 150),
        'calories', ROUND(dist * 26), 'route', route_djurg, 'effort', 3
      )), day_date + TIME '17:40');
    ELSIF wd = 7 THEN
      -- Promenad varje söndag
      INSERT INTO user_workouts (user_id, name, is_favorite, exercises, created_at)
      VALUES (uid, 'Promenad', FALSE, jsonb_build_array(jsonb_build_object(
        'category', 'cardio', 'type', 'walking',
        'distance_km', ROUND((3.6 + (d % 3) * 0.7)::numeric, 2), 'duration_seconds', 3120,
        'calories', 210, 'route', route_malar, 'effort', 2
      )), day_date + TIME '11:15');
    END IF;

    -- ── Gym mån/ons/fre: vikterna följer samma formkurva ─────────────────────
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
        (1, 1, 'Bänkpress',  jsonb_build_array(jsonb_build_object('reps', 8, 'weight_kg', 55 + wfac * 2.5), jsonb_build_object('reps', 8, 'weight_kg', 55 + wfac * 2.5), jsonb_build_object('reps', 6, 'weight_kg', 60 + wfac * 2.5))),
        (1, 2, 'Hantelrodd', jsonb_build_array(jsonb_build_object('reps', 10, 'weight_kg', 26 + wfac), jsonb_build_object('reps', 10, 'weight_kg', 26 + wfac), jsonb_build_object('reps', 8, 'weight_kg', 28 + wfac))),
        (1, 3, 'Axelpress',  jsonb_build_array(jsonb_build_object('reps', 10, 'weight_kg', 30 + wfac), jsonb_build_object('reps', 8, 'weight_kg', 32 + wfac))),
        (1, 4, 'Bicepscurl', jsonb_build_array(jsonb_build_object('reps', 12, 'weight_kg', 12 + wfac * 0.5), jsonb_build_object('reps', 10, 'weight_kg', 14 + wfac * 0.5))),
        (3, 1, 'Knäböj',     jsonb_build_array(jsonb_build_object('reps', 6, 'weight_kg', 75 + wfac * 3), jsonb_build_object('reps', 6, 'weight_kg', 75 + wfac * 3), jsonb_build_object('reps', 5, 'weight_kg', 82 + wfac * 3))),
        (3, 2, 'Marklyft',   jsonb_build_array(jsonb_build_object('reps', 5, 'weight_kg', 95 + wfac * 3.5), jsonb_build_object('reps', 5, 'weight_kg', 100 + wfac * 3.5))),
        (3, 3, 'Utfall',     jsonb_build_array(jsonb_build_object('reps', 12, 'weight_kg', 16 + wfac), jsonb_build_object('reps', 12, 'weight_kg', 16 + wfac))),
        (5, 1, 'Bänkpress',  jsonb_build_array(jsonb_build_object('reps', 10, 'weight_kg', 50 + wfac * 2), jsonb_build_object('reps', 10, 'weight_kg', 50 + wfac * 2))),
        (5, 2, 'Knäböj',     jsonb_build_array(jsonb_build_object('reps', 8, 'weight_kg', 70 + wfac * 2.5), jsonb_build_object('reps', 8, 'weight_kg', 70 + wfac * 2.5))),
        (5, 3, 'Latsdrag',   jsonb_build_array(jsonb_build_object('reps', 10, 'weight_kg', 45 + wfac), jsonb_build_object('reps', 10, 'weight_kg', 45 + wfac))),
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

  -- ── Gruppen: Team Sthlm med vänner, topplista och inlägg ───────────────────
  BEGIN
  INSERT INTO groups (owner_id, name, description, sport, tags, is_private, location)
  VALUES (uid, 'Team Sthlm', 'Vi kör 75 dagar tillsammans. Alla pass räknas, ingen lämnas kvar.', 'all', '{Löpning,Gym}', FALSE, 'Stockholm')
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
    VALUES (grp_id, friend_ids[1], 'Grym vecka allihop! Vem hänger med runt Djurgården på söndag?', NOW() - INTERVAL '3 hours');
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

  RAISE NOTICE 'Klart! Demokontot % är fyllt: utmaning dag 42, % pass, grupp Team Sthlm med % medlemmar.',
    demo_email,
    (SELECT COUNT(*) FROM user_workouts WHERE user_id = uid),
    1 + COALESCE(array_length(friend_ids, 1), 0);
END $$;

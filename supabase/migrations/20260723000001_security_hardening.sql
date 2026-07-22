-- Säkerhetshärdning (23 juli 2026), fyra delar:
-- 1) notify_push läser sin hemlighet ur Supabase Vault istället för
--    klartext i repot (gamla värdet är roterat och ogiltigt), och
--    sväljer push-fel så sociala inserts aldrig blockeras av pushen.
-- 2) Avatars-bucketen: bara ägaren kan ladda upp/ersätta SIN egen fil
--    (<user-id>.jpg) — tidigare kunde varje inloggad skriva över allas.
-- 3) Följares direktläsning av user_workouts stängs. Delade pass läses
--    numera enbart via funktionerna som strippar dold ruttdata — som
--    blir SECURITY DEFINER med exakt samma behörighetsregler som
--    policyn hade (godkänt följe + integritetsval + ej blockerad).
-- 4) Gillanden/kommentarer kan bara pekas på post_keys som faktiskt
--    tillhör ägaren — stoppar förfalskade pushnotiser.

-- ── 1. Push-hemligheten ur Vault ─────────────────────────────────────────────
-- Hemligheten skapas i Vault utanför migrationen (aldrig i repot):
--   SELECT vault.create_secret('<värde>', 'push_webhook_secret');

CREATE OR REPLACE FUNCTION notify_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  secret TEXT;
BEGIN
  SELECT decrypted_secret INTO secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret';

  PERFORM net.http_post(
    url     := 'https://vmnvtendcmnypcpwfuva.supabase.co/functions/v1/push-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', COALESCE(secret, '')
    ),
    body := jsonb_build_object(
      'table',  TG_TABLE_NAME,
      'op',     TG_OP,
      'record', to_jsonb(NEW)
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Pushen är best effort — den får aldrig fälla själva skrivningen
  RETURN NEW;
END $$;

-- ── 2. Avatars: ägarscopade skrivningar ──────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update avatars" ON storage.objects;

CREATE POLICY "Ägare laddar upp sin avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND name = auth.uid()::text || '.jpg');

CREATE POLICY "Ägare ersätter sin avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND name = auth.uid()::text || '.jpg')
  WITH CHECK (bucket_id = 'avatars' AND name = auth.uid()::text || '.jpg');

-- ── 3. Delade pass läses bara via strippande funktioner ─────────────────────
-- Samma regler som följar-policyn hade, samlade i en definer-hjälpare
CREATE OR REPLACE FUNCTION can_view_workouts_of(owner UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT auth.uid() = owner
    OR (
      privacy_allows_followers(owner)
      AND NOT is_blocked_pair(auth.uid(), owner)
      AND EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = auth.uid()
          AND f.followee_id = owner
          AND f.status = 'accepted'
      )
    );
$$;

REVOKE ALL ON FUNCTION can_view_workouts_of(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_view_workouts_of(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION get_feed(before TIMESTAMPTZ, page_size INT)
RETURNS TABLE (id UUID, user_id UUID, name TEXT, created_at TIMESTAMPTZ, exercises JSONB)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT w.id, w.user_id, w.name, w.created_at,
         visible_exercises(w.user_id, w.exercises)
  FROM user_workouts w
  WHERE w.created_at < before
    AND can_view_workouts_of(w.user_id)
  ORDER BY w.created_at DESC
  LIMIT LEAST(GREATEST(page_size, 1), 100);
$$;

CREATE OR REPLACE FUNCTION get_user_workouts(target UUID, max_rows INT)
RETURNS TABLE (id UUID, user_id UUID, name TEXT, created_at TIMESTAMPTZ, exercises JSONB)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT w.id, w.user_id, w.name, w.created_at,
         visible_exercises(w.user_id, w.exercises)
  FROM user_workouts w
  WHERE w.user_id = target
    AND can_view_workouts_of(target)
  ORDER BY w.created_at DESC
  LIMIT LEAST(GREATEST(max_rows, 1), 500);
$$;

CREATE OR REPLACE FUNCTION get_shared_workout(wid UUID)
RETURNS TABLE (id UUID, user_id UUID, name TEXT, created_at TIMESTAMPTZ, exercises JSONB)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT w.id, w.user_id, w.name, w.created_at,
         visible_exercises(w.user_id, w.exercises)
  FROM user_workouts w
  WHERE w.id = wid
    AND can_view_workouts_of(w.user_id);
$$;

-- Nu kan direktläsningen stängas — ägarens egen policy finns kvar
DROP POLICY IF EXISTS "Godkända följare läser pass" ON user_workouts;

-- ── 4. post_key måste tillhöra ägaren ────────────────────────────────────────
CREATE OR REPLACE FUNCTION post_key_belongs_to(key TEXT, owner UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE
    -- Gympass-nycklar: gym-<ägarid>-<datum>
    WHEN key LIKE 'gym-%' THEN key LIKE 'gym-' || owner::text || '-%'
    -- Cardionycklar: passets uuid, måste ägas av owner
    ELSE EXISTS (
      SELECT 1 FROM user_workouts w
      WHERE w.id::text = key AND w.user_id = owner
    )
  END;
$$;

REVOKE ALL ON FUNCTION post_key_belongs_to(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION post_key_belongs_to(TEXT, UUID) TO authenticated;

DROP POLICY "Man gillar som sig själv, pass man får se" ON post_likes;
CREATE POLICY "Man gillar som sig själv, pass man får se"
  ON post_likes FOR INSERT
  WITH CHECK (
    auth.uid() = liker_id
    AND can_view_workouts_of(owner_id)
    AND post_key_belongs_to(post_key, owner_id)
  );

DROP POLICY "Man kommenterar som sig själv, pass man får se" ON post_comments;
CREATE POLICY "Man kommenterar som sig själv, pass man får se"
  ON post_comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND can_view_workouts_of(owner_id)
    AND post_key_belongs_to(post_key, owner_id)
  );

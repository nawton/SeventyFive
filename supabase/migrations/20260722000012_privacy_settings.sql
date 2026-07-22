-- Integritetsinställningar: sökbarhet och aktivitetssynlighet. Allt
-- upprätthålls i databasen: search_profiles filtrerar bort osökbara,
-- och pass/gillanden/kommentarer släpps bara till följare om ägaren
-- delar sina aktiviteter ('followers'; 'private' = bara ägaren själv).
-- Profilvalet (auto-godkänn följare) finns redan som profiles.is_public.

ALTER TABLE profiles ADD COLUMN searchable BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN activity_visibility TEXT NOT NULL DEFAULT 'followers'
  CHECK (activity_visibility IN ('followers', 'private'));

-- SECURITY DEFINER: policies på andra tabeller måste kunna läsa ägarens
-- inställning trots att profiles-RLS bara visar egna rader
CREATE OR REPLACE FUNCTION privacy_allows_followers(owner UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT activity_visibility = 'followers' FROM profiles WHERE id = owner),
    TRUE
  );
$$;

REVOKE ALL ON FUNCTION privacy_allows_followers(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION privacy_allows_followers(UUID) TO authenticated;

-- Pass: följare ser dem bara om ägaren delar aktiviteter
DROP POLICY "Godkända följare läser pass" ON user_workouts;
CREATE POLICY "Godkända följare läser pass"
  ON user_workouts FOR SELECT
  USING (
    privacy_allows_followers(user_workouts.user_id)
    AND EXISTS (
      SELECT 1 FROM follows f
      WHERE f.follower_id = auth.uid()
        AND f.followee_id = user_workouts.user_id
        AND f.status = 'accepted'
    )
  );

-- Gillanden och kommentarer följer samma synlighet som passet
DROP POLICY "Gillanden syns för de som ser passet" ON post_likes;
CREATE POLICY "Gillanden syns för de som ser passet"
  ON post_likes FOR SELECT
  USING (
    auth.uid() = owner_id
    OR (
      privacy_allows_followers(owner_id)
      AND EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = auth.uid()
          AND f.followee_id = owner_id
          AND f.status = 'accepted'
      )
    )
  );

DROP POLICY "Man gillar som sig själv, pass man får se" ON post_likes;
CREATE POLICY "Man gillar som sig själv, pass man får se"
  ON post_likes FOR INSERT
  WITH CHECK (
    auth.uid() = liker_id
    AND (
      auth.uid() = owner_id
      OR (
        privacy_allows_followers(owner_id)
        AND EXISTS (
          SELECT 1 FROM follows f
          WHERE f.follower_id = auth.uid()
            AND f.followee_id = owner_id
            AND f.status = 'accepted'
        )
      )
    )
  );

DROP POLICY "Kommentarer syns för de som ser passet" ON post_comments;
CREATE POLICY "Kommentarer syns för de som ser passet"
  ON post_comments FOR SELECT
  USING (
    auth.uid() = owner_id
    OR (
      privacy_allows_followers(owner_id)
      AND EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = auth.uid()
          AND f.followee_id = owner_id
          AND f.status = 'accepted'
      )
    )
  );

DROP POLICY "Man kommenterar som sig själv, pass man får se" ON post_comments;
CREATE POLICY "Man kommenterar som sig själv, pass man får se"
  ON post_comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND (
      auth.uid() = owner_id
      OR (
        privacy_allows_followers(owner_id)
        AND EXISTS (
          SELECT 1 FROM follows f
          WHERE f.follower_id = auth.uid()
            AND f.followee_id = owner_id
            AND f.status = 'accepted'
        )
      )
    )
  );

-- Sökningen respekterar sökbarheten (utöver blockeringsfiltret)
CREATE OR REPLACE FUNCTION search_profiles(search TEXT)
RETURNS TABLE (id UUID, name TEXT, avatar_url TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.name, p.avatar_url
  FROM profiles p
  WHERE auth.uid() IS NOT NULL
    AND length(trim(search)) >= 2
    AND p.id <> auth.uid()
    AND p.searchable
    AND p.name ILIKE '%' || trim(search) || '%'
    AND NOT is_blocked_pair(auth.uid(), p.id)
  ORDER BY p.name
  LIMIT 20;
$$;

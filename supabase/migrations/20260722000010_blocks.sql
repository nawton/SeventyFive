-- Blockering av användare. Att blockera någon: raderar följen åt BÅDA
-- håll direkt (trigger), stoppar nya vänförfrågningar mellan paret
-- (follows-policyn) och döljer er för varandra i sökningen. Utan följe
-- försvinner även flöde/statistik/kommentarer automatiskt eftersom allt
-- är gatat på accepterade följen.

CREATE TABLE blocks (
  blocker_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- Bara blockeraren ser och hanterar sina egna blockeringar — den
-- blockerade får aldrig veta
CREATE POLICY "Användare hanterar sina egna blockeringar"
  ON blocks FOR ALL
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);

-- SECURITY DEFINER-hjälpare: policies och RPC:er måste kunna se BÅDA
-- riktningarna trots att blocks-RLS bara visar egna rader
CREATE OR REPLACE FUNCTION is_blocked_pair(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = a AND blocked_id = b)
       OR (blocker_id = b AND blocked_id = a)
  );
$$;

REVOKE ALL ON FUNCTION is_blocked_pair(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_blocked_pair(UUID, UUID) TO authenticated;

-- Inga nya följen/förfrågningar mellan blockerade par
DROP POLICY "Användare följer som sig själv" ON follows;
CREATE POLICY "Användare följer som sig själv"
  ON follows FOR INSERT
  WITH CHECK (
    auth.uid() = follower_id
    AND NOT is_blocked_pair(follower_id, followee_id)
  );

-- Blockering river befintliga följen åt båda håll i samma sekund
CREATE OR REPLACE FUNCTION cleanup_follows_on_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM follows
  WHERE (follower_id = NEW.blocker_id AND followee_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND followee_id = NEW.blocker_id);
  RETURN NEW;
END $$;

CREATE TRIGGER blocks_cleanup_follows
  AFTER INSERT ON blocks
  FOR EACH ROW EXECUTE FUNCTION cleanup_follows_on_block();

-- Sökningen visar aldrig blockerade par, oavsett riktning
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
    AND p.name ILIKE '%' || trim(search) || '%'
    AND NOT is_blocked_pair(auth.uid(), p.id)
  ORDER BY p.name
  LIMIT 20;
$$;

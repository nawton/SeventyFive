-- Följgrafen för communityn: vem följer vem.
-- RLS: alla inloggade får LÄSA grafen (krävs för följare/följer-räknare på
-- andras profiler), men man kan bara skapa och ta bort SINA EGNA följen.
-- Tabellen läggs i realtime-publikationen så appen kan uppdatera räknare
-- och listor live utan omladdning.

CREATE TABLE follows (
  follower_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  followee_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)   -- man kan inte följa sig själv
);

CREATE INDEX follows_followee_idx ON follows (followee_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inloggade läser följgrafen"
  ON follows FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Användare följer som sig själv"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Användare avföljer sina egna följen"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);

ALTER PUBLICATION supabase_realtime ADD TABLE follows;

-- Namn/avatar för följlistorna. Profiltabellens RLS är egna rader (den
-- innehåller vikt/längd/födelsedatum), så uppslag av andras namn går via
-- en SECURITY DEFINER-funktion som EXPLICIT bara lämnar ut id, namn och
-- avatar — samma princip som search_profiles.
CREATE OR REPLACE FUNCTION follow_profiles(ids UUID[])
RETURNS TABLE (id UUID, name TEXT, avatar_url TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.name, p.avatar_url
  FROM profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id = ANY(ids)
  LIMIT 500;
$$;

REVOKE ALL ON FUNCTION follow_profiles(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION follow_profiles(UUID[]) TO authenticated;

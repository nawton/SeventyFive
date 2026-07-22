-- search_profiles: sök andra användare på namn för communityn.
-- Profiltabellens RLS släpper bara igenom egna rader (och den innehåller
-- känsliga fält som vikt, längd och födelsedatum), så sökningen går via en
-- SECURITY DEFINER-funktion som EXPLICIT bara returnerar id, namn och
-- avatar — aldrig något annat. Kräver inloggning och minst två tecken.

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
  ORDER BY p.name
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION search_profiles(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_profiles(TEXT) TO authenticated;

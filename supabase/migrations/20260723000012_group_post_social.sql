-- GRUPPINLÄGG 3.0:
--  • Samma gilla/kommentar-system som passen: grp-<id>-nycklar godkänns i
--    post_key_belongs_to, så post_likes/post_comments funkar rakt av
--  • Ägaren kan fästa ETT inlägg som alltid ligger överst i gruppflödet

ALTER TABLE group_posts ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT FALSE;

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
    -- Gruppinläggsnycklar: grp-<inläggets uuid>, måste vara skrivet av owner
    WHEN key LIKE 'grp-%' THEN EXISTS (
      SELECT 1 FROM group_posts gp
      WHERE gp.id::text = substring(key FROM 5) AND gp.author_id = owner
    )
    -- Cardionycklar: passets uuid, måste ägas av owner
    ELSE EXISTS (
      SELECT 1 FROM user_workouts w
      WHERE w.id::text = key AND w.user_id = owner
    )
  END;
$$;

-- Fästning via definer-RPC: bara gruppens ägare, och max ett fäst inlägg
-- per grupp (fästs ett nytt släpper det gamla automatiskt)
CREATE OR REPLACE FUNCTION set_group_post_pinned(pid UUID, is_pinned BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gid UUID;
BEGIN
  SELECT group_id INTO gid FROM group_posts WHERE id = pid;
  IF gid IS NULL THEN
    RAISE EXCEPTION 'inlägget finns inte';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM groups WHERE id = gid AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'bara ägaren kan fästa inlägg';
  END IF;
  IF is_pinned THEN
    UPDATE group_posts SET pinned = FALSE WHERE group_id = gid AND pinned;
  END IF;
  UPDATE group_posts SET pinned = is_pinned WHERE id = pid;
END $$;

REVOKE ALL ON FUNCTION set_group_post_pinned(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_group_post_pinned(UUID, BOOLEAN) TO authenticated;

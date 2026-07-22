-- Gillanden och kommentarer på flödesinlägg. post_key är flödets
-- inläggs-id: user_workouts.id för cardio, 'gym-<ägarid>-<datum>' för
-- gympass (dagens övningar grupperade). Synligheten följer passets:
-- ägaren själv + godkända följare. Båda tabellerna ligger i realtime-
-- publikationen så notiser och räknare kan uppdateras live.

CREATE TABLE post_likes (
  post_key   TEXT        NOT NULL,
  owner_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  liker_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (post_key, liker_id)
);

CREATE INDEX post_likes_owner_idx ON post_likes (owner_id, created_at DESC);

CREATE TABLE post_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_key   TEXT        NOT NULL,
  owner_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX post_comments_post_idx  ON post_comments (post_key, created_at);
CREATE INDEX post_comments_owner_idx ON post_comments (owner_id, created_at DESC);

ALTER TABLE post_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Ser man passet ser man dess gillanden/kommentarer (follows-tabellen är
-- läsbar för inloggade, så subqueryn behöver ingen SECURITY DEFINER)
CREATE POLICY "Gillanden syns för de som ser passet"
  ON post_likes FOR SELECT
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM follows f
      WHERE f.follower_id = auth.uid()
        AND f.followee_id = owner_id
        AND f.status = 'accepted'
    )
  );

CREATE POLICY "Man gillar som sig själv, pass man får se"
  ON post_likes FOR INSERT
  WITH CHECK (
    auth.uid() = liker_id
    AND (
      auth.uid() = owner_id
      OR EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = auth.uid()
          AND f.followee_id = owner_id
          AND f.status = 'accepted'
      )
    )
  );

CREATE POLICY "Man tar bort sina egna gillanden"
  ON post_likes FOR DELETE
  USING (auth.uid() = liker_id);

CREATE POLICY "Kommentarer syns för de som ser passet"
  ON post_comments FOR SELECT
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM follows f
      WHERE f.follower_id = auth.uid()
        AND f.followee_id = owner_id
        AND f.status = 'accepted'
    )
  );

CREATE POLICY "Man kommenterar som sig själv, pass man får se"
  ON post_comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND (
      auth.uid() = owner_id
      OR EXISTS (
        SELECT 1 FROM follows f
        WHERE f.follower_id = auth.uid()
          AND f.followee_id = owner_id
          AND f.status = 'accepted'
      )
    )
  );

-- Författaren tar bort sina kommentarer; passägaren får städa sitt eget inlägg
CREATE POLICY "Författare och passägare tar bort kommentarer"
  ON post_comments FOR DELETE
  USING (auth.uid() = author_id OR auth.uid() = owner_id);

ALTER PUBLICATION supabase_realtime ADD TABLE post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE post_comments;

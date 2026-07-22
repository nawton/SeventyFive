-- Gillanden på enskilda kommentarer. Synligheten ärvs från kommentaren:
-- EXISTS-subqueryn mot post_comments filtreras av dess RLS för den
-- frågande användaren, så ser man inte kommentaren ser man inte heller
-- (eller kan skapa) dess gillanden.

CREATE TABLE comment_likes (
  comment_id UUID        NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  liker_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (comment_id, liker_id)
);

ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Syns för de som ser kommentaren"
  ON comment_likes FOR SELECT
  USING (EXISTS (SELECT 1 FROM post_comments c WHERE c.id = comment_id));

CREATE POLICY "Man gillar som sig själv, kommentarer man ser"
  ON comment_likes FOR INSERT
  WITH CHECK (
    auth.uid() = liker_id
    AND EXISTS (SELECT 1 FROM post_comments c WHERE c.id = comment_id)
  );

CREATE POLICY "Man tar bort sina egna kommentarsgillanden"
  ON comment_likes FOR DELETE
  USING (auth.uid() = liker_id);

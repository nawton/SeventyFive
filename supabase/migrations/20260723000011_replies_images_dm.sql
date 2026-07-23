-- INLÄGG 2.0 + DIREKTMEDDELANDEN:
--  • Gruppinlägg kan besvaras (reply_to) och bära en bild (image_url)
--  • direct_messages: privata meddelanden mellan två personer som följer
--    varandra (någon riktning) eller delar en grupp, aldrig blockerade par
--  • Bilder lagras i avatars-bucketen under posts/<uid>-... — publika URL:er
--    men med ogissbara namn (samma kontrakt som en olistad länk)

-- ── Svar och bilder i gruppinlägg ────────────────────────────────────────────
ALTER TABLE group_posts ADD COLUMN reply_to UUID REFERENCES group_posts(id) ON DELETE CASCADE;
ALTER TABLE group_posts ADD COLUMN image_url TEXT;

-- Bild utan text är okej, text krävs annars
ALTER TABLE group_posts DROP CONSTRAINT group_posts_body_check;
ALTER TABLE group_posts ADD CONSTRAINT group_posts_body_check
  CHECK (char_length(body) <= 1000 AND (char_length(body) >= 1 OR image_url IS NOT NULL));

CREATE POLICY "Inläggsbilder laddas upp av avsändaren"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND name LIKE 'posts/' || auth.uid()::text || '-%');

-- ── Direktmeddelanden ────────────────────────────────────────────────────────
CREATE TABLE direct_messages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body         TEXT        NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  image_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at      TIMESTAMPTZ,

  CHECK (sender_id <> recipient_id),
  CHECK (char_length(body) >= 1 OR image_url IS NOT NULL)
);

CREATE INDEX dm_sender_idx    ON direct_messages (sender_id, created_at DESC);
CREATE INDEX dm_recipient_idx ON direct_messages (recipient_id, created_at DESC);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parterna läser sina meddelanden"
  ON direct_messages FOR SELECT
  USING (auth.uid() IN (sender_id, recipient_id));

-- Vem får skriva till vem: följrelation i någon riktning eller gemensam
-- grupp, aldrig blockerade par — spamskyddet bor här, inte i UI:t
CREATE OR REPLACE FUNCTION can_message(other UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT NOT is_blocked_pair(auth.uid(), other)
    AND (
      EXISTS (
        SELECT 1 FROM follows f
        WHERE f.status = 'accepted'
          AND ((f.follower_id = auth.uid() AND f.followee_id = other)
            OR (f.follower_id = other AND f.followee_id = auth.uid()))
      )
      OR shares_group_with(other)
    );
$$;

REVOKE ALL ON FUNCTION can_message(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_message(UUID) TO authenticated;

CREATE POLICY "Man skickar själv, till folk man känner"
  ON direct_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND can_message(recipient_id));

CREATE POLICY "Avsändaren raderar sina meddelanden"
  ON direct_messages FOR DELETE
  USING (auth.uid() = sender_id);

-- Läskvitto via definer-RPC — en UPDATE-policy hade även öppnat för
-- redigering av mottagna meddelandens innehåll
CREATE OR REPLACE FUNCTION mark_messages_read(other UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE direct_messages SET read_at = NOW()
  WHERE recipient_id = auth.uid() AND sender_id = other AND read_at IS NULL;
END $$;

REVOKE ALL ON FUNCTION mark_messages_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_messages_read(UUID) TO authenticated;

CREATE TRIGGER direct_messages_push
  AFTER INSERT ON direct_messages
  FOR EACH ROW EXECUTE FUNCTION notify_push();

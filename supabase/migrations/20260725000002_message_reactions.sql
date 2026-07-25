-- REAKTIONER PÅ MEDDELANDEN (som iMessage): en reaktion per person och
-- meddelande, byts vid nytt val, tas bort vid samma val igen. Bara trådens
-- två parter kan se och reagera — upprätthålls här, inte i knapparna.

CREATE TABLE message_reactions (
  message_id UUID        NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji      TEXT        NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Deltagare i meddelandet = avsändare eller mottagare
CREATE POLICY "Parterna ser trådens reaktioner"
  ON message_reactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM direct_messages dm
    WHERE dm.id = message_id AND auth.uid() IN (dm.sender_id, dm.recipient_id)
  ));

CREATE POLICY "Man reagerar själv, på meddelanden man är part i"
  ON message_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM direct_messages dm
      WHERE dm.id = message_id AND auth.uid() IN (dm.sender_id, dm.recipient_id)
    )
  );

CREATE POLICY "Man byter sin egen reaktion"
  ON message_reactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM direct_messages dm
      WHERE dm.id = message_id AND auth.uid() IN (dm.sender_id, dm.recipient_id)
    )
  );

CREATE POLICY "Man tar bort sin egen reaktion"
  ON message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Reaktioner syns live i chatten, precis som meddelandena
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;

-- Notis till motparten vid NY reaktion (byte via upsert triggar inte INSERT)
CREATE TRIGGER message_reactions_push
  AFTER INSERT ON message_reactions
  FOR EACH ROW EXECUTE FUNCTION notify_push();

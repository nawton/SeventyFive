-- Push-notiser: appen registrerar Expo-pushtokens per enhet, och
-- databastriggers skickar varje social händelse (vänförfrågan,
-- godkännande, gillande, kommentar) vidare till edge-funktionen
-- push-notify via pg_net — asynkront, så insert:arna blockeras aldrig.
-- Funktionen verifierar x-push-secret (samma värde ligger som edge-
-- funktionssecret PUSH_WEBHOOK_SECRET).

CREATE TABLE push_tokens (
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Användare hanterar sina egna push-tokens"
  ON push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION notify_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://vmnvtendcmnypcpwfuva.supabase.co/functions/v1/push-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', '7098a5a5e683b090d3c38ce3286420d40cb7b0e8c6cacb03'
    ),
    body := jsonb_build_object(
      'table',  TG_TABLE_NAME,
      'op',     TG_OP,
      'record', to_jsonb(NEW)
    )
  );
  RETURN NEW;
END $$;

CREATE TRIGGER follows_push
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION notify_push();

-- Godkännande: pending → accepted notifierar avsändaren
CREATE TRIGGER follows_accept_push
  AFTER UPDATE ON follows
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status = 'accepted')
  EXECUTE FUNCTION notify_push();

CREATE TRIGGER post_likes_push
  AFTER INSERT ON post_likes
  FOR EACH ROW EXECUTE FUNCTION notify_push();

CREATE TRIGGER post_comments_push
  AFTER INSERT ON post_comments
  FOR EACH ROW EXECUTE FUNCTION notify_push();

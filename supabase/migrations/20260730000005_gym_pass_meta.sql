-- Passmetadata: titel, kommentar och foto som skrivs på granskningsskärmen
-- efter passet och visas i detaljvyn och flödet. En rad per användare och
-- träningsdag. Synlighet speglar user_workouts: ägaren plus godkända
-- följare när ägaren delar aktiviteter. Idempotent.

CREATE TABLE IF NOT EXISTS gym_pass_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_date date NOT NULL,
  title text,
  note text,
  photo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workout_date)
);

ALTER TABLE gym_pass_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Egen passmetadata läses" ON gym_pass_meta;
CREATE POLICY "Egen passmetadata läses"
  ON gym_pass_meta FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Godkända följare läser passmetadata" ON gym_pass_meta;
CREATE POLICY "Godkända följare läser passmetadata"
  ON gym_pass_meta FOR SELECT
  USING (
    privacy_allows_followers(gym_pass_meta.user_id)
    AND EXISTS (
      SELECT 1 FROM follows f
      WHERE f.follower_id = auth.uid()
        AND f.followee_id = gym_pass_meta.user_id
        AND f.status = 'accepted'
    )
  );

DROP POLICY IF EXISTS "Egen passmetadata skrivs" ON gym_pass_meta;
CREATE POLICY "Egen passmetadata skrivs"
  ON gym_pass_meta FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Egen passmetadata uppdateras" ON gym_pass_meta;
CREATE POLICY "Egen passmetadata uppdateras"
  ON gym_pass_meta FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Egen passmetadata raderas" ON gym_pass_meta;
CREATE POLICY "Egen passmetadata raderas"
  ON gym_pass_meta FOR DELETE
  USING (user_id = auth.uid());

-- Fotona delas till flödet, publik bucket som övningsbilderna
INSERT INTO storage.buckets (id, name, public)
VALUES ('pass-photos', 'pass-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Uppladdning: bara till sin egen mapp (user_id som första mappnivå)
DROP POLICY IF EXISTS "Egna passfoton laddas upp" ON storage.objects;
CREATE POLICY "Egna passfoton laddas upp"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pass-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Egna passfoton skrivs över" ON storage.objects;
CREATE POLICY "Egna passfoton skrivs över"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'pass-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Egna passfoton raderas" ON storage.objects;
CREATE POLICY "Egna passfoton raderas"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pass-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

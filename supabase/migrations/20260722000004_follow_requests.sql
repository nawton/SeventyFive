-- Vänförfrågningar: ett följe börjar som 'pending' och godkänns av
-- mottagaren. Först när det är 'accepted' öppnas läsning av personens
-- PASS (user_workouts → statistiken i appen). Framstegsfoton förblir
-- alltid helt privata — den gamla publika is_public-policyn tas bort så
-- garantin ligger på databasnivå, inte i appkod.

ALTER TABLE follows ADD COLUMN status TEXT NOT NULL DEFAULT 'accepted'
  CHECK (status IN ('pending', 'accepted'));
-- Befintliga följen fick 'accepted' av defaulten ovan — alla NYA
-- förfrågningar ska börja som pending
ALTER TABLE follows ALTER COLUMN status SET DEFAULT 'pending';

-- Mottagaren godkänner förfrågningar och kan ta bort förfrågningar/följare
-- (avsändaren kan redan ta bort sina egna följen via befintlig policy)
CREATE POLICY "Mottagaren godkänner förfrågan"
  ON follows FOR UPDATE
  USING (auth.uid() = followee_id)
  WITH CHECK (auth.uid() = followee_id);

CREATE POLICY "Mottagaren tar bort förfrågan eller följare"
  ON follows FOR DELETE
  USING (auth.uid() = followee_id);

-- Godkända följare får läsa personens pass — det är detta som låser upp
-- statistiken i appen (permissiva policies OR:as med ägar-policyn)
CREATE POLICY "Godkända följare läser pass"
  ON user_workouts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM follows f
    WHERE f.follower_id = auth.uid()
      AND f.followee_id = user_workouts.user_id
      AND f.status = 'accepted'
  ));

-- Framstegsfoton ska ALDRIG kunna ses av andra — bort med publika vägen
DROP POLICY IF EXISTS "Publika foton syns i communityt" ON progress_photos;

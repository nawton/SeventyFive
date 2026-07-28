-- =============================================================================
-- EGNA GYMÖVNINGAR — användare kan skapa övningar som saknas i biblioteket.
-- Nya kolumner: ägare, utrustning, primär muskel + övriga muskler (slugs
-- från appens muskelkarta) och övningstyp (vikt/reps, kroppsvikt, tid …).
-- Läsning: biblioteket (user_id IS NULL) är publikt, egna övningar syns
-- bara för ägaren. Idempotent.
-- =============================================================================

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS user_id        uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment      text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS primary_muscle text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS other_muscles  text[];
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS exercise_type  text
  CHECK (exercise_type IS NULL OR exercise_type IN
    ('weight_reps', 'bodyweight', 'weighted_bodyweight', 'assisted_bodyweight', 'duration', 'duration_weight'));

CREATE INDEX IF NOT EXISTS exercises_user_id_idx ON exercises (user_id) WHERE user_id IS NOT NULL;

-- Gamla läspolicyn släppte igenom allt — nu är egna övningar privata
DROP POLICY IF EXISTS "Övningar är publika att läsa" ON exercises;
DROP POLICY IF EXISTS "Biblioteket och egna övningar är läsbara" ON exercises;
CREATE POLICY "Biblioteket och egna övningar är läsbara"
  ON exercises FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Egna övningar skapas av ägaren" ON exercises;
CREATE POLICY "Egna övningar skapas av ägaren"
  ON exercises FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Egna övningar uppdateras av ägaren" ON exercises;
CREATE POLICY "Egna övningar uppdateras av ägaren"
  ON exercises FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Egna övningar raderas av ägaren" ON exercises;
CREATE POLICY "Egna övningar raderas av ägaren"
  ON exercises FOR DELETE
  USING (user_id = auth.uid());

-- Varje slutfört pass får en egen nyckel så två pass samma dag hålls isär
-- i flödet och i passmetadatan. Tomt värde = äldre rader (grupperas per
-- dag som förr). Idempotent.

ALTER TABLE gym_pass_meta ADD COLUMN IF NOT EXISTS pass_key text NOT NULL DEFAULT '';
ALTER TABLE gym_pass_meta DROP CONSTRAINT IF EXISTS gym_pass_meta_user_id_workout_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS gym_pass_meta_user_date_pass_idx
  ON gym_pass_meta (user_id, workout_date, pass_key);

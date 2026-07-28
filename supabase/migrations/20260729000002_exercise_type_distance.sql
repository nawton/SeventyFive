-- =============================================================================
-- Två övningstyper till för egna övningar: distans & tid (löpning, rodd)
-- och vikt & distans (farmers walk, sled push). Idempotent.
-- =============================================================================

ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_exercise_type_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_exercise_type_check
  CHECK (exercise_type IS NULL OR exercise_type IN
    ('weight_reps', 'bodyweight', 'weighted_bodyweight', 'assisted_bodyweight',
     'duration', 'duration_weight', 'distance_duration', 'weight_distance'));

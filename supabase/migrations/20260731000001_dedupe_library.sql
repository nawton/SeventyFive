-- ExerciseDB hade 7 namnpar med identiskt engelskt namn — omdöpningen
-- träffade båda raderna i varje par och gav 7 dubbletter. Behåll en rad
-- per namn (deterministiskt via lägst id). Idempotent.
DELETE FROM exercises a
USING exercises b
WHERE a.user_id IS NULL AND b.user_id IS NULL
  AND a.category = b.category
  AND a.name = b.name
  AND a.id > b.id;

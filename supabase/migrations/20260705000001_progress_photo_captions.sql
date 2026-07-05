-- =============================================================================
-- BILDTEXT PÅ FRAMSTEGSFOTON
-- Strava-lik beskrivning: användaren kan skriva några rader om dagen/passet
-- när de laddar upp sitt framstegsfoto.
-- =============================================================================
ALTER TABLE progress_photos ADD COLUMN caption TEXT;

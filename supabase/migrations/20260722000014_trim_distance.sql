-- Kartsynlighet: klippavståndet för start/slut blir valbart i steg om
-- 200 m (0 = av) istället för fast på/av. Befintliga påslag flyttas till
-- 200 m — samma avstånd som den gamla brytaren klippte.
ALTER TABLE profiles ADD COLUMN trim_route_meters INTEGER NOT NULL DEFAULT 0
  CHECK (trim_route_meters >= 0 AND trim_route_meters <= 1600);

UPDATE profiles SET trim_route_meters = 200 WHERE trim_route_ends;

ALTER TABLE profiles DROP COLUMN trim_route_ends;

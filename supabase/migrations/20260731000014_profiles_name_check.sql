-- FIX: profiles.name saknade en gräns för längd/tomsträng, till skillnad
-- från groups.name/organizations.name som redan har CHECK-constraints.
-- Ingen injektionsrisk (allt går via parametriserade anrop) men en
-- namnlös/oändligt lång sträng är ett hygienhål. NOT VALID: sätter regeln
-- för alla nya skrivningar utan att skanna/validera befintliga rader —
-- historiska rader (om några redan avviker) rör sig inte, se
-- VALIDATE CONSTRAINT profiles_name_check för att stänga den luckan när
-- datan är städad.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_name_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_name_check
  CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 80) NOT VALID;

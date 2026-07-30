-- FIX: passfoton gick inte att ladda upp — 403 vid sparningen gjorde att
-- hela granskningen föll ("Kunde inte spara"), vilket i praktiken tvingade
-- fram textbara sparningar. Orsak: uppladdningen kör med x-upsert, och
-- storage-API:ts upsertflöde behöver SELECT-rätt på objekten för att
-- kolla om filen finns. Bucketen är publik för visning (flödet läser via
-- publika URL:er), men API-läsningen kräver en RLS-policy — precis som
-- avatars-bucketen redan har. Verifierad mot produktion.

DROP POLICY IF EXISTS "Passfoton läses" ON storage.objects;
CREATE POLICY "Passfoton läses"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pass-photos');

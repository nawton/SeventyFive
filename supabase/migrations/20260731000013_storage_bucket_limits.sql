-- FIX: avatars/progress-photos/pass-photos-bucketsen hade varken
-- file_size_limit eller allowed_mime_types satt. RLS-policyerna begränsar
-- VAR en inloggad användare får skriva (sin egen mapp/fil), men inte VAD —
-- en klient som går förbi appen (t.ex. med en stulen bearer-token) kunde
-- ladda upp godtyckligt stora eller icke-bildfiler. Appen konverterar alltid
-- till JPEG innan uppladdning (src/lib/storage.ts hårdkodar
-- Content-Type: image/jpeg) och komprimerar till maxbredd 1600px (kvalitet
-- 0.8) innan det — 5 MB ger god marginal utan att vara meningslöst högt.

UPDATE storage.buckets
SET file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = ARRAY['image/jpeg']
WHERE id IN ('avatars', 'progress-photos', 'pass-photos');

-- Viktade kroppsviktsövningar (EDB 'weighted') görs med viktskiva —
-- klassas som plate så utrustningsfiltret får ett riktigt Viktskiva-val.
-- Ab wheel med flera behåller 'other'. Idempotent.
UPDATE exercises SET equipment = 'plate' WHERE name = 'Armcirklar med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Bänkdips med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Chin-up smalt grepp med vikt i dipställning' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Crunch med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Crunch med vikt bakom huvudet' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Dips mellan tre bänkar med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Dips på rak stång med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Donkey vadpress med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Drop armhävning med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Enarms pull-up med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Frontlyft med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Hängande ben och höftlyft med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Knäböj med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Knästående steg med sving och vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Liggande nackextension med huvudsele' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Liggande nackflexion med huvudsele' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Muscle up med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Muscle up på stång med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Negativ sit-up med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Otis up' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Plankan' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Pull-up med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Russian twist med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Russian twist med vikt och lyfta ben' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Sidoliggande nacklyft med huvudsele' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Sissy squat med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Sittande nackextension med huvudsele (viktad)' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Stretchutfall med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Strongman fatkast' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Stående curl med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Stående greppkläm med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Stående nackextension med huvudsele' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Svend press med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Tricepsdips i hög barr med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Tricepsdips med vikt' AND user_id IS NULL;
UPDATE exercises SET equipment = 'plate' WHERE name = 'Utfall med sving och vikt' AND user_id IS NULL;

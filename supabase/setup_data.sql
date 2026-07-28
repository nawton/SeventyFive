-- ══════════════════════════════════════════════════════════════════════════════
-- SeventyFive, Kör detta EN GÅNG i Supabase SQL Editor
-- Dashboard → SQL Editor → New query → klistra in allt → Run
-- Säker att köra flera gånger (ON CONFLICT DO NOTHING / IF NOT EXISTS)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Schema-tillägg ─────────────────────────────────────────────────────────
ALTER TABLE user_schedules
  ADD COLUMN IF NOT EXISTS template_id TEXT;

-- ── 2. Challenge-nivåer ───────────────────────────────────────────────────────
INSERT INTO challenge_levels (id, slug, display_name, description, rules) VALUES
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'normal',
  'Normal',
  'Perfekt för dig som är redo att bygga en livsstil. Krävande men hållbar.',
  '[
    {"rule": "4 träningspass i veckan", "icon": "dumbbell"},
    {"rule": "Följ din kostplan", "icon": "utensils"},
    {"rule": "Drick 2 liter vatten", "icon": "droplet"},
    {"rule": "Läsning och progressfoton är valfria", "icon": "book"},
    {"rule": "En dags marginal per vecka", "icon": "check"}
  ]'
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'hard',
  'Hard',
  'För dig som vill testa din gräns på riktigt. Ingen återvändo.',
  '[
    {"rule": "Träningspass varje dag, ett utomhus", "icon": "dumbbell"},
    {"rule": "Håll din kost, noll fuskmat", "icon": "ban"},
    {"rule": "Drick 3 liter vatten", "icon": "droplet"},
    {"rule": "Läs 10 sidor varje dag", "icon": "book"},
    {"rule": "Ta ett progressfoto varje dag", "icon": "camera"}
  ]'
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'extreme',
  'Extreme',
  'Eliten. Byggt för dem som vill förändra vem de är på 75 dagar.',
  '[
    {"rule": "2 träningspass per dag, ett utomhus", "icon": "dumbbell"},
    {"rule": "Strikt kostplan, inga undantag", "icon": "ban"},
    {"rule": "Drick 4 liter vatten", "icon": "droplet"},
    {"rule": "Läs 10 sidor varje dag", "icon": "book"},
    {"rule": "Ta ett progressfoto varje dag", "icon": "camera"},
    {"rule": "Kall dusch varje morgon", "icon": "snowflake"}
  ]'
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Uppgiftsmallar ─────────────────────────────────────────────────────────
INSERT INTO task_templates (level_id, type, name, description, target_value, unit) VALUES
('a1b2c3d4-0001-0001-0001-000000000001', 'workout', 'Träningspass',  'Minst 45 minuter. Fyra pass i veckan är målet, vila övriga dagar.', 45, 'minutes'),
('a1b2c3d4-0001-0001-0001-000000000001', 'water',   'Vatten',        'Drick minst 2 liter vatten under dagen.',    2,   'liter'),
('a1b2c3d4-0001-0001-0001-000000000001', 'reading', 'Läsning (valfri)', 'Läs 10 sidor om du vill. Valfri på Normal, dagen godkänns utan.', 10, 'pages'),
('a1b2c3d4-0001-0001-0001-000000000001', 'diet',    'Kostplan',      'Följ din valda kostplan.',                NULL,   NULL),
('a1b2c3d4-0001-0001-0001-000000000001', 'photo',   'Framstegsfoto (valfritt)', 'Ta ett foto om du vill. Valfritt på Normal, dagen godkänns utan.', NULL, NULL),

('a1b2c3d4-0002-0002-0002-000000000002', 'workout', 'Träningspass',  'Minst 45 minuter varje dag. Ett av veckans pass utomhus.', 45, 'minutes'),
('a1b2c3d4-0002-0002-0002-000000000002', 'water',   'Vatten',        'Drick minst 3 liter vatten under dagen.',    3,   'liter'),
('a1b2c3d4-0002-0002-0002-000000000002', 'reading', 'Läsning',       'Läs minst 10 sidor i en bok varje dag.',    10,   'pages'),
('a1b2c3d4-0002-0002-0002-000000000002', 'diet',    'Kost utan fusk', 'Håll din kost. Noll fuskmat.',           NULL,   NULL),
('a1b2c3d4-0002-0002-0002-000000000002', 'photo',   'Framstegsfoto', 'Ta ett framstegsfoto varje dag.',         NULL,   NULL),

('a1b2c3d4-0003-0003-0003-000000000003', 'workout', 'Pass 1',        'Första passet, minst 45 minuter. Ett av dagens pass utomhus.', 45, 'minutes'),
('a1b2c3d4-0003-0003-0003-000000000003', 'workout', 'Pass 2',        'Andra passet, minst 45 minuter.',           45,  'minutes'),
('a1b2c3d4-0003-0003-0003-000000000003', 'water',   'Vatten',        'Drick minst 4 liter vatten under dagen.',    4,   'liter'),
('a1b2c3d4-0003-0003-0003-000000000003', 'reading', 'Läsning',       'Läs minst 10 sidor i en bok varje dag.',    10,   'pages'),
('a1b2c3d4-0003-0003-0003-000000000003', 'diet',    'Strikt kostplan', 'Inga undantag, ingen fuskmat, ingen alkohol.', NULL, NULL),
('a1b2c3d4-0003-0003-0003-000000000003', 'photo',   'Framstegsfoto', 'Ta ett framstegsfoto varje dag.',         NULL,   NULL),
('a1b2c3d4-0003-0003-0003-000000000003', 'cold_shower', 'Kall dusch', 'Kall dusch varje morgon.',               NULL,   NULL)
ON CONFLICT DO NOTHING;

-- ── 4. Övningar ───────────────────────────────────────────────────────────────
-- Bas-övningar (15 st)
INSERT INTO exercises (name, description, category, difficulty) VALUES
('Knäböj',           'Grundövning för ben och core. Håll ryggen rak.',              'strength', 'beginner'),
('Marklyft',         'Helkroppsövning. Fundamentet i styrketräning.',               'strength', 'intermediate'),
('Bänkpress',        'Överkroppsövning för bröst, axlar och triceps.',              'strength', 'intermediate'),
('Pull-ups',         'Rygg och biceps. Kontrollerad rörelse hela vägen.',            'strength', 'advanced'),
('Militärpress',     'Axelövning med skivstång eller hantlar.',                     'strength', 'intermediate'),
('Löpning',          'Stärker hjärta och lungor. Bygg din bas.',                    'cardio',   'beginner'),
('Intervallspring',  'Hög intensitet, korta intervall. Bränner maximalt.',           'cardio',   'advanced'),
('Hopprep',          'Koordination och kondition. Enkelt, effektivt.',               'cardio',   'beginner'),
('Cykling',          'Lågbelastad konditionsträning.',                               'cardio',   'beginner'),
('Rodd',             'Total överkropp med minimalt ledslitage.',                    'cardio',   'intermediate'),
('Yoga flow',        'Rörlighet, andning och mental klarhet.',                      'mobility', 'beginner'),
('Hip flexor stretch','Öppnar höfterna efter lång tid i sittande.',                 'mobility', 'beginner'),
('Foam rolling',     'Återhämtning och mjukvävnadsbehandling.',                     'mobility', 'beginner'),
('Tabata',           '4 minuter som känns som 40. 20s on, 10s off.',                'hiit',     'advanced'),
('Burpees',          'Fullkroppsövning med hög puls. Inga ursäkter.',               'hiit',     'intermediate')
ON CONFLICT DO NOTHING;

-- Utökad övningslista (~80 st)
INSERT INTO exercises (name, description, category, difficulty) VALUES

-- STYRKA: BRÖST
('Hantelpress liggande',   'Tränar hela bröstet med bättre rörelseomfång än skivstång.',        'strength', 'beginner'),
('Lutande bänkpress',      'Betonar övre bröstet. Skivstång eller hantlar på lutande bänk.',    'strength', 'intermediate'),
('Decline bänkpress',      'Nedre bröstet i fokus. Bra komplement till vanlig bänkpress.',       'strength', 'intermediate'),
('Push-ups',               'Klassisk kroppsviktsövning. Skala med knä eller lyft fötterna.',    'strength', 'beginner'),
('Dips',                   'Bröst och triceps. Luta framåt för mer bröst, upprätt för triceps.','strength', 'intermediate'),
('Kabelkorsning',          'Isolerar bröstet i toppen av rörelsen. Bra pump-övning.',            'strength', 'intermediate'),
('Smalbänkpress',          'Närgripet grepp, mer triceps och inre bröst.',                     'strength', 'intermediate'),
('Pec deck',               'Maskinövning som isolerar bröstet utan axelbelastning.',             'strength', 'beginner'),

-- STYRKA: RYGG
('Latsdrag framifrån',     'Breda ryggar byggs med latsdrag. Dra till bröstets höjd.',          'strength', 'beginner'),
('Rodd med skivstång',     'Tung ryggövning. Håll ryggen parallell med golvet.',                'strength', 'intermediate'),
('Enarms hantelrodd',      'Unilateral rörelse, korrigerar sidoskillnader i ryggstyrkan.',     'strength', 'beginner'),
('Kabelrodd sittande',     'Jämn belastning hela vägen. Bra för övre och mellersta ryggen.',    'strength', 'beginner'),
('T-bar rodd',             'Mellanting mellan skivstångsrodd och maskin. Tung grundövning.',    'strength', 'intermediate'),
('Face pulls',             'Skyddar axlarna och bygger bakre deltamuskeln. Gör det ofta.',      'strength', 'beginner'),
('Hyperextensions',        'Stärker nedre ryggen, sätesmusklerna och hamstrings.',              'strength', 'beginner'),
('Rack pull',              'Partiell marklyft från rack, lastar ryggen tungt och säkert.',      'strength', 'advanced'),
('Chin-ups',               'Undersidesgreppt pull-up. Mer biceps-aktivering än pull-ups.',      'strength', 'intermediate'),
('Latsdrag bakåt',         'Varianten bakom nacken. Tränar breda ryggen brett.',                'strength', 'intermediate'),

-- STYRKA: BEN
('Benpress',               'Maskinalternativ till knäböj. Lättare på ryggen, tungt på benen.',  'strength', 'beginner'),
('Utfall',                 'Unilateral benövning för lår och säte. Håll överkroppen upprätt.',  'strength', 'beginner'),
('Bulgariska utfall',      'Bakre fot upphöjd, enorm stretch och aktivering av sätet.',        'strength', 'intermediate'),
('Rumänsk marklyft',       'Hamstrings och säte. Känn stretchen, stoppa när ryggen rundas.',   'strength', 'intermediate'),
('Bencurl liggande',       'Isolerar hamstrings. Kör kontrollerat hela rörelseomfånget.',       'strength', 'beginner'),
('Benextension',           'Isolerar quadriceps. Bra komplement till knäböj.',                  'strength', 'beginner'),
('Vadpress stående',       'Vader bygger du med hög volym. 15–25 reps per set.',                'strength', 'beginner'),
('Goblet squat',           'Hantel framför bröstet. Fantastisk för teknik och höfterna.',       'strength', 'beginner'),
('Hip thrust',             'Den bästa sätesövningen. Skivstång över höfterna på bänk.',         'strength', 'intermediate'),
('Sumo marklyft',          'Bredare stans, mer höfter och inre lår.',                           'strength', 'intermediate'),
('Box squat',              'Sätt ner på låda, pausa, res upp. Bygger explosiv styrka.',         'strength', 'intermediate'),
('Hack squat',             'Maskin-knäböj med säker backsupport. Bra för lår.',                 'strength', 'beginner'),
('Steg-ups',               'Steg upp på bänk med vikt. Funktionell och ensidig styrka.',        'strength', 'beginner'),

-- STYRKA: AXLAR
('Hantelpress axlar',      'Sittande eller stående axelpress med hantlar.',                     'strength', 'beginner'),
('Sidolyft',               'Isolerar mellersta deltamuskeln. Lättare vikt, fullt omfång.',      'strength', 'beginner'),
('Frontlyft',              'Tränar främre deltamuskeln. Hantlar eller skivstång.',              'strength', 'beginner'),
('Bakre deltalyft',        'Böj framåt och lyft hantlarna ut. Viktig för balansen i axlarna.',  'strength', 'beginner'),
('Arnold press',           'Rotation under press. Tränar alla tre deltadelar.',                 'strength', 'intermediate'),
('Upright row',            'Lyft stången längs kroppen till hakan. Axlar och trapezius.',       'strength', 'intermediate'),
('Axellyft med kabel',     'Stabil belastning genom hela rörelsen. Bra isolationsövning.',     'strength', 'beginner'),

-- STYRKA: ARMAR
('Bicepscurl',             'Klassisk armövning med hantlar eller skivstång.',                   'strength', 'beginner'),
('Hammercurl',             'Neutralt grepp, tränar brachialis och underarm.',                  'strength', 'beginner'),
('Koncentrationscurl',     'Arm mot insidan av låret. Maximalt fokus på biceps.',               'strength', 'beginner'),
('Kabelbiceps',            'Konstant spänning via kabel. Bra pump.',                            'strength', 'beginner'),
('Preacher curl',          'Armbågen stödd på pult, ingen fusk möjlig. Ren bicepsövning.',    'strength', 'intermediate'),
('Tricepsstötning kabel',  'Kabelmaskin, driv ner till lås. Isolerar triceps.',                 'strength', 'beginner'),
('Skull crushers',         'Hantlar eller stång till pannan. Tungt triceps-arbete.',             'strength', 'intermediate'),
('Triceps kickback',       'Böj framåt, sträck armen bakåt. Känn muskelns topp.',              'strength', 'beginner'),
('Tricepspress smal',      'Smalt grepp på bänk. Bygger tjocka triceps.',                       'strength', 'intermediate'),

-- STYRKA: MAGE / CORE
('Plankan',                'Håll kroppen rak som en planka. Bygg upp tid progressivt.',         'strength', 'beginner'),
('Situps',                 'Klassisk magövning. Håll fötterna i golvet.',                       'strength', 'beginner'),
('Crunches',               'Kortare rörelse än situps, mer isolerat för raka magmuskeln.',     'strength', 'beginner'),
('Russian twist',          'Rotera med vikt. Tränar snedmagsmuskler och core.',                 'strength', 'intermediate'),
('Hängande benlyft',       'Häng i bom och lyft benen. Kräver styrka och kontroll.',           'strength', 'advanced'),
('Ab wheel',               'Rulla ut och tillbaka. En av de tuffaste magövningarna.',           'strength', 'advanced'),
('Kabelcrunch',            'Kabelmaskin mot golvet. Laddat magarbete i hela omfånget.',         'strength', 'intermediate'),
('Sidoplanka',             'Som plankan men på sidan. Isolerar snedmagsmuskler.',               'strength', 'beginner'),
('Mountain climbers',      'Löpning i plankposition. Kondition och core i ett.',                'strength', 'beginner'),
('Dragon flag',            'Avancerad kärnövning inspirerad av Bruce Lee.',                     'strength', 'advanced'),

-- STYRKA: HELKROPP
('Frivändning',            'Olympisk lyftteknik. Kräver rörlighet, explosivitet och teknik.',  'strength', 'advanced'),
('Push press',             'Axelpress med benbipp. Mer last, mer explosivitet.',                'strength', 'intermediate'),
('Farmers walk',           'Gå med tung vikt i varje hand. Grip och core brinner.',            'strength', 'beginner'),
('Kettlebell swing',       'Hip hinge med fart. Kondition och bakre kedjan i ett.',             'strength', 'intermediate'),
('Thrusters',              'Knäböj + axelpress i ett flöde. Hemsk och effektiv.',              'strength', 'advanced'),

-- CARDIO
('Promenad',               'Aktiv återhämtning. Lägre intensitet men räknas varje steg.',      'cardio', 'beginner'),
('Backlöpning',            'Kortare intervaller i backe. Bygger explosiv styrka och kondition.','cardio', 'advanced'),
('Simning',                'Lågbelastad fullkroppsträning. Perfekt vid skador.',                'cardio', 'beginner'),
('Rodd maskin',            'Kraftfullt drag, 86 % av kroppens muskler aktiveras.',            'cardio', 'intermediate'),
('Stairmaster',            'Klättra i trappor. Hög puls, stark nedre kropp.',                  'cardio', 'intermediate'),
('Elliptical',             'Konditionsmaskin med låg belastning på lederna.',                   'cardio', 'beginner'),

-- RÖRLIGHET
('Världens bästa stretch', 'Lunge med rotation. Öppnar höfter, rygg och bröst på en gång.',   'mobility', 'beginner'),
('Pigeon pose',            'Djup höftstretching från yoga. Sitta in i positionen 90+ sekunder.','mobility', 'beginner'),
('Thoraxrotation',         'Sittande rotation för bröstryggen. Motverkar kontorslivets skador.','mobility', 'beginner'),
('Axelstretching',         'Korsande armstretching och axelrotation för friskare axelleden.',  'mobility', 'beginner'),
('Hamstringstretching',    'Sittande eller stående stretch för baksida lår.',                  'mobility', 'beginner'),
('Quadstretching',         'Stå på ett ben, dra i foten bakåt. Öppnar upp höftflexorn.',      'mobility', 'beginner'),
('IT-band stretch',        'Liggande korsad benposition. Viktigt för löpare och cyklister.',   'mobility', 'beginner'),
('Kattvågen',              'Katt-ko-rörelse i fyrbent. Mobiliserar hela ryggraden.',            'mobility', 'beginner'),
('Nackstretching',         'Försiktig stretch åt sidor och rotation. Lindrar spänningar.',     'mobility', 'beginner'),
('Bröstryggsrulle',        'Foam roller under bröstryggen. Öppnar upp den stela thorax.',      'mobility', 'beginner'),

-- HIIT
('Box jumps',              'Explosiva hopp upp på en box. Bygger explosiv benstyrka.',          'hiit', 'intermediate'),
('Jump squats',            'Knäböj och explodera uppåt. Hårt för lår och lungor.',             'hiit', 'intermediate'),
('Battle ropes',           'Vågrörelse med tjocka rep. Axlar, core och kondition.',            'hiit', 'intermediate'),
('Wall balls',             'Kastboll mot väggen från djup knäböj. CrossFit-klassiker.',        'hiit', 'intermediate'),
('Devil press',            'Burpee + hantellyft ovan huvud. En av de hårdaste HIIT-övningarna.','hiit', 'advanced'),
('Kettlebell circuit',     'Cirkelträning med kettlebell, swing, clean, press i sekvens.',    'hiit', 'intermediate'),
('Sprint 100m',            '10–12 sekunder maximal ansträngning. Vila 90 sek, upprepa.',        'hiit', 'advanced'),
('Jump rope double under', 'Hopprep med dubbel rotation per hopp. Kräver timing och kondition.','hiit', 'advanced')

ON CONFLICT DO NOTHING;

-- Kabelövningar och kompletteringar (20260730)
INSERT INTO exercises (name, description, category, difficulty) VALUES

-- STYRKA: BRÖST (kabel och hantlar)
('Kabelpress',              'Stående press i kabelkors. Konstant spänning genom hela rörelsen.',    'strength', 'beginner'),
('Kabelflyes',              'Flyes i kabelkors. Spänning även i botten där hantlar tappar.',         'strength', 'intermediate'),
('Lutande kabelflyes',      'Flyes snett uppåt i kabel. Betonar övre bröstet.',                      'strength', 'intermediate'),
('Flyes med hantlar',       'Öppna famnen liggande. Stretch och isolering för bröstet.',             'strength', 'beginner'),
('Lutande hantelpress',     'Hantelpress på lutande bänk. Övre bröstet i fokus.',                    'strength', 'intermediate'),

-- STYRKA: RYGG (kabel och shrugs)
('Stående kabelrodd',       'Rodd stående i kabelkors. Core jobbar med hela vägen.',                 'strength', 'beginner'),
('Enarms kabelrodd',        'Unilateral kabelrodd. Full rotation och jämn belastning.',              'strength', 'beginner'),
('Latsdrag med raka armar', 'Raka armar, dra stången till höfterna. Isolerar lats.',                 'strength', 'intermediate'),
('Latsdrag smalt grepp',    'Smalt neutralgrepp, djupare drag och mer biceps.',                      'strength', 'beginner'),
('Kabelpullover',           'Pullover i kabel. Lats och bröstkorg utan axelstress.',                 'strength', 'intermediate'),
('Shrugs med hantlar',      'Lyft axlarna rakt upp. Bygger trapezius.',                              'strength', 'beginner'),
('Shrugs med skivstång',    'Tunga shrugs med stång. Håll armarna raka.',                            'strength', 'beginner'),
('Good mornings',           'Fäll höften med stång på ryggen. Baksida lår och ländrygg.',            'strength', 'intermediate'),

-- STYRKA: AXLAR (kabel och bakre delta)
('Frontlyft i kabel',       'Frontlyft med konstant kabelspänning. Främre deltamuskeln.',            'strength', 'beginner'),
('Bakre deltalyft i kabel', 'Korsade kablar, dra ut och bak. Bakre delta isolerat.',                 'strength', 'intermediate'),
('Omvänd flyes',            'Framåtlutad, lyft ut åt sidorna. Bakre delta och skulderblad.',         'strength', 'beginner'),
('Landmine press',          'Press med stång i landmine-fäste. Skonsam vinkel för axeln.',           'strength', 'intermediate'),

-- STYRKA: ARMAR (kabel och grepp)
('Kabelcurl med rep',       'Curl med rep i kabel. Neutral handled, konstant spänning.',             'strength', 'beginner'),
('Enarms kabelcurl',        'Isolerad curl i kabel, en arm i taget.',                                'strength', 'beginner'),
('Tricepsstötning med rep', 'Pressa ner och isär repet. Hela triceps aktiveras.',                    'strength', 'beginner'),
('Kabeltriceps över huvud', 'Extension över huvudet i kabel. Långa tricepshuvudet.',                 'strength', 'intermediate'),
('Handledscurl',            'Curla handlederna med stång eller hantel. Greppstyrka.',                'strength', 'beginner'),

-- STYRKA: BEN OCH SÄTE (kabel och maskin)
('Sittande bencurl',        'Bencurl i sittande maskin. Hamstrings i nytt läge.',                    'strength', 'beginner'),
('Sittande vadpress',       'Vadpress sittande med böjt knä. Träffar soleus.',                       'strength', 'beginner'),
('Glute kickback i kabel',  'Spark bakåt med kabel vid ankeln. Isolerar sätet.',                     'strength', 'beginner'),
('Höftabduktion i kabel',   'För benet utåt mot kabelmotstånd. Yttre säte och höft.',                'strength', 'beginner'),
('Genomdrag med kabel',     'Höftfällning med kabel mellan benen. Säte och baksida.',                'strength', 'beginner'),
('Nordic curl',             'Sänk dig framåt med låsta fötter. Brutal för hamstrings.',              'strength', 'advanced'),
('Front squat',             'Knäböj med stången fram. Mer quadriceps, rakare rygg.',                 'strength', 'intermediate'),
('Pistol squat',            'Enbensknäböj till botten. Styrka, balans och rörlighet.',               'strength', 'advanced'),

-- STYRKA: MAGE (kabel och anti-rotation)
('Kabelvridning',           'Rotera bålen mot kabelmotstånd. Snedmagsmuskler i arbete.',             'strength', 'intermediate'),
('Pallof press',            'Pressa kabeln rakt fram utan att rotera. Anti-rotation för core.',      'strength', 'beginner'),
('Benlyft liggande',        'Ligg på rygg, lyft raka ben. Nedre magen jobbar.',                      'strength', 'beginner')
ON CONFLICT (name, category) DO NOTHING;

-- Övningsbilder (måste ligga efter inserterna: db reset kör seed sist)
UPDATE exercises SET image_path = 'Ab_Roller.jpg' WHERE name = 'Ab wheel' AND category = 'strength';
UPDATE exercises SET image_path = 'Arnold_Dumbbell_Press.jpg' WHERE name = 'Arnold press' AND category = 'strength';
UPDATE exercises SET image_path = 'Cable_Seated_Lateral_Raise.jpg' WHERE name = 'Axellyft med kabel' AND category = 'strength';
UPDATE exercises SET image_path = 'Seated_Bent-Over_Rear_Delt_Raise.jpg' WHERE name = 'Bakre deltalyft' AND category = 'strength';
UPDATE exercises SET image_path = 'Cable_Rear_Delt_Fly.jpg' WHERE name = 'Bakre deltalyft i kabel' AND category = 'strength';
UPDATE exercises SET image_path = 'Lying_Leg_Curls.jpg' WHERE name = 'Bencurl liggande' AND category = 'strength';
UPDATE exercises SET image_path = 'Leg_Extensions.jpg' WHERE name = 'Benextension' AND category = 'strength';
UPDATE exercises SET image_path = 'Flat_Bench_Lying_Leg_Raise.jpg' WHERE name = 'Benlyft liggande' AND category = 'strength';
UPDATE exercises SET image_path = 'Leg_Press.jpg' WHERE name = 'Benpress' AND category = 'strength';
UPDATE exercises SET image_path = 'Barbell_Curl.jpg' WHERE name = 'Bicepscurl' AND category = 'strength';
UPDATE exercises SET image_path = 'Box_Squat.jpg' WHERE name = 'Box squat' AND category = 'strength';
UPDATE exercises SET image_path = 'Split_Squats.jpg' WHERE name = 'Bulgariska utfall' AND category = 'strength';
UPDATE exercises SET image_path = 'Barbell_Bench_Press_-_Medium_Grip.jpg' WHERE name = 'Bänkpress' AND category = 'strength';
UPDATE exercises SET image_path = 'Chin-Up.jpg' WHERE name = 'Chin-ups' AND category = 'strength';
UPDATE exercises SET image_path = 'Crunches.jpg' WHERE name = 'Crunches' AND category = 'strength';
UPDATE exercises SET image_path = 'Decline_Barbell_Bench_Press.jpg' WHERE name = 'Decline bänkpress' AND category = 'strength';
UPDATE exercises SET image_path = 'Parallel_Bar_Dip.jpg' WHERE name = 'Dips' AND category = 'strength';
UPDATE exercises SET image_path = 'One-Arm_Dumbbell_Row.jpg' WHERE name = 'Enarms hantelrodd' AND category = 'strength';
UPDATE exercises SET image_path = 'Standing_One-Arm_Cable_Curl.jpg' WHERE name = 'Enarms kabelcurl' AND category = 'strength';
UPDATE exercises SET image_path = 'Seated_One-arm_Cable_Pulley_Rows.jpg' WHERE name = 'Enarms kabelrodd' AND category = 'strength';
UPDATE exercises SET image_path = 'Face_Pull.jpg' WHERE name = 'Face pulls' AND category = 'strength';
UPDATE exercises SET image_path = 'Farmers_Walk.jpg' WHERE name = 'Farmers walk' AND category = 'strength';
UPDATE exercises SET image_path = 'Dumbbell_Flyes.jpg' WHERE name = 'Flyes med hantlar' AND category = 'strength';
UPDATE exercises SET image_path = 'Power_Clean.jpg' WHERE name = 'Frivändning' AND category = 'strength';
UPDATE exercises SET image_path = 'Front_Barbell_Squat.jpg' WHERE name = 'Front squat' AND category = 'strength';
UPDATE exercises SET image_path = 'Front_Dumbbell_Raise.jpg' WHERE name = 'Frontlyft' AND category = 'strength';
UPDATE exercises SET image_path = 'Front_Cable_Raise.jpg' WHERE name = 'Frontlyft i kabel' AND category = 'strength';
UPDATE exercises SET image_path = 'Pull_Through.jpg' WHERE name = 'Genomdrag med kabel' AND category = 'strength';
UPDATE exercises SET image_path = 'One-Legged_Cable_Kickback.jpg' WHERE name = 'Glute kickback i kabel' AND category = 'strength';
UPDATE exercises SET image_path = 'Goblet_Squat.jpg' WHERE name = 'Goblet squat' AND category = 'strength';
UPDATE exercises SET image_path = 'Good_Morning.jpg' WHERE name = 'Good mornings' AND category = 'strength';
UPDATE exercises SET image_path = 'Hack_Squat.jpg' WHERE name = 'Hack squat' AND category = 'strength';
UPDATE exercises SET image_path = 'Hammer_Curls.jpg' WHERE name = 'Hammercurl' AND category = 'strength';
UPDATE exercises SET image_path = 'Seated_Palm-Up_Barbell_Wrist_Curl.jpg' WHERE name = 'Handledscurl' AND category = 'strength';
UPDATE exercises SET image_path = 'Dumbbell_Shoulder_Press.jpg' WHERE name = 'Hantelpress axlar' AND category = 'strength';
UPDATE exercises SET image_path = 'Dumbbell_Bench_Press.jpg' WHERE name = 'Hantelpress liggande' AND category = 'strength';
UPDATE exercises SET image_path = 'Barbell_Hip_Thrust.jpg' WHERE name = 'Hip thrust' AND category = 'strength';
UPDATE exercises SET image_path = 'Hyperextensions_Back_Extensions.jpg' WHERE name = 'Hyperextensions' AND category = 'strength';
UPDATE exercises SET image_path = 'Hanging_Leg_Raise.jpg' WHERE name = 'Hängande benlyft' AND category = 'strength';
UPDATE exercises SET image_path = 'Thigh_Abductor.jpg' WHERE name = 'Höftabduktion i kabel' AND category = 'strength';
UPDATE exercises SET image_path = 'Standing_Biceps_Cable_Curl.jpg' WHERE name = 'Kabelbiceps' AND category = 'strength';
UPDATE exercises SET image_path = 'Cable_Crunch.jpg' WHERE name = 'Kabelcrunch' AND category = 'strength';
UPDATE exercises SET image_path = 'Cable_Hammer_Curls_-_Rope_Attachment.jpg' WHERE name = 'Kabelcurl med rep' AND category = 'strength';
UPDATE exercises SET image_path = 'Flat_Bench_Cable_Flyes.jpg' WHERE name = 'Kabelflyes' AND category = 'strength';
UPDATE exercises SET image_path = 'Cable_Crossover.jpg' WHERE name = 'Kabelkorsning' AND category = 'strength';
UPDATE exercises SET image_path = 'Cable_Chest_Press.jpg' WHERE name = 'Kabelpress' AND category = 'strength';
UPDATE exercises SET image_path = 'Straight-Arm_Dumbbell_Pullover.jpg' WHERE name = 'Kabelpullover' AND category = 'strength';
UPDATE exercises SET image_path = 'Seated_Cable_Rows.jpg' WHERE name = 'Kabelrodd sittande' AND category = 'strength';
UPDATE exercises SET image_path = 'Cable_Rope_Overhead_Triceps_Extension.jpg' WHERE name = 'Kabeltriceps över huvud' AND category = 'strength';
UPDATE exercises SET image_path = 'Standing_Cable_Wood_Chop.jpg' WHERE name = 'Kabelvridning' AND category = 'strength';
UPDATE exercises SET image_path = 'One-Arm_Kettlebell_Swings.jpg' WHERE name = 'Kettlebell swing' AND category = 'strength';
UPDATE exercises SET image_path = 'Barbell_Squat.jpg' WHERE name = 'Knäböj' AND category = 'strength';
UPDATE exercises SET image_path = 'Concentration_Curls.jpg' WHERE name = 'Koncentrationscurl' AND category = 'strength';
UPDATE exercises SET image_path = 'Landmine_Linear_Jammer.jpg' WHERE name = 'Landmine press' AND category = 'strength';
UPDATE exercises SET image_path = 'Wide-Grip_Pulldown_Behind_The_Neck.jpg' WHERE name = 'Latsdrag bakåt' AND category = 'strength';
UPDATE exercises SET image_path = 'Wide-Grip_Lat_Pulldown.jpg' WHERE name = 'Latsdrag framifrån' AND category = 'strength';
UPDATE exercises SET image_path = 'Straight-Arm_Pulldown.jpg' WHERE name = 'Latsdrag med raka armar' AND category = 'strength';
UPDATE exercises SET image_path = 'Close-Grip_Front_Lat_Pulldown.jpg' WHERE name = 'Latsdrag smalt grepp' AND category = 'strength';
UPDATE exercises SET image_path = 'Barbell_Incline_Bench_Press_-_Medium_Grip.jpg' WHERE name = 'Lutande bänkpress' AND category = 'strength';
UPDATE exercises SET image_path = 'Incline_Dumbbell_Press.jpg' WHERE name = 'Lutande hantelpress' AND category = 'strength';
UPDATE exercises SET image_path = 'Incline_Cable_Flye.jpg' WHERE name = 'Lutande kabelflyes' AND category = 'strength';
UPDATE exercises SET image_path = 'Barbell_Deadlift.jpg' WHERE name = 'Marklyft' AND category = 'strength';
UPDATE exercises SET image_path = 'Standing_Military_Press.jpg' WHERE name = 'Militärpress' AND category = 'strength';
UPDATE exercises SET image_path = 'Mountain_Climbers.jpg' WHERE name = 'Mountain climbers' AND category = 'strength';
UPDATE exercises SET image_path = 'Natural_Glute_Ham_Raise.jpg' WHERE name = 'Nordic curl' AND category = 'strength';
UPDATE exercises SET image_path = 'Reverse_Flyes.jpg' WHERE name = 'Omvänd flyes' AND category = 'strength';
UPDATE exercises SET image_path = 'Pallof_Press.jpg' WHERE name = 'Pallof press' AND category = 'strength';
UPDATE exercises SET image_path = 'Butterfly.jpg' WHERE name = 'Pec deck' AND category = 'strength';
UPDATE exercises SET image_path = 'Kettlebell_Pistol_Squat.jpg' WHERE name = 'Pistol squat' AND category = 'strength';
UPDATE exercises SET image_path = 'Plank.jpg' WHERE name = 'Plankan' AND category = 'strength';
UPDATE exercises SET image_path = 'Preacher_Curl.jpg' WHERE name = 'Preacher curl' AND category = 'strength';
UPDATE exercises SET image_path = 'Pullups.jpg' WHERE name = 'Pull-ups' AND category = 'strength';
UPDATE exercises SET image_path = 'Push_Press.jpg' WHERE name = 'Push press' AND category = 'strength';
UPDATE exercises SET image_path = 'Pushups.jpg' WHERE name = 'Push-ups' AND category = 'strength';
UPDATE exercises SET image_path = 'Rack_Pulls.jpg' WHERE name = 'Rack pull' AND category = 'strength';
UPDATE exercises SET image_path = 'Bent_Over_Barbell_Row.jpg' WHERE name = 'Rodd med skivstång' AND category = 'strength';
UPDATE exercises SET image_path = 'Romanian_Deadlift.jpg' WHERE name = 'Rumänsk marklyft' AND category = 'strength';
UPDATE exercises SET image_path = 'Russian_Twist.jpg' WHERE name = 'Russian twist' AND category = 'strength';
UPDATE exercises SET image_path = 'Dumbbell_Shrug.jpg' WHERE name = 'Shrugs med hantlar' AND category = 'strength';
UPDATE exercises SET image_path = 'Barbell_Shrug.jpg' WHERE name = 'Shrugs med skivstång' AND category = 'strength';
UPDATE exercises SET image_path = 'Side_Lateral_Raise.jpg' WHERE name = 'Sidolyft' AND category = 'strength';
UPDATE exercises SET image_path = 'Side_Bridge.jpg' WHERE name = 'Sidoplanka' AND category = 'strength';
UPDATE exercises SET image_path = 'Seated_Leg_Curl.jpg' WHERE name = 'Sittande bencurl' AND category = 'strength';
UPDATE exercises SET image_path = 'Seated_Calf_Raise.jpg' WHERE name = 'Sittande vadpress' AND category = 'strength';
UPDATE exercises SET image_path = 'Sit-Up.jpg' WHERE name = 'Situps' AND category = 'strength';
UPDATE exercises SET image_path = 'EZ-Bar_Skullcrusher.jpg' WHERE name = 'Skull crushers' AND category = 'strength';
UPDATE exercises SET image_path = 'Close-Grip_Barbell_Bench_Press.jpg' WHERE name = 'Smalbänkpress' AND category = 'strength';
UPDATE exercises SET image_path = 'Barbell_Step_Ups.jpg' WHERE name = 'Steg-ups' AND category = 'strength';
UPDATE exercises SET image_path = 'Sumo_Deadlift.jpg' WHERE name = 'Sumo marklyft' AND category = 'strength';
UPDATE exercises SET image_path = 'T-Bar_Row_with_Handle.jpg' WHERE name = 'T-bar rodd' AND category = 'strength';
UPDATE exercises SET image_path = 'Kettlebell_Thruster.jpg' WHERE name = 'Thrusters' AND category = 'strength';
UPDATE exercises SET image_path = 'Tricep_Dumbbell_Kickback.jpg' WHERE name = 'Triceps kickback' AND category = 'strength';
UPDATE exercises SET image_path = 'Close-Grip_Barbell_Bench_Press.jpg' WHERE name = 'Tricepspress smal' AND category = 'strength';
UPDATE exercises SET image_path = 'Triceps_Pushdown.jpg' WHERE name = 'Tricepsstötning kabel' AND category = 'strength';
UPDATE exercises SET image_path = 'Triceps_Pushdown_-_Rope_Attachment.jpg' WHERE name = 'Tricepsstötning med rep' AND category = 'strength';
UPDATE exercises SET image_path = 'Upright_Barbell_Row.jpg' WHERE name = 'Upright row' AND category = 'strength';
UPDATE exercises SET image_path = 'Dumbbell_Lunges.jpg' WHERE name = 'Utfall' AND category = 'strength';
UPDATE exercises SET image_path = 'Standing_Calf_Raises.jpg' WHERE name = 'Vadpress stående' AND category = 'strength';

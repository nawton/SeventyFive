-- Kör detta i Supabase SQL Editor för att lägga till fler övningar
-- Dashboard → SQL Editor → New query → klistra in → Run

INSERT INTO exercises (name, description, category, difficulty) VALUES

-- ── STYRKA: BRÖST ──────────────────────────────────────────────────────────────
('Hantelpress liggande',   'Tränar hela bröstet med bättre rörelseomfång än skivstång.',        'strength', 'beginner'),
('Lutande bänkpress',      'Betonar övre bröstet. Skivstång eller hantlar på lutande bänk.',    'strength', 'intermediate'),
('Decline bänkpress',      'Nedre bröstet i fokus. Bra komplement till vanlig bänkpress.',       'strength', 'intermediate'),
('Push-ups',               'Klassisk kroppsviktsövning. Skala med knä eller lyft fötterna.',    'strength', 'beginner'),
('Dips',                   'Bröst och triceps. Luta framåt för mer bröst, upprätt för triceps.', 'strength', 'intermediate'),
('Kabelkorsning',          'Isolerar bröstet i toppen av rörelsen. Bra pump-övning.',            'strength', 'intermediate'),
('Smalbänkpress',          'Närgripet grepp — mer triceps och inre bröst.',                     'strength', 'intermediate'),
('Pec deck',               'Maskinövning som isolerar bröstet utan axelbelastning.',             'strength', 'beginner'),

-- ── STYRKA: RYGG ───────────────────────────────────────────────────────────────
('Latsdrag framifrån',     'Breda ryggar byggs med latsdrag. Dra till bröstets höjd.',          'strength', 'beginner'),
('Rodd med skivstång',     'Tung ryggövning. Håll ryggen parallell med golvet.',                'strength', 'intermediate'),
('Enarms hantelrodd',      'Unilateral rörelse — korrigerar sidoskillnader i ryggstyrkan.',     'strength', 'beginner'),
('Kabelrodd sittande',     'Jämn belastning hela vägen. Bra för övre och mellersta ryggen.',    'strength', 'beginner'),
('T-bar rodd',             'Mellanting mellan skivstångsrodd och maskin. Tung grundövning.',    'strength', 'intermediate'),
('Face pulls',             'Skyddar axlarna och bygger bakre deltamuskeln. Gör det ofta.',      'strength', 'beginner'),
('Hyperextensions',        'Stärker nedre ryggen, sätesmusklerna och hamstrings.',              'strength', 'beginner'),
('Rack pull',              'Partiell marklyft från rack — lastar ryggen tungt och säkert.',      'strength', 'advanced'),
('Chin-ups',               'Undersidesgreppt pull-up. Mer biceps-aktivering än pull-ups.',      'strength', 'intermediate'),
('Latsdrag bakåt',         'Varianten bakom nacken. Tränar breda ryggen brett.',                'strength', 'intermediate'),

-- ── STYRKA: BEN ────────────────────────────────────────────────────────────────
('Benpress',               'Maskinalternativ till knäböj. Lättare på ryggen, tungt på benen.',  'strength', 'beginner'),
('Utfall',                 'Unilateral benövning för lår och säte. Håll överkroppen upprätt.',  'strength', 'beginner'),
('Bulgariska utfall',      'Bakre fot upphöjd — enorm stretch och aktivering av sätet.',        'strength', 'intermediate'),
('Rumänsk marklyft',       'Hamstrings och säte. Känn stretchen — stoppa när ryggen rundas.',   'strength', 'intermediate'),
('Bencurl liggande',       'Isolerar hamstrings. Kör kontrollerat hela rörelseomfånget.',       'strength', 'beginner'),
('Benextension',           'Isolerar quadriceps. Bra komplement till knäböj.',                  'strength', 'beginner'),
('Vadpress stående',       'Vader bygger du med hög volym. 15–25 reps per set.',                'strength', 'beginner'),
('Goblet squat',           'Hantel framför bröstet. Fantastisk för teknik och höfterna.',       'strength', 'beginner'),
('Hip thrust',             'Den bästa sätesövningen. Skivstång över höfterna på bänk.',         'strength', 'intermediate'),
('Sumo marklyft',          'Bredare stans, mer höfter och inre lår. Alternativ till konvensionell.', 'strength', 'intermediate'),
('Box squat',              'Sätt ner på låda, pausa, res upp. Bygger explosiv styrka.',         'strength', 'intermediate'),
('Hack squat',             'Maskin-knäböj med säker backsupport. Bra för lår.',                 'strength', 'beginner'),
('Steg-ups',               'Steg upp på bänk med vikt. Funktionell och ensidig styrka.',        'strength', 'beginner'),

-- ── STYRKA: AXLAR ──────────────────────────────────────────────────────────────
('Hantelpress axlar',      'Sittande eller stående axelpress med hantlar.',                     'strength', 'beginner'),
('Sidolyft',               'Isolerar mellersta deltamuskeln. Lättare vikt, fullt omfång.',      'strength', 'beginner'),
('Frontlyft',              'Tränar främre deltamuskeln. Hantlar eller skivstång.',              'strength', 'beginner'),
('Bakre deltalyft',        'Böj framåt och lyft hantlarna ut. Viktig för balansen i axlarna.',  'strength', 'beginner'),
('Arnold press',           'Rotation under press. Tränar alla tre deltadelar.',                 'strength', 'intermediate'),
('Upright row',            'Lyft stången längs kroppen till hakan. Axlar och trapezius.',       'strength', 'intermediate'),
('Axellyft med kabel',     'Stabil belastning genom hela rörelsen. Bra isolationsövning.',     'strength', 'beginner'),

-- ── STYRKA: ARMAR ──────────────────────────────────────────────────────────────
('Bicepscurl',             'Klassisk armövning med hantlar eller skivstång.',                   'strength', 'beginner'),
('Hammercurl',             'Neutralt grepp — tränar brachialis och underarm.',                  'strength', 'beginner'),
('Koncentrationscurl',     'Arm mot insidan av låret. Maximalt fokus på biceps.',               'strength', 'beginner'),
('Kabelbiceps',            'Konstant spänning via kabel. Bra pump.',                            'strength', 'beginner'),
('Preacher curl',          'Armbågen stödd på pult — ingen fusk möjlig. Ren bicepsövning.',    'strength', 'intermediate'),
('Tricepsstötning kabel',  'Kabelmaskin, driv ner till lås. Isolerar triceps.',                 'strength', 'beginner'),
('Skull crushers',         'Hantlar eller stång till pannan. Tungt triceps-arbete.',             'strength', 'intermediate'),
('Triceps kickback',       'Böj framåt, sträck armen bakåt. Känn muskelns topp.',              'strength', 'beginner'),
('Tricepspress smal',      'Smalt grepp på bänk. Bygger tjocka triceps.',                       'strength', 'intermediate'),

-- ── STYRKA: MAGE / CORE ────────────────────────────────────────────────────────
('Plankan',                'Håll kroppen rak som en planka. Bygg upp tid progressivt.',         'strength', 'beginner'),
('Situps',                 'Klassisk magövning. Håll fötterna i golvet.',                       'strength', 'beginner'),
('Crunches',               'Kortare rörelse än situps — mer isolerat för raka magmuskeln.',     'strength', 'beginner'),
('Russian twist',          'Rotera med vikt. Tränar snedmagsmuskler och core.',                 'strength', 'intermediate'),
('Hängande benlyft',       'Häng i bom och lyft benen. Kräver styrka och kontroll.',           'strength', 'advanced'),
('Ab wheel',               'Rulla ut och tillbaka. En av de tuffaste magövningarna.',           'strength', 'advanced'),
('Kabelcrunch',            'Kabelmaskin mot golvet. Laddat magarbete i hela omfånget.',         'strength', 'intermediate'),
('Sidoplanka',             'Som plankan men på sidan. Isolerar snedmagsmuskler.',               'strength', 'beginner'),
('Mountain climbers',      'Löpning i plankposition. Kondition och core i ett.',                'strength', 'beginner'),
('Dragon flag',            'Avancerad kärnövning inspirerad av Bruce Lee. Fullt kontroll.',     'strength', 'advanced'),

-- ── STYRKA: HELKROPP ───────────────────────────────────────────────────────────
('Frivändning',            'Olympisk lyftteknik. Kräver rörlighet, explosivitet och teknik.',  'strength', 'advanced'),
('Push press',             'Axelpress med benbipp. Mer last, mer explosivitet.',                'strength', 'intermediate'),
('Farmers walk',           'Gå med tung vikt i varje hand. Grip och core brinner.',            'strength', 'beginner'),
('Kettlebell swing',       'Hip hinge med fart. Kondition och bakre kedjan i ett.',             'strength', 'intermediate'),
('Thrusters',              'Knäböj + axelpress i ett flöde. Hemsk och effektiv.',              'strength', 'advanced'),

-- ── CARDIO ─────────────────────────────────────────────────────────────────────
('Promenad',               'Aktiv återhämtning. Lägre intensitet men räknas varje steg.',      'cardio', 'beginner'),
('Backlöpning',            'Kortare intervaller i backe. Bygger explosiv styrka och kondition.','cardio', 'advanced'),
('Simning',                'Lågbelastad fullkroppsträning. Perfekt vid skador.',                'cardio', 'beginner'),
('Rodd maskin',            'Kraftfullt drag — 86 % av kroppens muskler aktiveras.',            'cardio', 'intermediate'),
('Stairmaster',            'Klättra i trappor. Hög puls, stark nedre kropp.',                  'cardio', 'intermediate'),
('Elliptical',             'Konditionsmaskin med låg belastning på lederna.',                   'cardio', 'beginner'),

-- ── RÖRLIGHET ──────────────────────────────────────────────────────────────────
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

-- ── HIIT ───────────────────────────────────────────────────────────────────────
('Box jumps',              'Explosiva hopp upp på en box. Bygger explosiv benstyrka.',          'hiit', 'intermediate'),
('Jump squats',            'Knäböj och explodera uppåt. Hårt för lår och lungor.',             'hiit', 'intermediate'),
('Battle ropes',           'Vågrörelse med tjocka rep. Axlar, core och kondition.',            'hiit', 'intermediate'),
('Wall balls',             'Kastboll mot väggen från djup knäböj. CrossFit-klassiker.',        'hiit', 'intermediate'),
('Devil press',            'Burpee + hantellyft ovan huvud. En av de hårdaste HIIT-övningarna.','hiit', 'advanced'),
('Kettlebell circuit',     'Cirkelträning med kettlebell — swing, clean, press i sekvens.',    'hiit', 'intermediate'),
('Sprint 100m',            '10–12 sekunder maximal ansträngning. Vila 90 sek, upprepa.',        'hiit', 'advanced'),
('Jump rope double under', 'Hopprep med dubbel rotation per hopp. Kräver timing och kondition.','hiit', 'advanced')
ON CONFLICT (name, category) DO NOTHING;

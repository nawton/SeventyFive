-- Fler övningar i biblioteket: kabelfokus plus luckor i varje muskelgrupp.
-- Idempotent, kan köras flera gånger.
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

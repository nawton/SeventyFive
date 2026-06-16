-- =============================================================================
-- SEVENTYFIVE BY NAWTON — INITIAL SCHEMA
-- =============================================================================
-- Varje tabell följer samma principer:
--   • UUID primärnycklar (säkrare och skalbarare än serienummer)
--   • created_at med DEFAULT NOW() så vi aldrig glömmer att logga tid
--   • Row Level Security (RLS) på alla tabeller med användardata
--   • Foreign keys med ON DELETE CASCADE så vi aldrig lämnar orphans i databasen
-- =============================================================================


-- =============================================================================
-- EXTENSIONS
-- Aktivera UUID-generering. Supabase har detta på som standard
-- men vi inkluderar det explicit för tydlighet.
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =============================================================================
-- PROFILES
-- Supabase hanterar auth (email, lösenord, OAuth) i auth.users.
-- Vi skapar en profiles-tabell som är en 1:1-utökning av den tabellen
-- med all appspecifik data om användaren.
-- =============================================================================
CREATE TABLE profiles (
  -- Primärnyckeln pekar direkt på Supabase auth-systemets user-rad.
  -- ON DELETE CASCADE innebär att om en användare raderas i auth,
  -- raderas även deras profil automatiskt.
  id                   UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  name                 TEXT,
  avatar_url           TEXT,

  -- Prenumerationsstatus styr vilka delar av appen som är upplåsta.
  -- 'trial'   = de första 7 dagarna (gratis)
  -- 'active'  = betalat 299 kr, full tillgång
  -- 'expired' = trial gick ut utan betalning
  subscription_status  TEXT        NOT NULL DEFAULT 'trial'
                       CHECK (subscription_status IN ('trial', 'active', 'expired')),

  trial_started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_completed_at TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- CHALLENGE LEVELS
-- Definierar de tre svårighetsgraderna: Normal, Hard, Extreme.
-- Dessa skapas via seed.sql och ändras inte av användare.
-- =============================================================================
CREATE TABLE challenge_levels (
  id           UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- 'normal' | 'hard' | 'extreme' — används programmatiskt
  slug         TEXT  NOT NULL UNIQUE CHECK (slug IN ('normal', 'hard', 'extreme')),
  -- "Nawton Hard" — det som visas i UI:t
  display_name TEXT  NOT NULL,
  description  TEXT  NOT NULL,
  -- Lagrar reglerna som JSON-array: [{"rule": "Träna 45 min", "icon": "dumbbell"}]
  -- JSONB är binärt JSON — snabbare att söka i än TEXT
  rules        JSONB NOT NULL DEFAULT '[]'
);


-- =============================================================================
-- QUIZ RESULTS
-- Sparar användarens svar från onboarding-quizet.
-- Används av AI:n för att skräddarsy motivation och push-notiser.
-- =============================================================================
CREATE TABLE quiz_results (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Användarens formulerade "Varför" — kärnan i motivationssystemet.
  -- AI:n refererar tillbaka till detta när den krossar ursäkter.
  why_answer            TEXT        NOT NULL,

  -- Svar på quizfrågorna. Flexibel JSONB-struktur:
  -- [{"question": "Hur hårt vill du pressas?", "answer": "Maximalt"}]
  goal_answers          JSONB       NOT NULL DEFAULT '[]',

  -- 1–10 skala från quizet, används för att välja nivå
  pressure_level        SMALLINT    NOT NULL CHECK (pressure_level BETWEEN 1 AND 10),

  recommended_level_id  UUID        NOT NULL REFERENCES challenge_levels(id),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- USER CHALLENGES
-- Representerar en aktiv körning av 75-dagarsutmaningen.
-- En användare kan ha flera (om de startar om), men bara en 'active' åt gången.
-- =============================================================================
CREATE TABLE user_challenges (
  id          UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID     NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level_id    UUID     NOT NULL REFERENCES challenge_levels(id),

  start_date  DATE     NOT NULL DEFAULT CURRENT_DATE,

  -- Dag 1–75. Uppdateras via en Supabase Edge Function vid midnatt varje dag.
  current_day SMALLINT NOT NULL DEFAULT 1 CHECK (current_day BETWEEN 1 AND 75),

  status      TEXT     NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'failed', 'completed')),

  -- Om utmaningen misslyckades, loggar vi vilken dag det hände
  failed_on_day SMALLINT CHECK (failed_on_day BETWEEN 1 AND 75),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Förhindrar att samma användare har två aktiva utmaningar samtidigt.
-- En partiell unik constraint är renare än en trigger för detta ändamål.
CREATE UNIQUE INDEX one_active_challenge_per_user
  ON user_challenges (user_id)
  WHERE (status = 'active');


-- =============================================================================
-- TASK TEMPLATES
-- Mallar för vilka dagliga uppgifter som ingår i varje nivå.
-- Skapas via seed.sql. Exempelvis:
--   Normal: Träna 30 min, Drick 2L vatten, Läs 10 sidor
--   Extreme: Träna 60 min x2, Drick 4L vatten, Läs 30 sidor
-- =============================================================================
CREATE TABLE task_templates (
  id           UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
  level_id     UUID     NOT NULL REFERENCES challenge_levels(id),

  -- Kategorin avgör vilken ikon och sektion uppgiften visas i
  type         TEXT     NOT NULL
               CHECK (type IN ('workout', 'diet', 'water', 'reading', 'photo')),

  name         TEXT     NOT NULL,
  description  TEXT,

  -- Kvantitativt mål. Kombineras med unit för att bli t.ex. "3 liter", "30 minuter"
  target_value NUMERIC,
  unit         TEXT     -- 'liter' | 'minutes' | 'pages' | 'sessions'
);


-- =============================================================================
-- DAILY LOGS
-- En rad per dag per pågående utmaning.
-- Skapas automatiskt vid midnatt av en Edge Function.
-- UNIQUE(challenge_id, day_number) garanterar att det aldrig finns
-- två loggar för samma dag i samma utmaning.
-- =============================================================================
CREATE TABLE daily_logs (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID        NOT NULL REFERENCES user_challenges(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  day_number   SMALLINT    NOT NULL CHECK (day_number BETWEEN 1 AND 75),
  date         DATE        NOT NULL DEFAULT CURRENT_DATE,

  status       TEXT        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'completed', 'failed')),

  -- Dagens korta reflektion — byggs upp till slutrapporten dag 75
  reflection   TEXT,

  -- Sätts när alla task_completions är markerade som klara
  completed_at TIMESTAMPTZ,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (challenge_id, day_number)
);


-- =============================================================================
-- TASK COMPLETIONS
-- Varje rad representerar om en specifik uppgift är klar för en specifik dag.
-- Skapas automatiskt (en rad per task_template) när daily_log skapas.
-- =============================================================================
CREATE TABLE task_completions (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_log_id      UUID        NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  task_template_id  UUID        NOT NULL REFERENCES task_templates(id),

  completed         BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at      TIMESTAMPTZ,

  -- "Ursäkts-krossaren": användaren skriver varför de misslyckades
  failed_reason     TEXT,
  -- AI:ns svar — motivationsmeddelandet som vänder ursäkten
  ai_coach_response TEXT,

  UNIQUE (daily_log_id, task_template_id)
);


-- =============================================================================
-- EXERCISES
-- Övningsbiblioteket. Adminstyrd data — användare kan inte skapa egna övningar.
-- Skapas via seed.sql med Nawtons utvalda övningar per nivå.
-- =============================================================================
CREATE TABLE exercises (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT    NOT NULL,
  description TEXT,
  video_url   TEXT,

  category    TEXT    NOT NULL
              CHECK (category IN ('strength', 'cardio', 'mobility', 'hiit')),

  difficulty  TEXT    NOT NULL
              CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- USER WORKOUTS
-- Användarens sparade träningspass. Exercises lagras som JSONB-array
-- för att undvika en extra join-tabell (workout_exercises).
-- Format: [{"exercise_id": "uuid", "sets": 3, "reps": 10, "duration_seconds": null}]
-- =============================================================================
CREATE TABLE user_workouts (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  name        TEXT    NOT NULL,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,

  exercises   JSONB   NOT NULL DEFAULT '[]',

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- USER SCHEDULES
-- Användarens personliga dagschema med väckningstid, måltider och pass.
-- UNIQUE på user_id = en användare har exakt ett schema (upsert-mönster).
-- =============================================================================
CREATE TABLE user_schedules (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  wake_time       TIME,

  -- Format: [{"label": "Frukost", "time": "07:30"}, {"label": "Lunch", "time": "12:00"}]
  meal_times      JSONB   NOT NULL DEFAULT '[]',

  -- Format: [{"label": "Morgonpass", "time": "06:00"}, {"label": "Kvällspass", "time": "18:00"}]
  workout_times   JSONB   NOT NULL DEFAULT '[]',

  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,

  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- PROGRESS PHOTOS
-- Användarens fotodagbok. is_public = TRUE gör att bilden syns i communityt.
-- Bilderna lagras i Supabase Storage — detta är bara metadata + URL.
-- =============================================================================
CREATE TABLE progress_photos (
  id           UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID     NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id UUID     NOT NULL REFERENCES user_challenges(id) ON DELETE CASCADE,

  day_number   SMALLINT NOT NULL CHECK (day_number BETWEEN 1 AND 75),

  -- URL till bilden i Supabase Storage (bucket: 'progress-photos')
  photo_url    TEXT     NOT NULL,

  is_public    BOOLEAN  NOT NULL DEFAULT FALSE,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Aktiverar säkerhetsskiktet på ALLA tabeller.
-- Utan RLS kan vem som helst med anon-nyckeln läsa all data.
-- Med RLS måste varje SELECT/INSERT/UPDATE/DELETE matcha en policy.
-- =============================================================================
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenges       ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_workouts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_schedules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_levels      ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises             ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- RLS POLICIES — Användarens egna data
-- auth.uid() returnerar UUID:t för den inloggade användaren.
-- Dessa policies garanterar att en användare ALDRIG kan se eller
-- modifiera en annan användares data.
-- =============================================================================
CREATE POLICY "Användare hanterar sin egen profil"
  ON profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Användare hanterar sitt quiz"
  ON quiz_results FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Användare hanterar sina utmaningar"
  ON user_challenges FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Användare hanterar sina dagliga loggar"
  ON daily_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- task_completions har ingen direkt user_id — vi verifierar ägarskap via daily_logs
CREATE POLICY "Användare hanterar sina task completions"
  ON task_completions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM daily_logs
      WHERE daily_logs.id = task_completions.daily_log_id
        AND daily_logs.user_id = auth.uid()
    )
  );

CREATE POLICY "Användare hanterar sina pass"
  ON user_workouts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Användare hanterar sitt schema"
  ON user_schedules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Användare hanterar sina egna foton"
  ON progress_photos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- =============================================================================
-- RLS POLICIES — Publika/skrivskyddade resurser
-- challenge_levels, task_templates och exercises är admin-data.
-- Alla inloggade användare kan läsa dem, ingen kan skriva.
-- =============================================================================
CREATE POLICY "Nivåer är publika att läsa"
  ON challenge_levels FOR SELECT
  USING (TRUE);

CREATE POLICY "Uppgiftsmallar är publika att läsa"
  ON task_templates FOR SELECT
  USING (TRUE);

CREATE POLICY "Övningar är publika att läsa"
  ON exercises FOR SELECT
  USING (TRUE);

-- Community: publika foton syns för alla inloggade användare
CREATE POLICY "Publika foton syns i communityt"
  ON progress_photos FOR SELECT
  USING (is_public = TRUE);


-- =============================================================================
-- TRIGGER: AUTO-SKAPA PROFIL VID REGISTRERING
-- När en ny användare registrerar sig via Supabase Auth (OAuth eller email)
-- skapas deras profil automatiskt. Utan detta måste frontenden göra ett
-- extra INSERT direkt efter registrering — vilket kan misslyckas och lämna
-- användaren utan profil.
-- SECURITY DEFINER = funktionen körs med ägarens rättigheter, inte anroparens,
-- vilket krävs för att skriva till profiles-tabellen från auth-kontexten.
-- =============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    -- Plockar namn och avatar från OAuth-metadata (Google/Apple skickar detta)
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();


-- =============================================================================
-- TRIGGER: AUTO-UPPDATERA updated_at PÅ SCHEDULES
-- =============================================================================
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_schedules_touch_updated_at
  BEFORE UPDATE ON user_schedules
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();


-- =============================================================================
-- INDEX
-- Förbättrar prestanda på de vanligaste frågorna i appen.
-- Utan index = full table scan på varje fråga.
-- Med index = direkt uppslagning via B-träd.
-- =============================================================================

-- Hemskärmen hämtar daglig logg via challenge_id + datum
CREATE INDEX idx_daily_logs_challenge_date
  ON daily_logs (challenge_id, date DESC);

-- Hämta aktiv utmaning för en användare (vanligaste frågan i appen)
CREATE INDEX idx_user_challenges_user_status
  ON user_challenges (user_id, status);

-- Community-flödet filtrerar på is_public + sorterar på datum
-- WHERE-klausulen gör det till ett partiellt index — tar bara plats för publika foton
CREATE INDEX idx_progress_photos_public_feed
  ON progress_photos (created_at DESC)
  WHERE is_public = TRUE;

-- Task completions hämtas alltid via daily_log_id
CREATE INDEX idx_task_completions_log
  ON task_completions (daily_log_id);

-- FÖRENINGAR: ett lager ovanpå grupperna. En förening har en join-kod
-- (delas ut på träningen/i klubbchatten), medlemmar med roller
-- (admin/coach/medlem) och en delningsnivå per medlem som styr hur
-- mycket statistik andra i föreningen får se. Tränare kan publicera
-- TRÄNARPASS — passmallar som medlemmarna lägger in i sitt eget schema
-- med ett tryck; adoptionsraden är grunden för efterlevnadsvyn senare.
-- Föreningar är INTE sökbara: man går med via koden (definer-RPC),
-- därför är själva föreningsraden bara läsbar för medlemmar.

-- ── Föreningen ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  description TEXT        NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  avatar_url  TEXT,
  -- Sätts av triggern nedan — 6 tecken utan lättförväxlade (0/O, 1/I/L)
  join_code   TEXT        NOT NULL DEFAULT '' ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_join_code_idx ON organizations (join_code);

CREATE TABLE IF NOT EXISTS organization_members (
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'coach', 'member')),
  -- Hur mycket statistik medlemmen delar med föreningen:
  -- base = streak/antal pass, detailed = volym/km/PR, full = progression per övning
  share_level TEXT        NOT NULL DEFAULT 'base' CHECK (share_level IN ('base', 'detailed', 'full')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS organization_members_user_idx ON organization_members (user_id);

ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Medlemsraderna syns för inloggade (samma öppenhet som group_members) —
-- föreningsraden i sig kräver medlemskap eftersom koden inte får läcka
DROP POLICY IF EXISTS "Föreningsmedlemskap syns för inloggade" ON organization_members;
CREATE POLICY "Föreningsmedlemskap syns för inloggade"
  ON organization_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Föreningen syns för medlemmar" ON organizations;
CREATE POLICY "Föreningen syns för medlemmar"
  ON organizations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.org_id = id AND m.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Man skapar sin egen förening" ON organizations;
CREATE POLICY "Man skapar sin egen förening"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Admin uppdaterar föreningen" ON organizations;
CREATE POLICY "Admin uppdaterar föreningen"
  ON organizations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.org_id = id AND m.user_id = auth.uid() AND m.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admin raderar föreningen" ON organizations;
CREATE POLICY "Admin raderar föreningen"
  ON organizations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.org_id = id AND m.user_id = auth.uid() AND m.role = 'admin'
  ));

-- Medlemskap skapas bara via join-RPC:n och admin-inbjudan — direktinsert
-- tillåts enbart för en själv OM man redan är admin (t.ex. lägga till coach
-- manuellt görs via rollbytespolicyn nedan istället)
DROP POLICY IF EXISTS "Admin ändrar roller och delning ändras av en själv" ON organization_members;
CREATE POLICY "Admin ändrar roller och delning ändras av en själv"
  ON organization_members FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_members a
      WHERE a.org_id = organization_members.org_id
        AND a.user_id = auth.uid() AND a.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Man lämnar själv, admin tar bort" ON organization_members;
CREATE POLICY "Man lämnar själv, admin tar bort"
  ON organization_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_members a
      WHERE a.org_id = organization_members.org_id
        AND a.user_id = auth.uid() AND a.role = 'admin'
    )
  );

-- Skaparen blir admin direkt, och join-koden genereras innan raden landar
CREATE OR REPLACE FUNCTION generate_org_join_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code TEXT;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM organizations WHERE join_code = code);
  END LOOP;
  NEW.join_code := code;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS organizations_join_code ON organizations;
CREATE TRIGGER organizations_join_code
  BEFORE INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION generate_org_join_code();

CREATE OR REPLACE FUNCTION add_org_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO organization_members (org_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS organizations_add_admin ON organizations;
CREATE TRIGGER organizations_add_admin
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION add_org_admin();

-- Gå med via kod: definer-RPC så föreningsraden inte behöver vara publikt
-- läsbar. Returnerar föreningen så appen kan navigera direkt.
CREATE OR REPLACE FUNCTION join_organization(code TEXT)
RETURNS organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org organizations;
BEGIN
  SELECT * INTO org FROM organizations
  WHERE join_code = upper(trim(code));
  IF org.id IS NULL THEN
    RAISE EXCEPTION 'Ogiltig kod';
  END IF;
  INSERT INTO organization_members (org_id, user_id, role)
  VALUES (org.id, auth.uid(), 'member')
  ON CONFLICT DO NOTHING;
  RETURN org;
END $$;

-- ── Grupper kan höra till en förening ────────────────────────────────────────

ALTER TABLE groups ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS groups_org_idx ON groups (org_id) WHERE org_id IS NOT NULL;

-- Bara medlemmar i föreningen får koppla sina grupper till den
CREATE OR REPLACE FUNCTION check_group_org_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.org_id = NEW.org_id AND m.user_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'Gruppägaren är inte medlem i föreningen';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS groups_check_org ON groups;
CREATE TRIGGER groups_check_org
  BEFORE INSERT OR UPDATE OF org_id ON groups
  FOR EACH ROW EXECUTE FUNCTION check_group_org_membership();

-- ── Tränarpass: passmallar från coach/admin till medlemmarna ────────────────

CREATE TABLE IF NOT EXISTS coach_workouts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  -- Tränarens beskrivning: syfte, tempo, vad man ska tänka på
  notes        TEXT        NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  session_type TEXT        NOT NULL DEFAULT 'gym' CHECK (session_type IN ('gym', 'cardio')),
  cardio_type  TEXT,
  -- Samma form som createWorkoutSession tar emot: [{exercise_name, sets, reps}]
  exercises    JSONB       NOT NULL DEFAULT '[]',
  -- Vilka som ser och kan joina passet: hela föreningen, en av
  -- föreningens grupper, eller handplockade medlemmar (recipients-tabellen)
  audience     TEXT        NOT NULL DEFAULT 'org' CHECK (audience IN ('org', 'group', 'selected')),
  group_id     UUID        REFERENCES groups(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK ((audience = 'group') = (group_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS coach_workouts_org_idx ON coach_workouts (org_id, created_at DESC);

-- Gruppen måste höra till samma förening som passet
CREATE OR REPLACE FUNCTION check_coach_workout_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM groups g WHERE g.id = NEW.group_id AND g.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Gruppen hör inte till föreningen';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS coach_workouts_check_group ON coach_workouts;
CREATE TRIGGER coach_workouts_check_group
  BEFORE INSERT OR UPDATE OF group_id, org_id ON coach_workouts
  FOR EACH ROW EXECUTE FUNCTION check_coach_workout_group();

-- Handplockade mottagare när audience = 'selected'
CREATE TABLE IF NOT EXISTS coach_workout_recipients (
  workout_id UUID NOT NULL REFERENCES coach_workouts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  PRIMARY KEY (workout_id, user_id)
);

-- Vilka som lagt in passet i sitt schema — session_id pekar på medlemmens
-- egen workout_sessions-rad så efterlevnad kan härledas ur befintlig data
CREATE TABLE IF NOT EXISTS coach_workout_adoptions (
  workout_id UUID        NOT NULL REFERENCES coach_workouts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (workout_id, user_id)
);

ALTER TABLE coach_workouts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_workout_adoptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_workout_recipients ENABLE ROW LEVEL SECURITY;

-- Synlighet enligt målgruppen: coach/admin i föreningen ser alltid sina
-- pass; medlemmar ser org-pass, grupp-pass om de är accepterade i gruppen,
-- och riktade pass bara om de står som mottagare
DROP POLICY IF EXISTS "Tränarpass syns för föreningens medlemmar" ON coach_workouts;
DROP POLICY IF EXISTS "Tränarpass syns för sin målgrupp" ON coach_workouts;
CREATE POLICY "Tränarpass syns för sin målgrupp"
  ON coach_workouts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = coach_workouts.org_id
        AND m.user_id = auth.uid() AND m.role IN ('admin', 'coach')
    )
    OR (
      audience = 'org'
      AND EXISTS (
        SELECT 1 FROM organization_members m
        WHERE m.org_id = coach_workouts.org_id AND m.user_id = auth.uid()
      )
    )
    OR (
      audience = 'group'
      AND EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.group_id = coach_workouts.group_id
          AND gm.user_id = auth.uid() AND gm.status = 'accepted'
      )
    )
    OR (
      audience = 'selected'
      AND EXISTS (
        SELECT 1 FROM coach_workout_recipients r
        WHERE r.workout_id = coach_workouts.id AND r.user_id = auth.uid()
      )
    )
  );

-- Mottagarlistan: skaparen (eller admin) hanterar den, mottagaren ser sin rad
DROP POLICY IF EXISTS "Mottagare ser sin rad, tränaren hela listan" ON coach_workout_recipients;
CREATE POLICY "Mottagare ser sin rad, tränaren hela listan"
  ON coach_workout_recipients FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM coach_workouts w
      JOIN organization_members m ON m.org_id = w.org_id
      WHERE w.id = coach_workout_recipients.workout_id
        AND m.user_id = auth.uid() AND m.role IN ('admin', 'coach')
    )
  );

DROP POLICY IF EXISTS "Tränaren väljer mottagare" ON coach_workout_recipients;
CREATE POLICY "Tränaren väljer mottagare"
  ON coach_workout_recipients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_workouts w
      JOIN organization_members m ON m.org_id = w.org_id
      WHERE w.id = workout_id
        AND m.user_id = auth.uid() AND m.role IN ('admin', 'coach')
    )
    -- Mottagaren måste själv vara medlem i föreningen
    AND EXISTS (
      SELECT 1 FROM coach_workouts w
      JOIN organization_members m2 ON m2.org_id = w.org_id
      WHERE w.id = workout_id AND m2.user_id = coach_workout_recipients.user_id
    )
  );

DROP POLICY IF EXISTS "Tränaren tar bort mottagare" ON coach_workout_recipients;
CREATE POLICY "Tränaren tar bort mottagare"
  ON coach_workout_recipients FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM coach_workouts w
    JOIN organization_members m ON m.org_id = w.org_id
    WHERE w.id = coach_workout_recipients.workout_id
      AND m.user_id = auth.uid() AND m.role IN ('admin', 'coach')
  ));

DROP POLICY IF EXISTS "Coach och admin publicerar tränarpass" ON coach_workouts;
CREATE POLICY "Coach och admin publicerar tränarpass"
  ON coach_workouts FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = coach_workouts.org_id
        AND m.user_id = auth.uid() AND m.role IN ('admin', 'coach')
    )
  );

DROP POLICY IF EXISTS "Skaparen eller admin ändrar tränarpasset" ON coach_workouts;
CREATE POLICY "Skaparen eller admin ändrar tränarpasset"
  ON coach_workouts FOR UPDATE
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = coach_workouts.org_id
        AND m.user_id = auth.uid() AND m.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Skaparen eller admin tar bort tränarpasset" ON coach_workouts;
CREATE POLICY "Skaparen eller admin tar bort tränarpasset"
  ON coach_workouts FOR DELETE
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM organization_members m
      WHERE m.org_id = coach_workouts.org_id
        AND m.user_id = auth.uid() AND m.role = 'admin'
    )
  );

-- Adoptioner: egna rader skrivs av en själv; coach/admin ser allas (för
-- efterlevnadsvyn), övriga ser bara sina egna
DROP POLICY IF EXISTS "Egna adoptioner och tränarens överblick" ON coach_workout_adoptions;
CREATE POLICY "Egna adoptioner och tränarens överblick"
  ON coach_workout_adoptions FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM coach_workouts w
      JOIN organization_members m ON m.org_id = w.org_id
      WHERE w.id = coach_workout_adoptions.workout_id
        AND m.user_id = auth.uid() AND m.role IN ('admin', 'coach')
    )
  );

-- Subfrågan mot coach_workouts går genom RLS, så "passet är synligt för
-- mig" täcker automatiskt alla tre målgruppslägena
DROP POLICY IF EXISTS "Medlemmen lägger in passet själv" ON coach_workout_adoptions;
CREATE POLICY "Medlemmen lägger in passet själv"
  ON coach_workout_adoptions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM coach_workouts w WHERE w.id = workout_id)
  );

DROP POLICY IF EXISTS "Medlemmen ångrar sin adoption" ON coach_workout_adoptions;
CREATE POLICY "Medlemmen ångrar sin adoption"
  ON coach_workout_adoptions FOR DELETE
  USING (user_id = auth.uid());

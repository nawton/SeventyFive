-- ANMÄLNINGAR: grupper, inlägg och användare kan anmälas. Tabellen är
-- skrivbar för alla inloggade (bara som sig själva) men läses inte via
-- API:t alls — granskning sker i Supabase-panelen med service-rollen.

CREATE TABLE reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT        NOT NULL CHECK (target_type IN ('group', 'post', 'user')),
  target_id   TEXT        NOT NULL CHECK (char_length(target_id) BETWEEN 1 AND 200),
  reason      TEXT        NOT NULL DEFAULT '' CHECK (char_length(reason) <= 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Man anmäler som sig själv"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

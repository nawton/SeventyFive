-- Rapportera innehåll (App Store-krav för användargenererat innehåll).
-- Användare kan bara SKAPA rapporter — ingen select-policy alls, så
-- rapporterna läses enbart av teamet via dashboarden/service-rollen.

CREATE TABLE reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_kind TEXT        NOT NULL CHECK (target_kind IN ('user', 'post', 'comment')),
  target_id   TEXT        NOT NULL,
  details     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Användare rapporterar som sig själva"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

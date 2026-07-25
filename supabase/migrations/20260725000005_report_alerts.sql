-- ANMÄLNINGSLARM: nya anmälningar pushas till admin-kontona så ingen
-- behöver bevaka Supabase-panelen. admins-tabellen saknar policies helt,
-- den läses bara av edge-funktionen (service-rollen) och fylls på via
-- SQL-editorn i panelen.

CREATE TABLE admins (
  user_id    UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER reports_push
  AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION notify_push();

-- Offentlig profil: den som slår på is_public behöver inte godkänna sina
-- följare — nya följen accepteras automatiskt och väntande förfrågningar
-- godkänns direkt. Statusen sätts av en trigger på SERVERN så att en
-- klient aldrig kan smyga in 'accepted' mot en privat profil.

ALTER TABLE profiles ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE;

-- SECURITY DEFINER krävs: profilernas RLS är egna rader, men triggern
-- måste läsa MOTTAGARENS is_public
CREATE OR REPLACE FUNCTION set_follow_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT CASE WHEN p.is_public THEN 'accepted' ELSE 'pending' END
    INTO NEW.status
  FROM profiles p
  WHERE p.id = NEW.followee_id;
  RETURN NEW;
END $$;

CREATE TRIGGER follows_set_status
  BEFORE INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION set_follow_status();

-- Slår man om till offentlig godkänns alla väntande förfrågningar direkt
CREATE OR REPLACE FUNCTION accept_pending_on_public()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_public AND NOT OLD.is_public THEN
    UPDATE follows SET status = 'accepted'
    WHERE followee_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_accept_pending
  AFTER UPDATE OF is_public ON profiles
  FOR EACH ROW EXECUTE FUNCTION accept_pending_on_public();

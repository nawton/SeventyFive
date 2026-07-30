-- FIX: oändlig rekursion i tränarpassens RLS. Passpolicyn läste
-- mottagartabellen vars policy läste passtabellen — Postgres vägrar (42P17).
-- Lösningen är definer-funktioner som slår upp behörigheten utan att gå
-- genom RLS, så policykedjan aldrig biter sig själv i svansen.

-- Är användaren coach eller admin i föreningen?
CREATE OR REPLACE FUNCTION is_org_staff(oid UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = oid AND user_id = uid AND role IN ('admin', 'coach')
  )
$$;

-- Är användaren coach/admin i passets förening?
CREATE OR REPLACE FUNCTION is_workout_staff(wid UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM coach_workouts w
    WHERE w.id = wid AND is_org_staff(w.org_id, uid)
  )
$$;

-- Är användaren medlem i passets förening? (för mottagarvalidering)
CREATE OR REPLACE FUNCTION is_workout_org_member(wid UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM coach_workouts w
    JOIN organization_members m ON m.org_id = w.org_id
    WHERE w.id = wid AND m.user_id = uid
  )
$$;

-- Hela synlighetslogiken på ett ställe: staff ser allt i sin förening,
-- annars gäller passets målgrupp (org/grupp/utvalda)
CREATE OR REPLACE FUNCTION can_see_workout(wid UUID, uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM coach_workouts w
    WHERE w.id = wid AND (
      is_org_staff(w.org_id, uid)
      OR (w.audience = 'org' AND EXISTS (
        SELECT 1 FROM organization_members m
        WHERE m.org_id = w.org_id AND m.user_id = uid
      ))
      OR (w.audience = 'group' AND EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.group_id = w.group_id AND gm.user_id = uid AND gm.status = 'accepted'
      ))
      OR (w.audience = 'selected' AND EXISTS (
        SELECT 1 FROM coach_workout_recipients r
        WHERE r.workout_id = w.id AND r.user_id = uid
      ))
    )
  )
$$;

-- ── Passen: policyn blir ett enda funktionsanrop ─────────────────────────────

DROP POLICY IF EXISTS "Tränarpass syns för sin målgrupp" ON coach_workouts;
CREATE POLICY "Tränarpass syns för sin målgrupp"
  ON coach_workouts FOR SELECT
  USING (can_see_workout(id, auth.uid()));

-- ── Mottagarlistan: definer-funktionerna ersätter join-subfrågorna ───────────

DROP POLICY IF EXISTS "Mottagare ser sin rad, tränaren hela listan" ON coach_workout_recipients;
CREATE POLICY "Mottagare ser sin rad, tränaren hela listan"
  ON coach_workout_recipients FOR SELECT
  USING (user_id = auth.uid() OR is_workout_staff(workout_id, auth.uid()));

DROP POLICY IF EXISTS "Tränaren väljer mottagare" ON coach_workout_recipients;
CREATE POLICY "Tränaren väljer mottagare"
  ON coach_workout_recipients FOR INSERT
  WITH CHECK (
    is_workout_staff(workout_id, auth.uid())
    AND is_workout_org_member(workout_id, user_id)
  );

DROP POLICY IF EXISTS "Tränaren tar bort mottagare" ON coach_workout_recipients;
CREATE POLICY "Tränaren tar bort mottagare"
  ON coach_workout_recipients FOR DELETE
  USING (is_workout_staff(workout_id, auth.uid()));

-- ── Adoptionerna: samma synlighetsfunktion styr vem som kan joina ────────────

DROP POLICY IF EXISTS "Egna adoptioner och tränarens överblick" ON coach_workout_adoptions;
CREATE POLICY "Egna adoptioner och tränarens överblick"
  ON coach_workout_adoptions FOR SELECT
  USING (user_id = auth.uid() OR is_workout_staff(workout_id, auth.uid()));

DROP POLICY IF EXISTS "Medlemmen lägger in passet själv" ON coach_workout_adoptions;
CREATE POLICY "Medlemmen lägger in passet själv"
  ON coach_workout_adoptions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND can_see_workout(workout_id, auth.uid())
  );

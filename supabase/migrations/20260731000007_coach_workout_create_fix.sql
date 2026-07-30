-- FIX: att publicera ett tränarpass small med "Kunde inte spara".
-- SELECT-policyn gick via can_see_workout(id) som SLÅR UPP passet i
-- tabellen igen — men under INSERT ... RETURNING är den nya raden inte
-- synlig för en sådan uppslagning än (samma kommandosnapshot), så
-- policyn nekade svaret trots att skaparen är staff. Policyn läser nu
-- radens egna kolumner direkt; can_see_workout behålls för
-- adoptionsflödet där passet redan finns sedan tidigare.

DROP POLICY IF EXISTS "Tränarpass syns för sin målgrupp" ON coach_workouts;
CREATE POLICY "Tränarpass syns för sin målgrupp"
  ON coach_workouts FOR SELECT
  USING (
    created_by = auth.uid()
    OR is_org_staff(org_id, auth.uid())
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

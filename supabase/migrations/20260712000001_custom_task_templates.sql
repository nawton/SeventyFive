-- =============================================================================
-- EGNA REGLER / CUSTOM TASK TEMPLATES
-- Användare kan skapa egna dagliga uppgifter utöver de inbyggda nivåreglerna.
-- Vi återanvänder task_templates-tabellen med user_id + challenge_id satta.
-- =============================================================================

ALTER TABLE task_templates
  ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES user_challenges(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS icon         TEXT NOT NULL DEFAULT 'checkmark-circle-outline',
  ADD COLUMN IF NOT EXISTS sort_order   INTEGER NOT NULL DEFAULT 0;

-- Befintliga rader (admin-data) förblir med user_id = NULL.
-- Användare kan bara se/ändra sina egna templates.
CREATE POLICY "manage own task templates"
  ON task_templates
  FOR ALL
  TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

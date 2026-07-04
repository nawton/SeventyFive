-- Add optional notes field to workout_sessions
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS notes TEXT;

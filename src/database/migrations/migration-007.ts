import type { DatabaseMigration } from '@/database/types';

export const migration007: DatabaseMigration = {
  version: 7,
  sql: `
    ALTER TABLE workout_day_exercises
      ADD COLUMN default_rest_seconds INTEGER NOT NULL DEFAULT 90
      CHECK (default_rest_seconds BETWEEN 15 AND 1800);
    ALTER TABLE workout_day_exercises
      ADD COLUMN superset_group_id TEXT;
    ALTER TABLE workout_day_exercises
      ADD COLUMN superset_order INTEGER CHECK (superset_order IS NULL OR superset_order >= 0);

    ALTER TABLE workout_sessions
      ADD COLUMN rest_timer_deadline TEXT;
    ALTER TABLE workout_sessions
      ADD COLUMN rest_timer_duration_seconds INTEGER
      CHECK (rest_timer_duration_seconds IS NULL OR rest_timer_duration_seconds BETWEEN 1 AND 1800);
    ALTER TABLE workout_sessions
      ADD COLUMN rest_timer_exercise_id INTEGER;
    ALTER TABLE workout_sessions
      ADD COLUMN rest_timer_alerted_at TEXT;
    ALTER TABLE workout_sessions
      ADD COLUMN rest_timer_notification_id TEXT;
    ALTER TABLE workout_sessions
      ADD COLUMN selected_session_exercise_id INTEGER;
    ALTER TABLE workout_sessions
      ADD COLUMN notes TEXT NOT NULL DEFAULT '';

    ALTER TABLE workout_session_exercises
      ADD COLUMN rest_duration_seconds INTEGER NOT NULL DEFAULT 90
      CHECK (rest_duration_seconds BETWEEN 15 AND 1800);
    ALTER TABLE workout_session_exercises
      ADD COLUMN superset_group_id TEXT;
    ALTER TABLE workout_session_exercises
      ADD COLUMN superset_order INTEGER CHECK (superset_order IS NULL OR superset_order >= 0);
    ALTER TABLE workout_session_exercises
      ADD COLUMN is_skipped INTEGER NOT NULL DEFAULT 0 CHECK (is_skipped IN (0, 1));

    ALTER TABLE workout_sets
      ADD COLUMN set_type TEXT NOT NULL DEFAULT 'working'
      CHECK (set_type IN ('warm_up', 'working', 'drop', 'amrap', 'failure'));
    ALTER TABLE workout_sets
      ADD COLUMN effort_mode TEXT CHECK (effort_mode IS NULL OR effort_mode IN ('rpe', 'rir'));
    ALTER TABLE workout_sets
      ADD COLUMN effort_value REAL CHECK (
        effort_value IS NULL OR
        (effort_mode = 'rpe' AND effort_value BETWEEN 1 AND 10) OR
        (effort_mode = 'rir' AND effort_value BETWEEN 0 AND 10)
      );

    ALTER TABLE profile_preferences
      ADD COLUMN workout_effort_mode TEXT NOT NULL DEFAULT 'off'
      CHECK (workout_effort_mode IN ('off', 'rpe', 'rir'));
    ALTER TABLE profile_preferences
      ADD COLUMN workout_haptics_enabled INTEGER NOT NULL DEFAULT 1
      CHECK (workout_haptics_enabled IN (0, 1));
    ALTER TABLE profile_preferences
      ADD COLUMN workout_keep_awake_enabled INTEGER NOT NULL DEFAULT 1
      CHECK (workout_keep_awake_enabled IN (0, 1));
    ALTER TABLE profile_preferences
      ADD COLUMN global_rest_seconds INTEGER NOT NULL DEFAULT 90
      CHECK (global_rest_seconds BETWEEN 15 AND 1800);

    CREATE INDEX IF NOT EXISTS idx_workout_session_exercises_superset
      ON workout_session_exercises(session_id, superset_group_id, superset_order);
    CREATE INDEX IF NOT EXISTS idx_workout_sets_completed_type
      ON workout_sets(session_exercise_id, is_completed, set_type, set_number);
  `,
};

import type { DatabaseMigration } from '@/database/types';

export const migration001: DatabaseMigration = {
  version: 1,
  sql: `
    CREATE TABLE IF NOT EXISTS workout_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(plan_id, name),
      UNIQUE(plan_id, sort_order)
    );

    CREATE TABLE IF NOT EXISTS workout_day_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_day_id INTEGER NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
      iso_weekday INTEGER NOT NULL CHECK (iso_weekday BETWEEN 1 AND 7),
      UNIQUE(workout_day_id, iso_weekday),
      UNIQUE(iso_weekday)
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      muscle_group TEXT NOT NULL,
      equipment TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_day_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_day_id INTEGER NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
      sort_order INTEGER NOT NULL,
      default_set_count INTEGER NOT NULL CHECK (default_set_count > 0),
      default_target_reps INTEGER NOT NULL CHECK (default_target_reps > 0),
      default_weight_kg REAL NOT NULL CHECK (default_weight_kg >= 0),
      weight_mode TEXT NOT NULL CHECK (weight_mode IN ('total', 'per_hand')),
      UNIQUE(workout_day_id, exercise_id),
      UNIQUE(workout_day_id, sort_order)
    );

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_day_id INTEGER NOT NULL REFERENCES workout_days(id) ON DELETE RESTRICT,
      workout_name_snapshot TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')),
      started_at TEXT NOT NULL,
      completed_at TEXT,
      cancelled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_session_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
      exercise_name_snapshot TEXT NOT NULL,
      muscle_group_snapshot TEXT NOT NULL,
      weight_mode_snapshot TEXT NOT NULL CHECK (weight_mode_snapshot IN ('total', 'per_hand')),
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(session_id, sort_order)
    );

    CREATE TABLE IF NOT EXISTS workout_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_exercise_id INTEGER NOT NULL REFERENCES workout_session_exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL CHECK (set_number > 0),
      target_reps INTEGER NOT NULL CHECK (target_reps > 0),
      actual_reps INTEGER CHECK (actual_reps >= 0),
      weight_kg REAL NOT NULL CHECK (weight_kg >= 0),
      is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(session_exercise_id, set_number)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_plans_one_active
      ON workout_plans(is_active) WHERE is_active = 1;
    CREATE INDEX IF NOT EXISTS idx_workout_days_plan_sort
      ON workout_days(plan_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_workout_day_exercises_day
      ON workout_day_exercises(workout_day_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_workout_sessions_status
      ON workout_sessions(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_sessions_one_active
      ON workout_sessions(status) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS idx_workout_sessions_completed
      ON workout_sessions(completed_at DESC) WHERE status = 'completed';
    CREATE INDEX IF NOT EXISTS idx_session_exercises_session
      ON workout_session_exercises(session_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise
      ON workout_sets(session_exercise_id, set_number);
  `,
};

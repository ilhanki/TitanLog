import type { DatabaseMigration } from '@/database/types';

export const migration006: DatabaseMigration = {
  version: 6,
  sql: `
    CREATE TABLE IF NOT EXISTS profile_preferences (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      display_name TEXT,
      avatar_uri TEXT,
      weight_unit TEXT NOT NULL DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb')),
      weekly_workout_target INTEGER CHECK (
        weekly_workout_target IS NULL OR weekly_workout_target BETWEEN 1 AND 14
      ),
      weekly_active_day_target INTEGER CHECK (
        weekly_active_day_target IS NULL OR weekly_active_day_target BETWEEN 1 AND 7
      ),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT OR IGNORE INTO profile_preferences (
      id, display_name, avatar_uri, weight_unit, weekly_workout_target,
      weekly_active_day_target, created_at, updated_at
    ) VALUES (1, NULL, NULL, 'kg', NULL, NULL, datetime('now'), datetime('now'));

    CREATE TABLE IF NOT EXISTS data_operation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL CHECK (operation_type IN (
        'local_export', 'local_restore', 'cloud_upload', 'cloud_restore',
        'device_sync', 'conflict_cancelled', 'recovery_created'
      )),
      result TEXT NOT NULL CHECK (result IN ('completed', 'cancelled', 'failed')),
      occurred_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_data_operation_history_occurred
      ON data_operation_history(occurred_at DESC, id DESC);
  `,
};

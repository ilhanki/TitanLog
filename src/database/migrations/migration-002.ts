import type { DatabaseMigration } from '@/database/types';

export const migration002: DatabaseMigration = {
  version: 2,
  sql: `
    CREATE TABLE IF NOT EXISTS body_profiles (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      starting_weight_kg REAL NOT NULL CHECK (starting_weight_kg > 0),
      target_weight_kg REAL NOT NULL CHECK (target_weight_kg > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (starting_weight_kg != target_weight_kg)
    );

    CREATE TABLE IF NOT EXISTS body_measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      measured_at TEXT NOT NULL,
      weight_kg REAL NOT NULL CHECK (weight_kg > 0),
      waist_cm REAL,
      chest_cm REAL,
      upper_arm_cm REAL,
      hip_cm REAL,
      thigh_cm REAL,
      note TEXT CHECK (note IS NULL OR length(note) <= 250),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK (waist_cm IS NULL OR waist_cm > 0),
      CHECK (chest_cm IS NULL OR chest_cm > 0),
      CHECK (upper_arm_cm IS NULL OR upper_arm_cm > 0),
      CHECK (hip_cm IS NULL OR hip_cm > 0),
      CHECK (thigh_cm IS NULL OR thigh_cm > 0)
    );

    CREATE INDEX IF NOT EXISTS idx_body_measurements_measured_at
      ON body_measurements(measured_at DESC, id DESC);
  `,
};

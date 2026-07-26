import type { SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from '@/database/migrations/run-migrations';
import { seedDefaultWorkoutPlan } from '@/database/seed/seed-default-plan';

export async function initializeDatabase(
  database: SQLiteDatabase
): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = ON');
  await database.execAsync('PRAGMA journal_mode = WAL');
  await runMigrations(database);
  await seedDefaultWorkoutPlan(database);
}

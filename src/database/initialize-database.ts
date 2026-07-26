import type { SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from '@/database/migrations/run-migrations';

export async function initializeDatabase(
  database: SQLiteDatabase
): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = ON');
  await database.execAsync('PRAGMA journal_mode = WAL');
  await runMigrations(database);
}

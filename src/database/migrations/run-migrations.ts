import type { SQLiteDatabase } from 'expo-sqlite';

import { migration001 } from '@/database/migrations/migration-001';
import { migration002 } from '@/database/migrations/migration-002';

const migrations = [migration001, migration002] as const;

type UserVersionRow = {
  user_version: number;
};

export async function runMigrations(database: SQLiteDatabase): Promise<number> {
  const versionRow = await database.getFirstAsync<UserVersionRow>(
    'PRAGMA user_version'
  );
  let currentVersion = versionRow?.user_version ?? 0;
  const latestVersion = migrations.at(-1)?.version ?? 0;

  if (currentVersion > latestVersion) {
    throw new Error('Database schema is newer than this application.');
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(migration.sql);
      await transaction.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    currentVersion = migration.version;
  }

  return currentVersion;
}

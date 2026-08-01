import type { SQLiteDatabase } from 'expo-sqlite';

import { migration003 } from '@/database/migrations/migration-003';
import { migration004 } from '@/database/migrations/migration-004';
import { migration005 } from '@/database/migrations/migration-005';
import { runMigrations } from '@/database/migrations/run-migrations';

function createDatabase(currentVersion: number) {
  const transactionExecAsync = jest.fn().mockResolvedValue(undefined);
  const database = {
    getFirstAsync: jest
      .fn()
      .mockResolvedValue({ user_version: currentVersion }),
    withExclusiveTransactionAsync: jest.fn(
      async (task: (transaction: SQLiteDatabase) => Promise<void>) => {
        await task({
          execAsync: transactionExecAsync,
        } as unknown as SQLiteDatabase);
      }
    ),
  } as unknown as SQLiteDatabase;

  return { database, transactionExecAsync };
}

describe('runMigrations', () => {
  it('applies migrations 1 through 5 on a fresh database', async () => {
    const { database, transactionExecAsync } = createDatabase(0);

    await expect(runMigrations(database)).resolves.toBe(5);
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(5);
    expect(transactionExecAsync).toHaveBeenLastCalledWith(
      'PRAGMA user_version = 5'
    );
    expect(transactionExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS workout_sessions')
    );
    expect(transactionExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS body_profiles')
    );
    expect(transactionExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('SET default_target_reps = 12')
    );
    expect(transactionExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS dataset_metadata')
    );
    expect(transactionExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS sync_state')
    );
  });

  it('upgrades version 1 without rewriting workout tables', async () => {
    const { database } = createDatabase(1);

    await expect(runMigrations(database)).resolves.toBe(5);
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(4);
  });

  it('upgrades version 2 by changing only future workout defaults', async () => {
    const { database } = createDatabase(2);

    await expect(runMigrations(database)).resolves.toBe(5);
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(3);
  });

  it('upgrades schema 3 with ownership metadata only', async () => {
    const { database } = createDatabase(3);

    await expect(runMigrations(database)).resolves.toBe(5);
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(2);
  });

  it('keeps session and body rows outside the future-default migration', () => {
    expect(migration003.sql).toContain('UPDATE workout_day_exercises');
    expect(migration003.sql).not.toMatch(/workout_sets|workout_sessions/);
    expect(migration003.sql).not.toMatch(/body_profiles|body_measurements/);
  });

  it('does not rewrite user-data tables in migration 4', () => {
    expect(migration004.sql).toContain('dataset_metadata');
    expect(migration004.sql).not.toMatch(
      /UPDATE\s+(workout_|body_)|DELETE\s+FROM\s+(workout_|body_)/i
    );
  });

  it('upgrades schema 4 with sync bookkeeping only', async () => {
    const { database, transactionExecAsync } = createDatabase(4);

    await expect(runMigrations(database)).resolves.toBe(5);
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(transactionExecAsync).toHaveBeenCalledWith(migration005.sql);
    expect(migration005.sql).toContain('INSERT OR IGNORE INTO sync_state');
    expect(migration005.sql).not.toMatch(
      /(UPDATE|DELETE FROM|DROP TABLE)\s+(workout_|body_)/i
    );
    expect(migration005.sql).not.toMatch(
      /access_token|refresh_token|password|email/i
    );
  });

  it('does not rerun migration 5 when schema is current', async () => {
    const { database } = createDatabase(5);

    await expect(runMigrations(database)).resolves.toBe(5);
    expect(database.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });
});

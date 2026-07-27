import type { SQLiteDatabase } from 'expo-sqlite';

import { migration003 } from '@/database/migrations/migration-003';
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
  it('applies migrations 1, 2, and 3 on a fresh database', async () => {
    const { database, transactionExecAsync } = createDatabase(0);

    await expect(runMigrations(database)).resolves.toBe(3);
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(3);
    expect(transactionExecAsync).toHaveBeenLastCalledWith(
      'PRAGMA user_version = 3'
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
  });

  it('upgrades version 1 without rewriting workout tables', async () => {
    const { database } = createDatabase(1);

    await expect(runMigrations(database)).resolves.toBe(3);
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(2);
  });

  it('upgrades version 2 by changing only future workout defaults', async () => {
    const { database } = createDatabase(2);

    await expect(runMigrations(database)).resolves.toBe(3);
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('does not reapply migration 3', async () => {
    const { database } = createDatabase(3);

    await expect(runMigrations(database)).resolves.toBe(3);
    expect(database.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  it('keeps session and body rows outside the future-default migration', () => {
    expect(migration003.sql).toContain('UPDATE workout_day_exercises');
    expect(migration003.sql).not.toMatch(/workout_sets|workout_sessions/);
    expect(migration003.sql).not.toMatch(/body_profiles|body_measurements/);
  });
});

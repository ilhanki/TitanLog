import type { SQLiteDatabase } from 'expo-sqlite';

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
  it('applies migrations 1 and 2 on a fresh database', async () => {
    const { database, transactionExecAsync } = createDatabase(0);

    await expect(runMigrations(database)).resolves.toBe(2);
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(2);
    expect(transactionExecAsync).toHaveBeenLastCalledWith(
      'PRAGMA user_version = 2'
    );
    expect(transactionExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS workout_sessions')
    );
    expect(transactionExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS body_profiles')
    );
  });

  it('upgrades version 1 without rewriting workout tables', async () => {
    const { database } = createDatabase(1);

    await expect(runMigrations(database)).resolves.toBe(2);
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('does not reapply migration 2', async () => {
    const { database } = createDatabase(2);

    await expect(runMigrations(database)).resolves.toBe(2);
    expect(database.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });
});

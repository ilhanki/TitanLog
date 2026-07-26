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
  it('applies pending migrations and advances user_version', async () => {
    const { database, transactionExecAsync } = createDatabase(0);

    await expect(runMigrations(database)).resolves.toBe(1);
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(transactionExecAsync).toHaveBeenLastCalledWith(
      'PRAGMA user_version = 1'
    );
  });

  it('does not reapply an existing migration', async () => {
    const { database } = createDatabase(1);

    await expect(runMigrations(database)).resolves.toBe(1);
    expect(database.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });
});

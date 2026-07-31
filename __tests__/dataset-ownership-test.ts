import type { SQLiteDatabase } from 'expo-sqlite';

import { createDatasetOwnershipRepository } from '@/features/data-safety/dataset-ownership-repository';

function databaseWithOwner(owner: string | null) {
  const transaction = {
    getFirstAsync: jest.fn().mockResolvedValue({ owner_account_id: owner }),
    runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
  };
  return {
    database: {
      getFirstAsync: jest.fn().mockResolvedValue({
        installation_id: 'device',
        last_cloud_backup_at: null,
        last_local_backup_at: null,
        owner_account_id: owner,
      }),
      withExclusiveTransactionAsync: jest.fn(async (operation) =>
        operation(transaction)
      ),
    } as unknown as SQLiteDatabase,
    transaction,
  };
}

describe('single local dataset ownership', () => {
  it('keeps guest data unowned until explicit claim', async () => {
    const { database, transaction } = databaseWithOwner(null);
    const repository = createDatasetOwnershipRepository(database);
    expect((await repository.getOwnership()).ownerAccountId).toBeNull();
    await repository.claimDataset('account-a');
    expect(transaction.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('owner_account_id = ?'),
      'account-a',
      expect.any(String)
    );
  });

  it('blocks a different account and never changes ownership', async () => {
    const { database, transaction } = databaseWithOwner('account-a');
    await expect(
      createDatasetOwnershipRepository(database).claimDataset('account-b')
    ).rejects.toMatchObject({ code: 'already_claimed' });
    expect(transaction.runAsync).not.toHaveBeenCalled();
    await expect(
      createDatasetOwnershipRepository(database).assertAccountAccess(
        'account-b'
      )
    ).rejects.toMatchObject({ code: 'owner_mismatch' });
  });

  it('requires an explicit claim before cloud access', async () => {
    const { database } = databaseWithOwner(null);
    await expect(
      createDatasetOwnershipRepository(database).assertCloudAccess('account-a')
    ).rejects.toMatchObject({ code: 'unclaimed' });
  });
});

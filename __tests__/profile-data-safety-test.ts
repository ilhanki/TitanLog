import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createOperationHistoryRepository } from '@/features/data-safety/operation-history-repository';

describe('profile data safety', () => {
  it('keeps profile media private with owner-scoped storage policies', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase',
        'migrations',
        '202608040001_private_profile_media.sql'
      ),
      'utf8'
    );
    expect(sql).toMatch(/values\s*\([\s\S]*?'titanlog-profile-media'[\s\S]*?false/i);
    expect(sql).toMatch(/storage\.foldername\(name\).*auth\.uid\(\)/s);
    expect(sql).toMatch(/for select to authenticated/i);
    expect(sql).toMatch(/for insert to authenticated/i);
    expect(sql).toMatch(/for update to authenticated/i);
    expect(sql).toMatch(/for delete to authenticated/i);
    expect(sql).not.toMatch(/to public|createSignedUrl|getPublicUrl/i);
  });

  it('stores bounded local operation labels without personal data fields', async () => {
    const transaction = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
    };
    const database = {
      withExclusiveTransactionAsync: jest.fn(
        async (task: (value: typeof transaction) => Promise<void>) =>
          task(transaction)
      ),
    } as unknown as SQLiteDatabase;
    await createOperationHistoryRepository(database).add(
      'cloud_upload',
      'completed'
    );
    expect(transaction.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO data_operation_history'),
      'cloud_upload',
      'completed',
      expect.any(String)
    );
    expect(transaction.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('LIMIT ?'),
      20
    );
    const serializedCalls = JSON.stringify(transaction.runAsync.mock.calls);
    expect(serializedCalls).not.toMatch(/email|token|user_id|archive_content/i);
  });
});

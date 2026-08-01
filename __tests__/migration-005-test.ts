import { DatabaseSync } from 'node:sqlite';

import { migration001 } from '@/database/migrations/migration-001';
import { migration002 } from '@/database/migrations/migration-002';
import { migration003 } from '@/database/migrations/migration-003';
import { migration004 } from '@/database/migrations/migration-004';
import { migration005 } from '@/database/migrations/migration-005';

function schema4(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON');
  for (const migration of [
    migration001,
    migration002,
    migration003,
    migration004,
  ]) {
    database.exec(migration.sql);
    database.exec(`PRAGMA user_version = ${migration.version}`);
  }
  database.exec(`
    INSERT INTO workout_plans
      (id, name, description, is_active, created_at, updated_at)
    VALUES
      (1, 'Preserved plan', '', 1, '2026-08-01T10:00:00.000Z',
       '2026-08-01T10:00:00.000Z');
  `);
  return database;
}

describe('migration 4 to 5', () => {
  it('preserves schema-4 fitness data and initializes one safe sync row', () => {
    const database = schema4();
    try {
      database.exec(migration005.sql);
      database.exec('PRAGMA user_version = 5');
      const plan = database
        .prepare('SELECT id, name FROM workout_plans WHERE id = 1')
        .get();
      const state = database
        .prepare(
          `SELECT last_remote_revision, last_remote_content_hash,
                  last_local_content_hash, last_successful_sync_at,
                  pending_operation_id FROM sync_state WHERE id = 1`
        )
        .get();
      expect(plan).toEqual({ id: 1, name: 'Preserved plan' });
      expect(state).toEqual({
        last_local_content_hash: null,
        last_remote_content_hash: null,
        last_remote_revision: null,
        last_successful_sync_at: null,
        pending_operation_id: null,
      });
      expect(database.prepare('PRAGMA user_version').get()).toEqual({
        user_version: 5,
      });
    } finally {
      database.close();
    }
  });

  it('is idempotent when the migration SQL is evaluated again', () => {
    const database = schema4();
    try {
      database.exec(migration005.sql);
      database.exec(migration005.sql);
      expect(
        database.prepare('SELECT COUNT(*) AS count FROM sync_state').get()
      ).toEqual({ count: 1 });
    } finally {
      database.close();
    }
  });

  it('rolls back schema bookkeeping while preserving fitness rows', () => {
    const database = schema4();
    try {
      database.exec('BEGIN EXCLUSIVE');
      database.exec(migration005.sql);
      database.exec('PRAGMA user_version = 5');
      database.exec('ROLLBACK');

      expect(database.prepare('PRAGMA user_version').get()).toEqual({
        user_version: 4,
      });
      expect(
        database.prepare('SELECT COUNT(*) AS count FROM workout_plans').get()
      ).toEqual({ count: 1 });
      expect(
        database
          .prepare(
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'sync_state'"
          )
          .get()
      ).toEqual({ count: 0 });
    } finally {
      database.close();
    }
  });
});

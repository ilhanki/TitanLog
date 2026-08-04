import { DatabaseSync } from 'node:sqlite';

import { migration001 } from '@/database/migrations/migration-001';
import { migration002 } from '@/database/migrations/migration-002';
import { migration003 } from '@/database/migrations/migration-003';
import { migration004 } from '@/database/migrations/migration-004';
import { migration005 } from '@/database/migrations/migration-005';
import { migration006 } from '@/database/migrations/migration-006';

describe('migration 5 to 6', () => {
  it('adds local-only profile preferences and bounded operation history', () => {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON');
    for (const migration of [
      migration001,
      migration002,
      migration003,
      migration004,
      migration005,
      migration006,
    ]) {
      database.exec(migration.sql);
      database.exec(`PRAGMA user_version = ${migration.version}`);
    }
    const version = database.prepare('PRAGMA user_version').get() as {
      user_version: number;
    };
    const profile = database
      .prepare('SELECT * FROM profile_preferences WHERE id = 1')
      .get();
    expect(version.user_version).toBe(6);
    expect(profile).toMatchObject({
      avatar_uri: null,
      display_name: null,
      weight_unit: 'kg',
      weekly_active_day_target: null,
      weekly_workout_target: null,
    });
    expect(migration006.sql).not.toMatch(
      /workout_sessions|workout_sets|body_measurements|dataset_metadata/
    );
    database.close();
  });

  it('remains idempotent', () => {
    const database = new DatabaseSync(':memory:');
    database.exec(migration006.sql);
    database.exec(migration006.sql);
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM profile_preferences')
        .get()
    ).toMatchObject({ count: 1 });
    database.close();
  });
});

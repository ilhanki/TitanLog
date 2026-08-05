import { DatabaseSync } from 'node:sqlite';

import { migration001 } from '@/database/migrations/migration-001';
import { migration002 } from '@/database/migrations/migration-002';
import { migration003 } from '@/database/migrations/migration-003';
import { migration004 } from '@/database/migrations/migration-004';
import { migration005 } from '@/database/migrations/migration-005';
import { migration006 } from '@/database/migrations/migration-006';
import { migration007 } from '@/database/migrations/migration-007';

describe('migration 6 to 7', () => {
  function migrate() {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON');
    for (const migration of [
      migration001,
      migration002,
      migration003,
      migration004,
      migration005,
      migration006,
    ])
      database.exec(migration.sql);
    return database;
  }

  it('preserves populated workout data and applies safe defaults', () => {
    const database = migrate();
    const timestamp = '2026-08-05T10:00:00.000Z';
    database.exec(`
      INSERT INTO workout_plans VALUES (1, 'Plan', '', 1, '${timestamp}', '${timestamp}');
      INSERT INTO workout_days VALUES (1, 1, 'Gün', '', 1, '${timestamp}', '${timestamp}');
      INSERT INTO exercises VALUES (1, 'Squat', 'Legs', 'Barbell', '${timestamp}', '${timestamp}');
      INSERT INTO workout_day_exercises VALUES (1, 1, 1, 1, 3, 8, 40, 'total');
      INSERT INTO workout_sessions VALUES (1, 1, 'Gün', 'active', '${timestamp}', NULL, NULL, '${timestamp}', '${timestamp}');
      INSERT INTO workout_session_exercises VALUES (1, 1, 1, 'Squat', 'Legs', 'total', 1, '${timestamp}');
      INSERT INTO workout_sets VALUES (1, 1, 1, 8, 8, 40, 1, '${timestamp}', '${timestamp}', '${timestamp}');
    `);
    database.exec(migration007.sql);
    database.exec('PRAGMA user_version = 7');
    expect(database.prepare('PRAGMA user_version').get()).toMatchObject({
      user_version: 7,
    });
    expect(
      database.prepare('SELECT * FROM workout_sets WHERE id = 1').get()
    ).toMatchObject({
      effort_mode: null,
      effort_value: null,
      set_type: 'working',
    });
    expect(
      database
        .prepare('SELECT * FROM workout_session_exercises WHERE id = 1')
        .get()
    ).toMatchObject({
      is_skipped: 0,
      rest_duration_seconds: 90,
      superset_group_id: null,
    });
    database.close();
  });

  it('rolls back when migration SQL fails inside a transaction', () => {
    const database = migrate();
    database.exec('BEGIN');
    expect(() => {
      database.exec(migration007.sql);
      database.exec('SELECT missing_column FROM workout_sets');
      database.exec('COMMIT');
    }).toThrow();
    database.exec('ROLLBACK');
    const columns = database
      .prepare('PRAGMA table_info(workout_sets)')
      .all() as { name: string }[];
    expect(columns.some((column) => column.name === 'set_type')).toBe(false);
    database.close();
  });
});

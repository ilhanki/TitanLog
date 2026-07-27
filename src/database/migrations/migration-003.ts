import type { DatabaseMigration } from '@/database/types';

export const migration003: DatabaseMigration = {
  version: 3,
  sql: `
    UPDATE workout_day_exercises
    SET default_target_reps = 12
    WHERE default_target_reps = 10;
  `,
};

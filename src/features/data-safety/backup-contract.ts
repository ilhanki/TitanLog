import type {
  BackupData,
  BackupRow,
  BackupTableName,
  BackupValue,
} from './backup-types.ts';

export type BackupColumnKind =
  'number' | 'nullable-number' | 'string' | 'nullable-string';

export type BackupTableSchema = Record<string, BackupColumnKind>;

export const BACKUP_TABLE_SCHEMAS: Record<BackupTableName, BackupTableSchema> =
  {
    workout_plans: {
      id: 'number',
      name: 'string',
      description: 'string',
      is_active: 'number',
      created_at: 'string',
      updated_at: 'string',
    },
    workout_days: {
      id: 'number',
      plan_id: 'number',
      name: 'string',
      subtitle: 'string',
      sort_order: 'number',
      created_at: 'string',
      updated_at: 'string',
    },
    workout_day_schedules: {
      id: 'number',
      workout_day_id: 'number',
      iso_weekday: 'number',
    },
    exercises: {
      id: 'number',
      name: 'string',
      muscle_group: 'string',
      equipment: 'string',
      created_at: 'string',
      updated_at: 'string',
    },
    workout_day_exercises: {
      id: 'number',
      workout_day_id: 'number',
      exercise_id: 'number',
      sort_order: 'number',
      default_set_count: 'number',
      default_target_reps: 'number',
      default_weight_kg: 'number',
      weight_mode: 'string',
      default_rest_seconds: 'number',
      superset_group_id: 'nullable-string',
      superset_order: 'nullable-number',
    },
    workout_sessions: {
      id: 'number',
      workout_day_id: 'number',
      workout_name_snapshot: 'string',
      status: 'string',
      started_at: 'string',
      completed_at: 'nullable-string',
      cancelled_at: 'nullable-string',
      created_at: 'string',
      updated_at: 'string',
      rest_timer_deadline: 'nullable-string',
      rest_timer_duration_seconds: 'nullable-number',
      rest_timer_exercise_id: 'nullable-number',
      rest_timer_alerted_at: 'nullable-string',
      rest_timer_notification_id: 'nullable-string',
      selected_session_exercise_id: 'nullable-number',
      notes: 'string',
    },
    workout_session_exercises: {
      id: 'number',
      session_id: 'number',
      exercise_id: 'number',
      exercise_name_snapshot: 'string',
      muscle_group_snapshot: 'string',
      weight_mode_snapshot: 'string',
      sort_order: 'number',
      created_at: 'string',
      rest_duration_seconds: 'number',
      superset_group_id: 'nullable-string',
      superset_order: 'nullable-number',
      is_skipped: 'number',
    },
    workout_sets: {
      id: 'number',
      session_exercise_id: 'number',
      set_number: 'number',
      target_reps: 'number',
      actual_reps: 'nullable-number',
      weight_kg: 'number',
      is_completed: 'number',
      completed_at: 'nullable-string',
      created_at: 'string',
      updated_at: 'string',
      set_type: 'string',
      effort_mode: 'nullable-string',
      effort_value: 'nullable-number',
    },
    body_profiles: {
      id: 'number',
      starting_weight_kg: 'number',
      target_weight_kg: 'number',
      created_at: 'string',
      updated_at: 'string',
    },
    body_measurements: {
      id: 'number',
      measured_at: 'string',
      weight_kg: 'number',
      waist_cm: 'nullable-number',
      chest_cm: 'nullable-number',
      upper_arm_cm: 'nullable-number',
      hip_cm: 'nullable-number',
      thigh_cm: 'nullable-number',
      note: 'nullable-string',
      created_at: 'string',
      updated_at: 'string',
    },
  };

export function backupTableColumns(table: BackupTableName): string[] {
  return Object.keys(BACKUP_TABLE_SCHEMAS[table]);
}

export function normalizePersistedBackupRow(
  table: BackupTableName,
  persisted: Record<string, unknown>
): BackupRow {
  return Object.fromEntries(
    Object.entries(BACKUP_TABLE_SCHEMAS[table]).map(([column, kind]) => {
      const value = persisted[column];
      return [
        column,
        table === 'workout_sessions' && column === 'rest_timer_notification_id'
          ? null
          : value === undefined && kind.startsWith('nullable-')
            ? null
            : value,
      ];
    })
  ) as BackupRow;
}

export function omitOrphanedSessionSnapshots(data: BackupData): BackupData {
  const sessionIds = new Set(data.workout_sessions.map((row) => row.id));
  const workoutSessionExercises = data.workout_session_exercises.filter((row) =>
    sessionIds.has(row.session_id)
  );
  const sessionExerciseIds = new Set(
    workoutSessionExercises.map((row) => row.id)
  );

  return {
    ...data,
    workout_session_exercises: workoutSessionExercises,
    workout_sets: data.workout_sets.filter((row) =>
      sessionExerciseIds.has(row.session_exercise_id)
    ),
  };
}

export function isValidBackupValue(
  value: unknown,
  kind: BackupColumnKind
): value is BackupValue {
  if (kind.startsWith('nullable-') && value === null) return true;
  if (kind.endsWith('number')) {
    return typeof value === 'number' && Number.isFinite(value);
  }
  return typeof value === 'string';
}

export function expectedBackupType(kind: BackupColumnKind): string {
  return (
    kind.replace('nullable-', '') +
    (kind.startsWith('nullable-') ? '|null' : '')
  );
}

export function structuralType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

import type { SQLiteDatabase } from 'expo-sqlite';
import type { WorkoutEffortMode } from '@/features/workouts/domain/models';

export const PROFILE_FALLBACK_NAME = 'Titan Sporcusu';
export const PROFILE_NAME_MIN_LENGTH = 2;
export const PROFILE_NAME_MAX_LENGTH = 40;

export type ProfilePreferences = {
  avatarUri: string | null;
  displayName: string | null;
  weightUnit: WeightUnit;
  weeklyActiveDayTarget: number | null;
  weeklyWorkoutTarget: number | null;
  workoutEffortMode: WorkoutEffortMode;
  workoutHapticsEnabled: boolean;
  workoutKeepAwakeEnabled: boolean;
  globalRestSeconds: number;
};

export type WeightUnit = 'kg' | 'lb';

type ProfilePreferencesRow = {
  avatar_uri: string | null;
  display_name: string | null;
  weight_unit: WeightUnit;
  weekly_active_day_target: number | null;
  weekly_workout_target: number | null;
  workout_effort_mode: WorkoutEffortMode;
  workout_haptics_enabled: number;
  workout_keep_awake_enabled: number;
  global_rest_seconds: number;
};

export type ProfileNameValidation =
  | { name: string; valid: true }
  | { code: 'empty' | 'too_short' | 'too_long'; valid: false };

export function normalizeDisplayName(value: string): string {
  return value.trim().normalize('NFKC').replace(/\s+/g, ' ');
}

export function validateDisplayName(value: string): ProfileNameValidation {
  const name = normalizeDisplayName(value);
  if (!name) return { code: 'empty', valid: false };
  if (name.length < PROFILE_NAME_MIN_LENGTH)
    return { code: 'too_short', valid: false };
  if (name.length > PROFILE_NAME_MAX_LENGTH)
    return { code: 'too_long', valid: false };
  return { name, valid: true };
}

function mapProfile(row: ProfilePreferencesRow): ProfilePreferences {
  return {
    avatarUri: row.avatar_uri,
    displayName: row.display_name,
    weightUnit: row.weight_unit,
    weeklyActiveDayTarget: row.weekly_active_day_target,
    weeklyWorkoutTarget: row.weekly_workout_target,
    workoutEffortMode: row.workout_effort_mode,
    workoutHapticsEnabled: row.workout_haptics_enabled === 1,
    workoutKeepAwakeEnabled: row.workout_keep_awake_enabled === 1,
    globalRestSeconds: row.global_rest_seconds,
  };
}

export function createProfilePreferencesRepository(database: SQLiteDatabase) {
  return {
    async get(): Promise<ProfilePreferences> {
      const row = await database.getFirstAsync<ProfilePreferencesRow>(
        `SELECT display_name, avatar_uri, weight_unit, weekly_workout_target,
                weekly_active_day_target, workout_effort_mode,
                workout_haptics_enabled, workout_keep_awake_enabled,
                global_rest_seconds
         FROM profile_preferences WHERE id = 1`
      );
      return row
        ? mapProfile(row)
        : {
            avatarUri: null,
            displayName: null,
            weightUnit: 'kg',
            weeklyActiveDayTarget: null,
            weeklyWorkoutTarget: null,
            workoutEffortMode: 'off',
            workoutHapticsEnabled: true,
            workoutKeepAwakeEnabled: true,
            globalRestSeconds: 90,
          };
    },

    async saveDisplayName(displayName: string): Promise<void> {
      const validation = validateDisplayName(displayName);
      if (!validation.valid) throw new Error(`display_name_${validation.code}`);
      await database.runAsync(
        `UPDATE profile_preferences
         SET display_name = ?, updated_at = ? WHERE id = 1`,
        validation.name,
        new Date().toISOString()
      );
    },

    async saveAvatarUri(avatarUri: string | null): Promise<void> {
      await database.runAsync(
        `UPDATE profile_preferences
         SET avatar_uri = ?, updated_at = ? WHERE id = 1`,
        avatarUri,
        new Date().toISOString()
      );
    },

    async saveWeightUnit(weightUnit: WeightUnit): Promise<void> {
      if (weightUnit !== 'kg' && weightUnit !== 'lb')
        throw new Error('invalid_weight_unit');
      await database.runAsync(
        `UPDATE profile_preferences
         SET weight_unit = ?, updated_at = ? WHERE id = 1`,
        weightUnit,
        new Date().toISOString()
      );
    },

    async saveWeeklyGoals(
      weeklyWorkoutTarget: number | null,
      weeklyActiveDayTarget: number | null
    ): Promise<void> {
      if (
        (weeklyWorkoutTarget !== null &&
          (!Number.isSafeInteger(weeklyWorkoutTarget) ||
            weeklyWorkoutTarget < 1 ||
            weeklyWorkoutTarget > 14)) ||
        (weeklyActiveDayTarget !== null &&
          (!Number.isSafeInteger(weeklyActiveDayTarget) ||
            weeklyActiveDayTarget < 1 ||
            weeklyActiveDayTarget > 7))
      )
        throw new Error('invalid_weekly_goal');
      await database.runAsync(
        `UPDATE profile_preferences
         SET weekly_workout_target = ?, weekly_active_day_target = ?,
             updated_at = ? WHERE id = 1`,
        weeklyWorkoutTarget,
        weeklyActiveDayTarget,
        new Date().toISOString()
      );
    },

    async saveWorkoutPreferences(input: {
      effortMode: WorkoutEffortMode;
      globalRestSeconds: number;
      hapticsEnabled: boolean;
      keepAwakeEnabled: boolean;
    }): Promise<void> {
      if (
        !['off', 'rpe', 'rir'].includes(input.effortMode) ||
        !Number.isSafeInteger(input.globalRestSeconds) ||
        input.globalRestSeconds < 15 ||
        input.globalRestSeconds > 1800
      )
        throw new Error('invalid_workout_preferences');
      await database.runAsync(
        `UPDATE profile_preferences
         SET workout_effort_mode = ?, global_rest_seconds = ?,
             workout_haptics_enabled = ?, workout_keep_awake_enabled = ?,
             updated_at = ? WHERE id = 1`,
        input.effortMode,
        input.globalRestSeconds,
        input.hapticsEnabled ? 1 : 0,
        input.keepAwakeEnabled ? 1 : 0,
        new Date().toISOString()
      );
    },
  };
}

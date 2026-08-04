import type { SQLiteDatabase } from 'expo-sqlite';

import {
  getInsightDateRange,
  type InsightPeriod,
} from '@/features/insights/insight-periods';

export type InsightSummary = {
  activeDays: number;
  completedSets: number;
  durationMinutes: number;
  firstWeightKg: number | null;
  highestVolumeExercise: string | null;
  latestWeightKg: number | null;
  measurementCount: number;
  mostActiveWeekday: string | null;
  mostFrequentExercise: string | null;
  personalRecords: number;
  points: { label: string; value: number }[];
  totalRepetitions: number;
  totalVolumeKg: number;
  workouts: number;
};

export type InsightComparison = {
  activeDays: number;
  completedSets: number;
  totalVolumeKg: number;
  workouts: number;
};

type AggregateRow = {
  active_days: number;
  completed_sets: number;
  duration_minutes: number;
  personal_records: number;
  total_repetitions: number;
  total_volume_kg: number;
  workouts: number;
};

const WEEKDAYS = [
  'Pazar',
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
];

export function createInsightsRepository(database: SQLiteDatabase) {
  return {
    async getSummary(
      period: InsightPeriod,
      now = new Date()
    ): Promise<InsightSummary> {
      const { end, start } = getInsightDateRange(period, now);
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      const bucketExpression =
        period === 'year'
          ? "strftime('%Y-%m', completed_at, 'localtime')"
          : "date(completed_at, 'localtime')";
      const [aggregate, weights, exercise, volumeExercise, weekday, points] =
        await Promise.all([
          database.getFirstAsync<AggregateRow>(
            `SELECT
            COUNT(DISTINCT ws.id) AS workouts,
            COUNT(DISTINCT date(ws.completed_at, 'localtime')) AS active_days,
            COALESCE(SUM(CASE WHEN wset.is_completed = 1 THEN 1 ELSE 0 END), 0) AS completed_sets,
            COALESCE(SUM(CASE WHEN wset.is_completed = 1 THEN wset.actual_reps ELSE 0 END), 0) AS total_repetitions,
            COALESCE(SUM(CASE WHEN wset.is_completed = 1 THEN wset.weight_kg * wset.actual_reps ELSE 0 END), 0) AS total_volume_kg,
            COALESCE((SELECT SUM((julianday(ds.completed_at) - julianday(ds.started_at)) * 1440)
              FROM workout_sessions ds
              WHERE ds.status = 'completed' AND ds.completed_at >= ? AND ds.completed_at < ?), 0) AS duration_minutes,
            COUNT(DISTINCT CASE WHEN wset.is_completed = 1 AND wset.weight_kg > 0 AND NOT EXISTS (
              SELECT 1 FROM workout_sets older_set
              JOIN workout_session_exercises older_exercise ON older_exercise.id = older_set.session_exercise_id
              JOIN workout_sessions older_session ON older_session.id = older_exercise.session_id
              WHERE older_exercise.exercise_id = wse.exercise_id
                AND older_set.is_completed = 1
                AND older_set.weight_kg >= wset.weight_kg
                AND older_session.completed_at < ws.completed_at
            ) THEN wse.exercise_id END) AS personal_records
          FROM workout_sessions ws
          LEFT JOIN workout_session_exercises wse ON wse.session_id = ws.id
          LEFT JOIN workout_sets wset ON wset.session_exercise_id = wse.id
          WHERE ws.status = 'completed' AND ws.completed_at >= ? AND ws.completed_at < ?`,
            startIso,
            endIso,
            startIso,
            endIso
          ),
          database.getAllAsync<{ weight_kg: number }>(
            `SELECT weight_kg FROM body_measurements
           WHERE measured_at >= ? AND measured_at < ?
           ORDER BY measured_at ASC, id ASC`,
            startIso,
            endIso
          ),
          database.getFirstAsync<{ exercise_name_snapshot: string }>(
            `SELECT wse.exercise_name_snapshot
           FROM workout_session_exercises wse
           JOIN workout_sessions ws ON ws.id = wse.session_id
           WHERE ws.status = 'completed' AND ws.completed_at >= ? AND ws.completed_at < ?
           GROUP BY wse.exercise_name_snapshot
           ORDER BY COUNT(*) DESC, wse.exercise_name_snapshot ASC LIMIT 1`,
            startIso,
            endIso
          ),
          database.getFirstAsync<{ exercise_name_snapshot: string }>(
            `SELECT wse.exercise_name_snapshot
           FROM workout_session_exercises wse
           JOIN workout_sessions ws ON ws.id = wse.session_id
           JOIN workout_sets wset ON wset.session_exercise_id = wse.id
           WHERE ws.status = 'completed' AND wset.is_completed = 1
             AND ws.completed_at >= ? AND ws.completed_at < ?
           GROUP BY wse.exercise_name_snapshot
           ORDER BY SUM(wset.weight_kg * wset.actual_reps) DESC,
                    wse.exercise_name_snapshot ASC LIMIT 1`,
            startIso,
            endIso
          ),
          database.getFirstAsync<{ weekday: string }>(
            `SELECT strftime('%w', completed_at, 'localtime') AS weekday
           FROM workout_sessions
           WHERE status = 'completed' AND completed_at >= ? AND completed_at < ?
           GROUP BY weekday ORDER BY COUNT(*) DESC, weekday ASC LIMIT 1`,
            startIso,
            endIso
          ),
          database.getAllAsync<{ bucket: string; workouts: number }>(
            `SELECT ${bucketExpression} AS bucket, COUNT(*) AS workouts
           FROM workout_sessions
           WHERE status = 'completed' AND completed_at >= ? AND completed_at < ?
           GROUP BY bucket ORDER BY bucket ASC`,
            startIso,
            endIso
          ),
        ]);
      const safe = aggregate ?? {
        active_days: 0,
        completed_sets: 0,
        duration_minutes: 0,
        personal_records: 0,
        total_repetitions: 0,
        total_volume_kg: 0,
        workouts: 0,
      };
      return {
        activeDays: safe.active_days,
        completedSets: safe.completed_sets,
        durationMinutes: Math.max(0, Math.round(safe.duration_minutes)),
        firstWeightKg: weights.at(0)?.weight_kg ?? null,
        highestVolumeExercise: volumeExercise?.exercise_name_snapshot ?? null,
        latestWeightKg: weights.at(-1)?.weight_kg ?? null,
        measurementCount: weights.length,
        mostActiveWeekday: weekday
          ? (WEEKDAYS[Number(weekday.weekday)] ?? null)
          : null,
        mostFrequentExercise: exercise?.exercise_name_snapshot ?? null,
        personalRecords: safe.personal_records,
        points: points.map((point) => ({
          label: point.bucket.slice(5),
          value: point.workouts,
        })),
        totalRepetitions: safe.total_repetitions,
        totalVolumeKg: safe.total_volume_kg,
        workouts: safe.workouts,
      };
    },

    async getPreviousComparison(
      period: InsightPeriod,
      now = new Date()
    ): Promise<InsightComparison> {
      const current = getInsightDateRange(period, now);
      const previousNow = new Date(current.start.getTime() - 1);
      const previous = await this.getSummary(period, previousNow);
      return {
        activeDays: previous.activeDays,
        completedSets: previous.completedSets,
        totalVolumeKg: previous.totalVolumeKg,
        workouts: previous.workouts,
      };
    },
  };
}

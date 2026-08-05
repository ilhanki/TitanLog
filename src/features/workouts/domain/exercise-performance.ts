import type {
  WeightMode,
  WorkoutSetType,
} from '@/features/workouts/domain/models';

export type ExerciseIdentity = {
  exerciseId: number | null;
  legacyMatched: boolean;
  name: string;
};

export type ExercisePerformanceSet = {
  actualReps: number;
  effortMode?: 'rpe' | 'rir' | null;
  effortValue?: number | null;
  setNumber: number;
  setType?: WorkoutSetType;
  weightKg: number;
};

export type ExerciseAppearance = {
  completedAt: string;
  completedSetCount: number;
  exerciseId: number | null;
  highestWeightKg: number | null;
  legacyMatched: boolean;
  sessionExerciseId: number;
  sessionId: number;
  sets: readonly ExercisePerformanceSet[];
  totalRepetitions: number;
  totalVolume: number;
  weightMode: WeightMode;
  workoutName: string;
};

export type ExerciseRecord = {
  achievedAt: string;
  sessionId: number;
  value: number;
};

export type ExerciseRecords = {
  appearanceCount: number;
  highestRepetitions: ExerciseRecord | null;
  highestSessionVolume: ExerciseRecord | null;
  highestWeight: ExerciseRecord | null;
  lastPerformance: ExerciseAppearance | null;
  legacyMatched: boolean;
};

export type ActiveExercisePerformance = {
  previous: ReadonlyMap<number, ExerciseAppearance>;
  records: ReadonlyMap<number, ExerciseRecords>;
};

export type ExerciseHistory = {
  equipment: string | null;
  exerciseId: number;
  exerciseName: string;
  hasMore: boolean;
  legacyMatched: boolean;
  muscleGroup: string | null;
  records: ExerciseRecords;
  recentAppearances: readonly ExerciseAppearance[];
  weightMode: WeightMode | null;
};

export type PersonalRecordKind = 'weight' | 'repetitions' | 'volume';

export type PersonalRecordResult = {
  kind: PersonalRecordKind;
  value: number;
};

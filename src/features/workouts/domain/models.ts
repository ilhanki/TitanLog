export type WeightMode = 'total' | 'per_hand';
export type WorkoutSessionStatus = 'active' | 'completed' | 'cancelled';
export type WorkoutSetType =
  'warm_up' | 'working' | 'drop' | 'amrap' | 'failure';
export type WorkoutEffortMode = 'rpe' | 'rir' | 'off';

export type WorkoutExercise = {
  equipment: string;
  id: number;
  muscleGroup: string;
  name: string;
  sortOrder: number;
  setCount: number;
  targetReps: number;
  weightKg: number;
  weightMode: WeightMode;
  defaultRestSeconds?: number;
  supersetGroupId?: string | null;
  supersetOrder?: number | null;
};

export type WorkoutDay = {
  exerciseCount: number;
  exercisePreview: readonly string[];
  id: number;
  name: string;
  scheduleWeekdays: readonly number[];
  sortOrder: number;
  subtitle: string;
  totalSetCount: number;
};

export type WorkoutDayDetails = WorkoutDay & {
  exercises: readonly WorkoutExercise[];
};

export type WorkoutPlan = {
  days: readonly WorkoutDay[];
  description: string;
  id: number;
  name: string;
};

export type AvailableExercise = {
  equipment: string;
  id: number;
  muscleGroup: string;
  name: string;
};

export type WorkoutDayDraft = {
  name: string;
  scheduleWeekdays: readonly number[];
  subtitle: string;
};

export type ExerciseDefaultsDraft = {
  defaultRestSeconds?: number;
  setCount: number;
  targetReps: number;
  weightKg: number;
  weightMode: WeightMode;
};

export type CustomExerciseDraft = ExerciseDefaultsDraft & {
  equipment: string;
  muscleGroup: string;
  name: string;
};

export type WorkoutSet = {
  actualReps: number | null;
  completedAt: string | null;
  id: number;
  isCompleted: boolean;
  effortMode?: Exclude<WorkoutEffortMode, 'off'> | null;
  effortValue?: number | null;
  setType?: WorkoutSetType;
  setNumber: number;
  targetReps: number;
  weightKg: number;
};

export type WorkoutSessionExercise = {
  exerciseId: number;
  id: number;
  muscleGroup: string;
  isSkipped?: boolean;
  restDurationSeconds?: number;
  name: string;
  sets: readonly WorkoutSet[];
  sortOrder: number;
  supersetGroupId?: string | null;
  supersetOrder?: number | null;
  weightMode: WeightMode;
};

export type WorkoutSession = {
  cancelledAt: string | null;
  completedAt: string | null;
  exercises: readonly WorkoutSessionExercise[];
  id: number;
  notes?: string;
  restTimer?: RestTimerState | null;
  selectedSessionExerciseId?: number | null;
  startedAt: string;
  status: WorkoutSessionStatus;
  workoutDayId: number;
  workoutName: string;
};

export type RestTimerState = {
  alertedAt: string | null;
  deadline: string;
  durationSeconds: number;
  notificationIdentifier: string | null;
  sessionExerciseId: number | null;
};

export type CompletedWorkoutSummary = {
  completedAt: string;
  completedSetCount: number;
  averageEffort?: number | null;
  averageEffortMode?: 'rpe' | 'rir' | null;
  durationMinutes: number | null;
  exerciseCount?: number;
  exerciseNames: readonly string[];
  personalRecordCount?: number;
  previousWorkoutVolume?: number | null;
  id: number;
  startedAt: string;
  totalRepetitions: number;
  totalVolume: number;
  warmUpSetCount?: number;
  workoutDayId: number;
  workoutName: string;
};

export type CompletedWorkoutHistoryItem = Omit<
  CompletedWorkoutSummary,
  'exerciseNames'
>;

export type CompletedWorkoutExerciseDetail = WorkoutSessionExercise & {
  completedSetCount: number;
  totalRepetitions: number;
  totalVolume: number;
};

export type CompletedWorkoutComparison = {
  completedSetDifference: number;
  durationDifferenceMinutes: number | null;
  previousCompletedAt: string;
  previousSessionId: number;
  totalRepetitionDifference: number;
  totalVolumeDifference: number;
  volumePercentageDifference: number | null;
};

export type CompletedWorkoutDetail = {
  comparison: CompletedWorkoutComparison | null;
  completedAt: string;
  completedSetCount: number;
  durationMinutes: number | null;
  exercises: readonly CompletedWorkoutExerciseDetail[];
  id: number;
  notes?: string;
  startedAt: string;
  totalRepetitions: number;
  totalVolume: number;
  workoutDayId: number;
  workoutName: string;
};

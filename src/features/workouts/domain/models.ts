export type WeightMode = 'total' | 'per_hand';
export type WorkoutSessionStatus = 'active' | 'completed' | 'cancelled';

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
};

export type WorkoutDay = {
  exerciseCount: number;
  exercisePreview: readonly string[];
  id: number;
  name: string;
  scheduleWeekdays: readonly number[];
  sortOrder: number;
  subtitle: string;
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

export type WorkoutSet = {
  actualReps: number | null;
  completedAt: string | null;
  id: number;
  isCompleted: boolean;
  setNumber: number;
  targetReps: number;
  weightKg: number;
};

export type WorkoutSessionExercise = {
  exerciseId: number;
  id: number;
  muscleGroup: string;
  name: string;
  sets: readonly WorkoutSet[];
  sortOrder: number;
  weightMode: WeightMode;
};

export type WorkoutSession = {
  cancelledAt: string | null;
  completedAt: string | null;
  exercises: readonly WorkoutSessionExercise[];
  id: number;
  startedAt: string;
  status: WorkoutSessionStatus;
  workoutDayId: number;
  workoutName: string;
};

export type CompletedWorkoutSummary = {
  completedAt: string;
  completedSetCount: number;
  exerciseNames: readonly string[];
  id: number;
  totalRepetitions: number;
  totalVolume: number;
  workoutName: string;
};

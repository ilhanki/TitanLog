export type WorkoutControlId = string & {
  readonly __workoutControlId: unique symbol;
};

export type WorkoutCommand =
  | {
      actualReps: number;
      setId: WorkoutControlId;
      type: 'complete_set';
      weightKg: number;
    }
  | { setId: WorkoutControlId; type: 'undo_set' }
  | {
      durationSeconds: number;
      sessionExerciseId: WorkoutControlId | null;
      type: 'start_rest_timer';
    }
  | { deltaSeconds: number; type: 'adjust_rest_timer' }
  | { type: 'cancel_rest_timer' }
  | { sessionExerciseId: WorkoutControlId; type: 'select_exercise' }
  | { sessionExerciseId: WorkoutControlId; type: 'skip_exercise' };

export type WorkoutEvent =
  | { setId: WorkoutControlId; type: 'set_completed' }
  | { setId: WorkoutControlId; type: 'set_undone' }
  | { deadline: string; type: 'rest_timer_started' }
  | { type: 'rest_timer_finished' }
  | { sessionExerciseId: WorkoutControlId; type: 'exercise_selected' }
  | { sessionId: WorkoutControlId; type: 'workout_completed' };

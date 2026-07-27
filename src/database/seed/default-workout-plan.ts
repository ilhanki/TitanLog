import type { WeightMode } from '@/features/workouts/domain/models';

export type DefaultExerciseSeed = {
  equipment: string;
  muscleGroup: string;
  name: string;
  targetReps: number;
  setCount: number;
  weightKg: number;
  weightMode: WeightMode;
};

export type DefaultWorkoutDaySeed = {
  exercises: readonly DefaultExerciseSeed[];
  name: string;
  scheduleWeekdays: readonly number[];
  sortOrder: number;
  subtitle: string;
};

const DEFAULT_SET_COUNT = 3;
const DEFAULT_TARGET_REPS = 12;

function exercise(
  name: string,
  muscleGroup: string,
  equipment: string,
  weightKg: number,
  weightMode: WeightMode = 'total'
): DefaultExerciseSeed {
  return {
    equipment,
    muscleGroup,
    name,
    setCount: DEFAULT_SET_COUNT,
    targetReps: DEFAULT_TARGET_REPS,
    weightKg,
    weightMode,
  };
}

export const defaultWorkoutPlanSeed = {
  name: 'Titan Başlangıç Programı',
  description:
    'Haftanın altı gününe dengeli biçimde yayılan başlangıç programı.',
  days: [
    {
      name: 'Sırt + Biceps',
      subtitle: 'Sırt ve kol çekiş kasları',
      sortOrder: 1,
      scheduleWeekdays: [1, 4],
      exercises: [
        exercise('Lat Pulldown', 'Sırt', 'Cable machine', 50),
        exercise('Low Row', 'Sırt', 'Cable machine', 60),
        exercise('Seated Row', 'Sırt', 'Dumbbell', 20, 'per_hand'),
        exercise('Face Pull', 'Arka omuz', 'Cable machine', 50),
        exercise('Dumbbell Curl', 'Biceps', 'Dumbbell', 17.5, 'per_hand'),
        exercise('Hammer Curl', 'Biceps', 'Dumbbell', 17.5, 'per_hand'),
        exercise('Cable Curl', 'Biceps', 'Cable machine', 40),
      ],
    },
    {
      name: 'Göğüs + Triceps',
      subtitle: 'Göğüs ve itiş kasları',
      sortOrder: 2,
      scheduleWeekdays: [2, 6],
      exercises: [
        exercise('Chest Press', 'Göğüs', 'Machine', 60),
        exercise('Incline Press', 'Üst göğüs', 'Machine', 30),
        exercise('Pec Deck Fly', 'Göğüs', 'Machine', 45),
        exercise('Triceps Pushdown', 'Triceps', 'Cable machine', 45),
        exercise('Overhead Triceps Extension', 'Triceps', 'Dumbbell', 10),
        exercise('Rope Pushdown', 'Triceps', 'Cable machine', 20),
      ],
    },
    {
      name: 'Bacak + Omuz',
      subtitle: 'Alt vücut ve omuz kasları',
      sortOrder: 3,
      scheduleWeekdays: [3, 7],
      exercises: [
        exercise('Leg Press', 'Bacak', 'Machine', 140),
        exercise('Leg Extension', 'Ön bacak', 'Machine', 100),
        exercise('Leg Curl', 'Arka bacak', 'Machine', 50),
        exercise('Shoulder Press', 'Omuz', 'Dumbbell', 15),
        exercise('Lateral Raise', 'Yan omuz', 'Dumbbell', 5, 'per_hand'),
        exercise('Rear Delt Fly', 'Arka omuz', 'Machine', 30),
        exercise('Shrug', 'Trapez', 'Dumbbell', 20, 'per_hand'),
      ],
    },
  ],
} as const;

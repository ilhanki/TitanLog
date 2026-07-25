export type HomePreviewData = {
  todayWorkout: {
    title: string;
    schedule: string;
  };
  stats: {
    sportsDays: number;
    currentWeight: number;
    targetWeight: number;
    streakDays: number;
  };
  goal: {
    startingWeight: number;
    currentWeight: number;
    targetWeight: number;
  };
  lastWorkout: {
    dateLabel: string;
    exercises: readonly {
      name: string;
      weight: number;
    }[];
    totalVolume: number;
  };
};

export const homePreviewData = {
  todayWorkout: {
    title: 'Sırt + Biceps',
    schedule: 'Pazartesi / Perşembe',
  },
  stats: {
    sportsDays: 36,
    currentWeight: 114.8,
    targetWeight: 99.9,
    streakDays: 6,
  },
  goal: {
    startingWeight: 119.6,
    currentWeight: 114.8,
    targetWeight: 99.9,
  },
  lastWorkout: {
    dateLabel: 'Dün',
    exercises: [
      { name: 'Lat Pulldown', weight: 50 },
      { name: 'Low Row', weight: 60 },
      { name: 'Dumbbell Curl', weight: 17.5 },
    ],
    totalVolume: 18420,
  },
} as const satisfies HomePreviewData;

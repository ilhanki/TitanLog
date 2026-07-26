export type HomePreviewData = {
  goal: {
    currentWeight: number;
    startingWeight: number;
    targetWeight: number;
  };
  stats: {
    currentWeight: number;
    targetWeight: number;
  };
};

// Body metrics are UI preview values and are not persisted in Sprint 2.
export const homePreviewData = {
  goal: {
    startingWeight: 119.6,
    currentWeight: 114.8,
    targetWeight: 99.9,
  },
  stats: {
    currentWeight: 114.8,
    targetWeight: 99.9,
  },
} as const satisfies HomePreviewData;

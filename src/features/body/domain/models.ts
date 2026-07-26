export type BodyProfile = {
  createdAt: string;
  id: number;
  startingWeightKg: number;
  targetWeightKg: number;
  updatedAt: string;
};

export type BodyMeasurement = {
  chestCm: number | null;
  createdAt: string;
  hipCm: number | null;
  id: number;
  measuredAt: string;
  note: string | null;
  thighCm: number | null;
  upperArmCm: number | null;
  updatedAt: string;
  waistCm: number | null;
  weightKg: number;
};

export type BodyMeasurementInput = Pick<
  BodyMeasurement,
  | 'chestCm'
  | 'hipCm'
  | 'note'
  | 'thighCm'
  | 'upperArmCm'
  | 'waistCm'
  | 'weightKg'
>;

export type BodyProgress = {
  changeFromPreviousKg: number | null;
  currentWeightKg: number;
  direction: 'gain' | 'loss';
  progress: number;
  progressPercentage: number;
  remainingWeightKg: number;
  targetReached: boolean;
  totalChangeKg: number;
};

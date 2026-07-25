export function calculateGoalProgress(
  startingWeight: number,
  currentWeight: number,
  targetWeight: number
) {
  const totalChange = startingWeight - targetWeight;

  if (totalChange <= 0) {
    return 0;
  }

  const progress = (startingWeight - currentWeight) / totalChange;
  return Math.min(Math.max(progress, 0), 1);
}

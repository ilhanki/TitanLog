const weekdayNames = [
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
  'Pazar',
] as const;

export function formatWorkoutWeekdays(weekdays: readonly number[]): string {
  return weekdays
    .map((weekday) => weekdayNames[weekday - 1])
    .filter(Boolean)
    .join(' · ');
}

export function formatWorkoutDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatWorkoutTime(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatWorkoutDuration(minutes: number | null): string {
  if (minutes === null) return 'Süre bilgisi yok';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0
    ? `${hours} sa ${remainingMinutes} dk`
    : `${remainingMinutes} dk`;
}

export function formatWorkoutDifference(value: number, unit = ''): string {
  const formatted = new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 1,
    signDisplay: 'always',
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

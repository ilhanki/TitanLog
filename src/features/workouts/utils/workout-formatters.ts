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

export function formatBodyDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatSignedBodyValue(value: number): string {
  const formatted = new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 2,
    signDisplay: 'always',
  }).format(value);
  return `${formatted} kg`;
}

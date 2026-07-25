export function formatTurkishNumber(value: number, fractionDigits = 0) {
  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatWeight(value: number, fractionDigits = 1) {
  return `${formatTurkishNumber(value, fractionDigits)} kg`;
}

export function formatProgress(progress: number) {
  return `%${formatTurkishNumber(progress * 100, 1)}`;
}

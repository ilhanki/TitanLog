import type { WeightUnit } from '@/features/profile/profile-preferences';

const KG_TO_LB = 2.2046226218;

export function formatWeight(valueKg: number | null, unit: WeightUnit): string {
  if (valueKg === null) return '—';
  const value = unit === 'lb' ? valueKg * KG_TO_LB : valueKg;
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value)} ${unit}`;
}

export function formatVolume(valueKg: number, unit: WeightUnit): string {
  const value = unit === 'lb' ? valueKg * KG_TO_LB : valueKg;
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(value)} ${unit}`;
}

export function weightChangeMessage(
  firstKg: number | null,
  latestKg: number | null,
  unit: WeightUnit
): string {
  if (firstKg === null || latestKg === null || firstKg === latestKg) {
    return firstKg === null || latestKg === null
      ? 'Karşılaştırma için en az iki ölçüm gerekiyor.'
      : 'Bu dönemde kilon değişmedi.';
  }
  const difference = latestKg - firstKg;
  return `Bu dönemde ${formatWeight(Math.abs(difference), unit)} ${difference > 0 ? 'aldın' : 'verdin'}.`;
}

export function comparisonMessage(
  current: number,
  previous: number,
  label: string
): string {
  if (current === previous) return `Önceki döneme göre ${label} değişmedi.`;
  const difference = Math.abs(current - previous);
  return `Önceki döneme göre ${difference} ${label} ${current > previous ? 'fazla' : 'az'}.`;
}

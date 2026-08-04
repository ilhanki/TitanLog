import {
  comparisonMessage,
  formatVolume,
  formatWeight,
  weightChangeMessage,
} from '@/features/insights/insight-formatters';
import { getInsightDateRange } from '@/features/insights/insight-periods';

describe('insight period boundaries', () => {
  it('starts the Turkish week on Monday and excludes the next Monday', () => {
    const range = getInsightDateRange('week', new Date(2026, 7, 4, 12));
    expect(range.start).toEqual(new Date(2026, 7, 3));
    expect(range.end).toEqual(new Date(2026, 7, 10));
  });

  it('handles leap-year February without UTC boundary drift', () => {
    const range = getInsightDateRange('month', new Date(2024, 1, 29, 23));
    expect(range.start).toEqual(new Date(2024, 1, 1));
    expect(range.end).toEqual(new Date(2024, 2, 1));
  });

  it('uses neutral Turkish weight-change wording', () => {
    expect(weightChangeMessage(100, 98.8, 'kg')).toContain('1,2 kg verdin');
    expect(weightChangeMessage(98.8, 100, 'kg')).toContain('1,2 kg aldın');
    expect(weightChangeMessage(100, 100, 'kg')).toContain('değişmedi');
    expect(weightChangeMessage(null, 100, 'kg')).toContain('en az iki ölçüm');
  });

  it('does not invent percentages when previous values are zero', () => {
    expect(comparisonMessage(2, 0, 'antrenman')).toBe(
      'Önceki döneme göre 2 antrenman fazla.'
    );
  });
});

describe('insight unit formatting', () => {
  it('formats kg and lb from the same canonical kg value', () => {
    expect(formatWeight(100, 'kg')).toContain('100');
    expect(formatWeight(100, 'lb')).toContain('220,5');
    expect(formatVolume(1000, 'lb')).toContain('2.205');
  });
});

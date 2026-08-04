export type InsightPeriod = 'week' | 'month' | 'year';

export type DateRange = { end: Date; start: Date };

export function getInsightDateRange(
  period: InsightPeriod,
  now = new Date()
): DateRange {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'week') {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
  } else if (period === 'month') {
    start.setDate(1);
  } else {
    start.setMonth(0, 1);
  }
  const end = new Date(start);
  if (period === 'week') end.setDate(end.getDate() + 7);
  else if (period === 'month') end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  return { end, start };
}

export function periodLabel(period: InsightPeriod, now = new Date()): string {
  const { end, start } = getInsightDateRange(period, now);
  const last = new Date(end.getTime() - 1);
  const format = new Intl.DateTimeFormat('tr-TR', {
    day: period === 'year' ? undefined : 'numeric',
    month: 'short',
    year: period === 'week' ? undefined : 'numeric',
  });
  return period === 'year'
    ? format.format(start)
    : `${format.format(start)} – ${format.format(last)}`;
}

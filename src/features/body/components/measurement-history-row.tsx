import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import type { BodyMeasurement } from '@/features/body/domain/models';
import {
  formatBodyDate,
  formatSignedBodyValue,
} from '@/features/body/utils/body-formatters';
import { formatBodyValue } from '@/features/body/utils/body-values';
import { theme } from '@/theme/tokens';

type MeasurementHistoryRowProps = {
  latest: boolean;
  measurement: BodyMeasurement;
  older: BodyMeasurement | null;
  onPress: () => void;
};

export function MeasurementHistoryRow({
  latest,
  measurement,
  older,
  onPress,
}: MeasurementHistoryRowProps) {
  const delta = older ? measurement.weightKg - older.weightKg : null;
  const optionalValues = [
    measurement.waistCm
      ? `${appStrings.progress.waist}: ${formatBodyValue(measurement.waistCm)} cm`
      : null,
    measurement.chestCm
      ? `${appStrings.progress.chest}: ${formatBodyValue(measurement.chestCm)} cm`
      : null,
    measurement.hipCm
      ? `${appStrings.progress.hip}: ${formatBodyValue(measurement.hipCm)} cm`
      : null,
  ].filter(Boolean);
  const date = formatBodyDate(measurement.measuredAt);
  const change =
    delta === null
      ? 'İlk ölçüm'
      : `Önceki ölçüme göre ${formatSignedBodyValue(delta)}`;

  return (
    <Pressable
      accessibilityLabel={`${latest ? 'Son ölçüm, ' : ''}${date}, ${formatBodyValue(measurement.weightKg)} kilogram, ${change}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <View style={styles.copy}>
          <View style={styles.dateRow}>
            <AppText selectable variant="bodyStrong">
              {date}
            </AppText>
            {latest ? (
              <AppText tone="primary" variant="caption">
                Son Ölçüm
              </AppText>
            ) : null}
          </View>
          <AppText selectable tone="muted" variant="caption">
            {change}
          </AppText>
        </View>
        <AppText selectable style={styles.weight} variant="heading">
          {formatBodyValue(measurement.weightKg)} kg
        </AppText>
      </View>
      {optionalValues.length ? (
        <AppText numberOfLines={2} selectable tone="subtle" variant="caption">
          {optionalValues.join(' · ')}
        </AppText>
      ) : null}
      {measurement.note ? (
        <AppText numberOfLines={2} selectable tone="muted" variant="caption">
          {measurement.note}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: theme.spacing.xs, minWidth: 0 },
  dateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  pressed: { backgroundColor: theme.colors.surfacePressed },
  row: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: theme.borders.hairline,
    gap: theme.spacing.sm,
    minHeight: theme.layout.touchTarget,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  weight: { fontVariant: ['tabular-nums'] },
});

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { AppTextInput } from '@/components/app-text-input';
import {
  WeightWheelModal,
  type WeightWheelKind,
} from '@/components/weight-wheel-modal';
import {
  formatBodyValue,
  parseBodyWeight,
} from '@/features/body/utils/body-values';
import {
  formatWorkoutWeight,
  parseWeightInput,
} from '@/features/workouts/utils/workout-values';
import { InlineNumericWheelField } from '@/features/workouts/components/inline-numeric-wheel-field';
import { theme } from '@/theme/tokens';

type WeightSelectorFieldProps = {
  accessibilityLabel?: string;
  editable?: boolean;
  error?: string;
  fallbackValue?: number;
  kind: WeightWheelKind;
  label: string;
  onChangeText: (value: string) => void;
  title: string;
  value: string;
};

export function resolveWeightSelectorValue(
  value: string,
  kind: WeightWheelKind,
  fallbackValue?: number
): number {
  const parsed =
    kind === 'body' ? parseBodyWeight(value) : parseWeightInput(value);
  return parsed ?? fallbackValue ?? (kind === 'body' ? 70 : 2.5);
}

export function WeightSelectorField({
  accessibilityLabel,
  editable = true,
  error,
  fallbackValue,
  kind,
  label,
  onChangeText,
  title,
  value,
}: WeightSelectorFieldProps) {
  const [visible, setVisible] = useState(false);
  const wheelValue = resolveWeightSelectorValue(value, kind, fallbackValue);

  if (kind === 'exercise') {
    return (
      <View style={styles.inlineField}>
        <AppText variant="label">{label}</AppText>
        <InlineNumericWheelField
          accessibilityLabel={accessibilityLabel ?? label}
          disabled={!editable}
          formatValue={formatWorkoutWeight}
          inputMode="decimal"
          keyboardType="decimal-pad"
          max={2000}
          min={2.5}
          onChangeText={onChangeText}
          parseValue={parseWeightInput}
          step={2.5}
          unit="kilogram"
          value={value}
        />
        {error ? (
          <AppText accessibilityRole="alert" tone="danger" variant="caption">
            {error}
          </AppText>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <AppTextInput
        accessibilityLabel={accessibilityLabel}
        editable={editable}
        error={error}
        inputMode="decimal"
        keyboardType="decimal-pad"
        label={label}
        onChangeText={onChangeText}
        onFocus={() => setVisible(true)}
        showSoftInputOnFocus={false}
        value={value}
      />
      <WeightWheelModal
        accessibilityLabel={accessibilityLabel ?? label}
        kind={kind}
        onApply={(nextValue) => {
          onChangeText(
            kind === 'body'
              ? formatBodyValue(nextValue)
              : formatWorkoutWeight(nextValue)
          );
          setVisible(false);
        }}
        onCancel={() => setVisible(false)}
        title={title}
        value={wheelValue}
        visible={visible}
      />
    </>
  );
}

const styles = StyleSheet.create({
  inlineField: { gap: theme.spacing.xs },
});

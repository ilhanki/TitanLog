import { useState } from 'react';

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

import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { AppTextInput } from '@/components/app-text-input';
import { WeightSelectorField } from '@/components/weight-selector-field';
import { appStrings } from '@/constants/strings';
import type {
  BodyMeasurement,
  BodyMeasurementInput,
} from '@/features/body/domain/models';
import {
  BODY_NOTE_MAX_LENGTH,
  formatBodyValue,
  isValidOptionalBodyMeasurement,
  parseBodyWeight,
  parseOptionalBodyMeasurement,
} from '@/features/body/utils/body-values';
import { theme } from '@/theme/tokens';

type BodyMeasurementFormProps = {
  initial?: BodyMeasurement;
  initialWeightKg?: number;
  measurementDate?: string;
  onCancel?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (input: BodyMeasurementInput) => Promise<void>;
  pending: boolean;
  submitLabel: string;
};

type Fields = {
  chest: string;
  hip: string;
  note: string;
  thigh: string;
  upperArm: string;
  waist: string;
  weight: string;
};

const optionalValue = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : formatBodyValue(value);

export function BodyMeasurementForm({
  initial,
  initialWeightKg,
  measurementDate,
  onCancel,
  onDirtyChange,
  onSubmit,
  pending,
  submitLabel,
}: BodyMeasurementFormProps) {
  const initialFields = useMemo<Fields>(
    () => ({
      chest: optionalValue(initial?.chestCm),
      hip: optionalValue(initial?.hipCm),
      note: initial?.note ?? '',
      thigh: optionalValue(initial?.thighCm),
      upperArm: optionalValue(initial?.upperArmCm),
      waist: optionalValue(initial?.waistCm),
      weight:
        initial || initialWeightKg !== undefined
          ? formatBodyValue(initial?.weightKg ?? initialWeightKg!)
          : '',
    }),
    [initial, initialWeightKg]
  );
  const [fields, setFields] = useState<Fields>(initialFields);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const dirty = JSON.stringify(fields) !== JSON.stringify(initialFields);

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const update = (key: keyof Fields, value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (submittingRef.current) return;
    const weightKg = parseBodyWeight(fields.weight);
    if (weightKg === null) {
      setError(appStrings.progress.invalidWeight);
      return;
    }
    const optionalFields = [
      fields.waist,
      fields.chest,
      fields.upperArm,
      fields.hip,
      fields.thigh,
    ];
    if (!optionalFields.every(isValidOptionalBodyMeasurement)) {
      setError(appStrings.progress.invalidMeasurement);
      return;
    }
    const note = fields.note.trim();
    if (note.length > BODY_NOTE_MAX_LENGTH) {
      setError(appStrings.progress.noteTooLong);
      return;
    }
    setError(null);
    submittingRef.current = true;
    try {
      await onSubmit({
        chestCm: parseOptionalBodyMeasurement(fields.chest),
        hipCm: parseOptionalBodyMeasurement(fields.hip),
        note: note || null,
        thighCm: parseOptionalBodyMeasurement(fields.thigh),
        upperArmCm: parseOptionalBodyMeasurement(fields.upperArm),
        waistCm: parseOptionalBodyMeasurement(fields.waist),
        weightKg,
      });
    } finally {
      submittingRef.current = false;
    }
  };

  const numericFields: {
    key: keyof Pick<Fields, 'chest' | 'hip' | 'thigh' | 'upperArm' | 'waist'>;
    label: string;
  }[] = [
    { key: 'waist', label: appStrings.progress.waist },
    { key: 'chest', label: appStrings.progress.chest },
    { key: 'upperArm', label: appStrings.progress.upperArm },
    { key: 'hip', label: appStrings.progress.hip },
    { key: 'thigh', label: appStrings.progress.thigh },
  ];

  return (
    <View style={styles.form}>
      {measurementDate ? (
        <View style={styles.dateRow}>
          <AppText tone="muted" variant="caption">
            Tarih
          </AppText>
          <AppText selectable variant="bodyStrong">
            {measurementDate}
          </AppText>
        </View>
      ) : null}
      <WeightSelectorField
        editable={!pending}
        error={error ?? undefined}
        fallbackValue={initial?.weightKg ?? initialWeightKg}
        kind="body"
        label={appStrings.progress.weight}
        onChangeText={(value) => update('weight', value)}
        title="Kilonu Seç"
        value={fields.weight}
      />
      {numericFields.map((field) => (
        <AppTextInput
          editable={!pending}
          inputMode="decimal"
          key={field.key}
          keyboardType="decimal-pad"
          label={`${field.label} (${appStrings.progress.centimeters})`}
          onChangeText={(value) => update(field.key, value)}
          value={fields[field.key]}
        />
      ))}
      <AppTextInput
        editable={!pending}
        label={appStrings.progress.note}
        maxLength={BODY_NOTE_MAX_LENGTH}
        multiline
        onChangeText={(value) => update('note', value)}
        placeholder={appStrings.progress.notePlaceholder}
        style={styles.note}
        value={fields.note}
      />
      <View style={styles.actions}>
        {onCancel ? (
          <AppButton
            disabled={pending}
            label="Kapat"
            onPress={onCancel}
            style={styles.action}
            variant="ghost"
          />
        ) : null}
        <AppButton
          disabled={pending}
          label={submitLabel}
          onPress={() => void submit()}
          style={onCancel ? styles.action : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: { flex: 1 },
  actions: { flexDirection: 'row', gap: theme.spacing.sm },
  dateRow: {
    alignItems: 'center',
    borderBottomColor: theme.colors.border,
    borderBottomWidth: theme.borders.hairline,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: theme.layout.compactTouchTarget,
  },
  form: { gap: theme.spacing.lg },
  note: { minHeight: 84, textAlignVertical: 'top' },
});

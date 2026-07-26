import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppTextInput } from '@/components/app-text-input';
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
  onSubmit,
  pending,
  submitLabel,
}: BodyMeasurementFormProps) {
  const [fields, setFields] = useState<Fields>({
    chest: optionalValue(initial?.chestCm),
    hip: optionalValue(initial?.hipCm),
    note: initial?.note ?? '',
    thigh: optionalValue(initial?.thighCm),
    upperArm: optionalValue(initial?.upperArmCm),
    waist: optionalValue(initial?.waistCm),
    weight: initial ? formatBodyValue(initial.weightKg) : '',
  });
  const [error, setError] = useState<string | null>(null);

  const update = (key: keyof Fields, value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const submit = async () => {
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
    await onSubmit({
      chestCm: parseOptionalBodyMeasurement(fields.chest),
      hipCm: parseOptionalBodyMeasurement(fields.hip),
      note: note || null,
      thighCm: parseOptionalBodyMeasurement(fields.thigh),
      upperArmCm: parseOptionalBodyMeasurement(fields.upperArm),
      waistCm: parseOptionalBodyMeasurement(fields.waist),
      weightKg,
    });
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
      <AppTextInput
        editable={!pending}
        error={error ?? undefined}
        inputMode="decimal"
        keyboardType="decimal-pad"
        label={appStrings.progress.weight}
        onChangeText={(value) => update('weight', value)}
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
      <AppButton
        disabled={pending}
        label={submitLabel}
        onPress={() => void submit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: theme.spacing.lg },
  note: { minHeight: 100, textAlignVertical: 'top' },
});

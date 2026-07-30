import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppIcon } from '@/components/app-icon';
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
        <AppCard style={styles.dateCard}>
          <View style={styles.metaIcon}>
            <AppIcon
              color={theme.colors.primary}
              name="calendar-blank-outline"
              size={theme.iconSizes.md}
            />
          </View>
          <View style={styles.dateCopy}>
            <AppText tone="muted" variant="caption">
              Ölçüm Tarihi
            </AppText>
            <AppText selectable variant="bodyStrong">
              {measurementDate}
            </AppText>
          </View>
          <View style={styles.todayBadge}>
            <AppText tone="primary" variant="caption">
              Bugün
            </AppText>
          </View>
        </AppCard>
      ) : null}
      <WeightSelectorField
        editable={!pending}
        error={error ?? undefined}
        fallbackValue={initial?.weightKg ?? initialWeightKg}
        kind="body"
        label={appStrings.progress.weight}
        onChangeText={(value) => update('weight', value)}
        presentation="card"
        title="Kilonu Seç"
        value={fields.weight}
      />
      <AppCard style={styles.detailsCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.metaIcon}>
            <AppIcon
              color={theme.colors.textMuted}
              name="tape-measure"
              size={theme.iconSizes.md}
            />
          </View>
          <View style={styles.dateCopy}>
            <AppText variant="bodyStrong">Vücut Ölçüleri</AppText>
            <AppText tone="muted" variant="caption">
              İsteğe bağlı alanları dilediğin zaman ekleyebilirsin.
            </AppText>
          </View>
        </View>
        <View style={styles.measurementGrid}>
          {numericFields.map((field) => (
            <View key={field.key} style={styles.measurementField}>
              <AppTextInput
                editable={!pending}
                inputMode="decimal"
                keyboardType="decimal-pad"
                label={`${field.label} (${appStrings.progress.centimeters})`}
                onChangeText={(value) => update(field.key, value)}
                placeholder="—"
                value={fields[field.key]}
              />
            </View>
          ))}
        </View>
        <View style={styles.divider} />
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
      </AppCard>
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
  dateCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  dateCopy: { flex: 1, gap: theme.spacing.xxs, minWidth: 0 },
  detailsCard: { gap: theme.spacing.lg },
  divider: {
    backgroundColor: theme.colors.border,
    height: theme.borders.hairline,
  },
  form: { gap: theme.spacing.lg },
  measurementField: { flexBasis: '47%', flexGrow: 1, minWidth: 140 },
  measurementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  metaIcon: {
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.md,
    height: theme.layout.compactTouchTarget,
    justifyContent: 'center',
    width: theme.layout.compactTouchTarget,
  },
  note: { minHeight: 84, textAlignVertical: 'top' },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  todayBadge: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
});

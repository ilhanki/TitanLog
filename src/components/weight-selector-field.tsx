import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
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
  onGestureActiveChange?: (active: boolean) => void;
  presentation?: 'field' | 'card';
  title: string;
  value: string;
};

export function resolveWeightSelectorValue(
  value: string,
  kind: WeightWheelKind,
  fallbackValue?: number
): number | null {
  const parsed =
    kind === 'body' ? parseBodyWeight(value) : parseWeightInput(value);
  return parsed ?? fallbackValue ?? (kind === 'exercise' ? 2.5 : null);
}

export function WeightSelectorField({
  accessibilityLabel,
  editable = true,
  error,
  fallbackValue,
  kind,
  label,
  onChangeText,
  onGestureActiveChange,
  presentation = 'field',
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
          onGestureActiveChange={onGestureActiveChange}
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

  const openWheel = () => {
    if (editable && wheelValue !== null) setVisible(true);
  };

  return (
    <>
      {presentation === 'card' && wheelValue !== null ? (
        <View style={styles.cardField}>
          <Pressable
            accessibilityHint="Tam ve ondalık kilo seçiciyi açar"
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityRole="button"
            accessibilityState={{ disabled: !editable }}
            accessibilityValue={{
              text: `${formatBodyValue(wheelValue)} kilogram`,
            }}
            disabled={!editable}
            onPress={openWheel}
            style={({ pressed }) => [
              styles.weightCard,
              pressed && styles.weightCardPressed,
              !editable && styles.weightCardDisabled,
              error && styles.weightCardError,
            ]}
          >
            <View style={styles.weightCardHeader}>
              <View style={styles.weightCardLabel}>
                <View style={styles.iconBadge}>
                  <AppIcon
                    color={theme.colors.primary}
                    name="scale-bathroom"
                    size={theme.iconSizes.md}
                  />
                </View>
                <View style={styles.copy}>
                  <AppText tone="muted" variant="caption">
                    {label}
                  </AppText>
                  <AppText tone="subtle" variant="caption">
                    Kaydırarak hassas değeri seç
                  </AppText>
                </View>
              </View>
              <AppIcon
                color={theme.colors.primary}
                name="chevron-right"
                size={theme.iconSizes.lg}
              />
            </View>
            <View style={styles.weightValueRow}>
              <AppText selectable style={styles.weightValue} variant="display">
                {formatBodyValue(wheelValue)}
              </AppText>
              <AppText tone="muted" variant="heading">
                kg
              </AppText>
            </View>
            <View style={styles.selectionHint}>
              <AppIcon
                color={theme.colors.primary}
                name="gesture-swipe-vertical"
                size={theme.iconSizes.sm}
              />
              <AppText tone="primary" variant="caption">
                Kilo çarkını aç
              </AppText>
            </View>
          </Pressable>
          {error ? (
            <AppText
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              selectable
              tone="danger"
              variant="caption"
            >
              {error}
            </AppText>
          ) : null}
        </View>
      ) : (
        <AppTextInput
          accessibilityLabel={accessibilityLabel}
          editable={editable}
          error={error}
          inputMode="decimal"
          keyboardType="decimal-pad"
          label={label}
          onChangeText={onChangeText}
          onFocus={openWheel}
          showSoftInputOnFocus={wheelValue === null}
          value={value}
        />
      )}
      {wheelValue !== null ? (
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
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  cardField: { gap: theme.spacing.sm },
  copy: { flex: 1, gap: theme.spacing.xxs },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.md,
    height: theme.layout.compactTouchTarget,
    justifyContent: 'center',
    width: theme.layout.compactTouchTarget,
  },
  inlineField: { gap: theme.spacing.xs },
  selectionHint: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.pill,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    minHeight: 32,
    paddingHorizontal: theme.spacing.md,
  },
  weightCard: {
    backgroundColor: theme.colors.surfaceRaised,
    borderColor: theme.colors.borderStrong,
    borderCurve: 'continuous',
    borderRadius: theme.radii.xl,
    borderWidth: theme.borders.thin,
    boxShadow: theme.shadows.raised,
    gap: theme.spacing.lg,
    minHeight: 176,
    padding: theme.spacing.xl,
  },
  weightCardDisabled: { opacity: 0.55 },
  weightCardError: { borderColor: theme.colors.danger },
  weightCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  weightCardLabel: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  weightCardPressed: {
    backgroundColor: theme.colors.surfacePressed,
    borderColor: theme.colors.primary,
  },
  weightValue: { fontVariant: ['tabular-nums'] },
  weightValueRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
});

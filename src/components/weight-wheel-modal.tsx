import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { AppTextInput } from '@/components/app-text-input';
import { WheelPicker } from '@/components/wheel-picker';
import { appStrings } from '@/constants/strings';
import {
  formatBodyValue,
  parseBodyWeight,
} from '@/features/body/utils/body-values';
import {
  formatWorkoutWeight,
  parseWeightInput,
} from '@/features/workouts/utils/workout-values';
import { theme } from '@/theme/tokens';

export type WeightWheelKind = 'body' | 'exercise';

const BODY_WHOLE_OPTIONS = Array.from(
  { length: 381 },
  (_, index) => index + 20
);
const DECIMAL_OPTIONS = Array.from({ length: 10 }, (_, index) => index);
const EXERCISE_OPTIONS = Array.from({ length: 800 }, (_, index) =>
  Number(((index + 1) * 2.5).toFixed(2))
);

export function createExerciseWeightOptions(value: number): number[] {
  return [...new Set([...EXERCISE_OPTIONS, value])].sort(
    (left, right) => left - right
  );
}

export function combineBodyWeight(whole: number, decimal: number): number {
  return Number((whole + decimal / 10).toFixed(1));
}

type WeightWheelModalProps = {
  accessibilityLabel: string;
  context?: string;
  kind: WeightWheelKind;
  onApply: (value: number) => void;
  onCancel: () => void;
  title: string;
  value: number;
  visible: boolean;
};

export function WeightWheelModal({
  accessibilityLabel,
  context,
  kind,
  onApply,
  onCancel,
  title,
  value,
  visible,
}: WeightWheelModalProps) {
  if (!visible) return null;

  return (
    <VisibleWeightWheelModal
      accessibilityLabel={accessibilityLabel}
      context={context}
      kind={kind}
      onApply={onApply}
      onCancel={onCancel}
      title={title}
      value={value}
    />
  );
}

type VisibleWeightWheelModalProps = Omit<WeightWheelModalProps, 'visible'>;

function VisibleWeightWheelModal({
  accessibilityLabel,
  context,
  kind,
  onApply,
  onCancel,
  title,
  value,
}: VisibleWeightWheelModalProps) {
  const [draft, setDraft] = useState(value);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const exerciseOptions = useMemo(
    () => createExerciseWeightOptions(value),
    [value]
  );

  const [manualValue, setManualValue] = useState(() =>
    kind === 'body' ? formatBodyValue(value) : formatWorkoutWeight(value)
  );

  const apply = () => {
    if (manual) {
      const parsed =
        kind === 'body'
          ? parseBodyWeight(manualValue)
          : parseWeightInput(manualValue);
      if (parsed === null) {
        setError(
          kind === 'body'
            ? appStrings.progress.invalidWeight
            : appStrings.workout.invalidWeight
        );
        return;
      }
      onApply(parsed);
      return;
    }
    onApply(draft);
  };

  const whole = Math.floor(draft);
  const decimal = Math.round((draft - whole) * 10);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
      testID="weight-wheel-modal"
      transparent
      visible
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.overlay}>
        <Pressable
          accessibilityLabel={appStrings.common.cancel}
          onPress={onCancel}
          style={styles.scrim}
        />
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
          style={styles.modalPosition}
        >
          <View accessibilityLabel={accessibilityLabel} style={styles.surface}>
            <View style={styles.header}>
              <AppText accessibilityRole="header" variant="heading">
                {title}
              </AppText>
              <AppText selectable tone="muted" variant="caption">
                {appStrings.common.wheelHint}
              </AppText>
              {context ? (
                <AppText selectable tone="primary" variant="caption">
                  {context}
                </AppText>
              ) : null}
            </View>
            {manual ? (
              <AppTextInput
                autoFocus
                error={error}
                inputMode="decimal"
                keyboardType="decimal-pad"
                label={appStrings.common.manualEntry}
                onChangeText={setManualValue}
                value={manualValue}
              />
            ) : kind === 'body' ? (
              <View style={styles.bodyWheels}>
                <WheelPicker
                  accessibilityLabel={`${title} tam kilogram`}
                  formatValue={String}
                  onChange={(nextWhole) =>
                    setDraft(combineBodyWeight(nextWhole, decimal))
                  }
                  options={BODY_WHOLE_OPTIONS}
                  unit="kilogram"
                  value={whole}
                />
                <AppText style={styles.separator} variant="metric">
                  ,
                </AppText>
                <WheelPicker
                  accessibilityLabel={`${title} ondalık`}
                  formatValue={String}
                  onChange={(nextDecimal) =>
                    setDraft(combineBodyWeight(whole, nextDecimal))
                  }
                  options={DECIMAL_OPTIONS}
                  unit="ondalık"
                  value={decimal}
                />
                <AppText tone="muted" variant="bodyStrong">
                  kg
                </AppText>
              </View>
            ) : (
              <View style={styles.exerciseWheel}>
                <WheelPicker
                  accessibilityLabel={title}
                  formatValue={formatWorkoutWeight}
                  onChange={setDraft}
                  options={exerciseOptions}
                  unit="kilogram"
                  value={draft}
                />
                <AppText tone="muted" variant="bodyStrong">
                  kg
                </AppText>
              </View>
            )}
            <AppButton
              label={
                manual
                  ? appStrings.common.useWheel
                  : appStrings.common.manualEntry
              }
              onPress={() => {
                setError(undefined);
                setManual((current) => !current);
              }}
              variant="ghost"
            />
            <View style={styles.actions}>
              <AppButton
                label={appStrings.common.cancel}
                onPress={onCancel}
                style={styles.action}
                variant="secondary"
              />
              <AppButton
                label={appStrings.common.apply}
                onPress={apply}
                style={styles.action}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  action: { flex: 1 },
  actions: { flexDirection: 'row', gap: theme.spacing.md },
  bodyWheels: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  exerciseWheel: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  header: { gap: theme.spacing.xs },
  modalPosition: { flex: 1, justifyContent: 'flex-end' },
  overlay: { backgroundColor: theme.colors.overlay, flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject },
  separator: { color: theme.colors.primary },
  surface: {
    backgroundColor: theme.colors.surfaceRaised,
    borderColor: theme.colors.borderStrong,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    borderWidth: theme.borders.thin,
    gap: theme.spacing.lg,
    padding: theme.spacing.xxl,
  },
});

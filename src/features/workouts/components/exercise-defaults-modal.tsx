import { Keyboard, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import {
  ExerciseDefaultsForm,
  type ExerciseDefaultsFormValues,
} from '@/features/workouts/components/exercise-defaults-form';
import type { WorkoutExercise } from '@/features/workouts/domain/models';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

type DefaultsErrors = Partial<
  Record<'setCount' | 'targetReps' | 'weight', string>
>;

type ExerciseDefaultsModalProps = {
  errors: DefaultsErrors;
  exercise: WorkoutExercise | null;
  onChange: (values: ExerciseDefaultsFormValues) => void;
  onClose: () => void;
  onSave: () => void;
  saveError?: string | null;
  saving: boolean;
  values: ExerciseDefaultsFormValues | null;
  visible: boolean;
};

export function ExerciseDefaultsModal({
  errors,
  exercise,
  onChange,
  onClose,
  onSave,
  saveError,
  saving,
  values,
  visible,
}: ExerciseDefaultsModalProps) {
  const [numericGestureActive, setNumericGestureActive] = useState(false);

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={close}
      transparent
      visible={visible}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.overlay}>
        <View
          accessibilityViewIsModal
          style={styles.modal}
          testID="exercise-defaults-modal"
        >
          <View style={styles.header}>
            <AppText accessibilityRole="header" variant="heading">
              {exercise?.name} Varsayılanları
            </AppText>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!numericGestureActive}
          >
            {exercise && values ? (
              <ExerciseDefaultsForm
                errors={errors}
                exerciseName={exercise.name}
                onChange={onChange}
                onGestureActiveChange={setNumericGestureActive}
                values={values}
              />
            ) : null}
            {saveError ? (
              <AppText
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                selectable
                tone="danger"
              >
                {saveError}
              </AppText>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <AppButton
              disabled={saving}
              label="Kapat"
              onPress={close}
              style={styles.footerAction}
              variant="ghost"
            />
            <AppButton
              disabled={saving}
              label={saving ? appStrings.workout.saving : 'Kaydet'}
              onPress={() => {
                Keyboard.dismiss();
                onSave();
              }}
              style={styles.footerAction}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing.md, padding: theme.spacing.md },
  footer: {
    borderTopColor: workoutTheme.separator,
    borderTopWidth: theme.borders.hairline,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  footerAction: { flex: 1 },
  header: {
    borderBottomColor: workoutTheme.separator,
    borderBottomWidth: theme.borders.hairline,
    padding: theme.spacing.md,
  },
  modal: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.lg,
    borderWidth: theme.borders.thin,
    maxWidth: 520,
    overflow: 'hidden',
    width: '94%',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: theme.colors.overlay,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
});

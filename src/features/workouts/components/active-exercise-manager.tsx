import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import type {
  AvailableExercise,
  WorkoutSessionExercise,
} from '@/features/workouts/domain/models';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

type ActiveExerciseManagerProps = {
  exercises: readonly AvailableExercise[];
  onClose: () => void;
  onSelect: (exerciseId: number) => void;
  pending?: boolean;
  replaceTarget: WorkoutSessionExercise | null;
  visible: boolean;
};

export function ActiveExerciseManager({
  exercises,
  onClose,
  onSelect,
  pending,
  replaceTarget,
  visible,
}: ActiveExerciseManagerProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.copy}>
              <AppText accessibilityRole="header" variant="heading">
                {replaceTarget ? 'Hareketi değiştir' : 'Hareket ekle'}
              </AppText>
              <AppText selectable tone="muted" variant="caption">
                {replaceTarget
                  ? `${replaceTarget.name} yerine bir hareket seç.`
                  : 'Bu değişiklik yalnızca aktif antrenmanı etkiler.'}
              </AppText>
            </View>
            <AppButton label="Kapat" onPress={onClose} variant="ghost" />
          </View>
          <ScrollView
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
          >
            {exercises.length === 0 ? (
              <AppText selectable tone="muted">
                Eklenebilecek başka hareket bulunamadı.
              </AppText>
            ) : null}
            {exercises.map((exercise) => (
              <Pressable
                accessibilityLabel={`${exercise.name} hareketini ${replaceTarget ? 'seç' : 'ekle'}`}
                accessibilityRole="button"
                disabled={pending}
                key={exercise.id}
                onPress={() => onSelect(exercise.id)}
                style={({ pressed }) => [
                  styles.exercise,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.copy}>
                  <AppText variant="bodyStrong">{exercise.name}</AppText>
                  <AppText tone="muted" variant="caption">
                    {[exercise.muscleGroup, exercise.equipment]
                      .filter(Boolean)
                      .join(' · ')}
                  </AppText>
                </View>
                <AppText tone="primary" variant="button">
                  {replaceTarget ? 'Seç' : 'Ekle'}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: theme.spacing.xs },
  exercise: {
    alignItems: 'center',
    borderBottomColor: workoutTheme.separator,
    borderBottomWidth: theme.borders.hairline,
    flexDirection: 'row',
    gap: theme.spacing.md,
    minHeight: theme.layout.touchTarget,
    paddingVertical: theme.spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  list: { gap: theme.spacing.xs, padding: theme.spacing.md },
  modal: {
    backgroundColor: workoutTheme.surface,
    borderRadius: theme.radii.lg,
    maxHeight: '88%',
    width: '94%',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: theme.colors.overlay,
    flex: 1,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72 },
});

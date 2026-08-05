import { useEffect, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import type { WorkoutExercise } from '@/features/workouts/domain/models';
import { formatWorkoutWeight } from '@/features/workouts/utils/workout-values';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

export const PROGRAM_EXERCISE_PANEL_HEIGHT = 176;
export const PROGRAM_EXERCISE_PANEL_GAP = theme.spacing.sm;
export const PROGRAM_REORDER_LONG_PRESS_DELAY = 260;

export function getProgramExerciseDropIndex(
  initialIndex: number,
  distanceY: number,
  exerciseCount: number
): number {
  if (exerciseCount <= 0) return 0;
  const rowPitch = PROGRAM_EXERCISE_PANEL_HEIGHT + PROGRAM_EXERCISE_PANEL_GAP;
  return Math.max(
    0,
    Math.min(exerciseCount - 1, initialIndex + Math.round(distanceY / rowPitch))
  );
}

type ProgramExercisePanelProps = {
  disabled?: boolean;
  dragging?: boolean;
  exercise: WorkoutExercise;
  index: number;
  onAccessibleMove: (direction: 'up' | 'down') => void;
  onDragCancel: () => void;
  onDragEnd: (distanceY: number) => void;
  onDragMove: (distanceY: number) => void;
  onDragStart: () => void;
  onEditDefaults: () => void;
  onDissolveSuperset?: () => void;
  onOpenHistory: () => void;
  onRemove: () => void;
  onRemoveFromSuperset?: () => void;
  onSupersetToggle?: () => void;
  supersetSelected?: boolean;
  placeholder?: boolean;
  totalCount: number;
};

type CompactActionProps = {
  accessibilityLabel: string;
  danger?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

function CompactAction({
  accessibilityLabel,
  danger = false,
  disabled,
  label,
  onPress,
}: CompactActionProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <AppText
        style={danger ? styles.dangerActionText : styles.actionText}
        variant="button"
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function ProgramExercisePanel({
  disabled = false,
  dragging = false,
  exercise,
  index,
  onAccessibleMove,
  onDragCancel,
  onDragEnd,
  onDragMove,
  onDragStart,
  onEditDefaults,
  onDissolveSuperset,
  onOpenHistory,
  onRemove,
  onRemoveFromSuperset,
  onSupersetToggle,
  placeholder = false,
  totalCount,
  supersetSelected = false,
}: ProgramExercisePanelProps) {
  const disabledRef = useRef(disabled);
  const dragActiveRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacksRef = useRef({
    onDragCancel,
    onDragEnd,
    onDragMove,
    onDragStart,
  });
  disabledRef.current = disabled;
  callbacksRef.current = {
    onDragCancel,
    onDragEnd,
    onDragMove,
    onDragStart,
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const cancelDrag = () => {
    clearLongPress();
    if (!dragActiveRef.current) return;
    dragActiveRef.current = false;
    callbacksRef.current.onDragCancel();
  };

  useEffect(
    () => () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      if (!dragActiveRef.current) return;
      dragActiveRef.current = false;
      callbacksRef.current.onDragCancel();
    },
    []
  );

  const panResponderRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: () => {
        clearLongPress();
        longPressTimerRef.current = setTimeout(() => {
          if (disabledRef.current) return;
          dragActiveRef.current = true;
          callbacksRef.current.onDragStart();
        }, PROGRAM_REORDER_LONG_PRESS_DELAY);
      },
      onPanResponderMove: (_, gesture) => {
        if (dragActiveRef.current) callbacksRef.current.onDragMove(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        clearLongPress();
        if (!dragActiveRef.current) return;
        dragActiveRef.current = false;
        callbacksRef.current.onDragEnd(gesture.dy);
      },
      onPanResponderTerminate: cancelDrag,
      onPanResponderTerminationRequest: () => !dragActiveRef.current,
      onShouldBlockNativeResponder: () => dragActiveRef.current,
    })
  );

  const metadata = [exercise.muscleGroup, exercise.equipment]
    .filter(Boolean)
    .join(' · ');
  const moveActions = [
    ...(index > 0
      ? [{ label: appStrings.workout.moveUp, name: 'moveUp' as const }]
      : []),
    ...(index < totalCount - 1
      ? [{ label: appStrings.workout.moveDown, name: 'moveDown' as const }]
      : []),
  ];

  return (
    <View
      accessibilityLabel={`${index + 1}. ${exercise.name}, ${exercise.setCount} set, ${exercise.targetReps} tekrar, ${formatWorkoutWeight(exercise.weightKg)} kilogram`}
      style={[
        styles.panel,
        dragging && styles.panelDragging,
        placeholder && styles.panelPlaceholder,
      ]}
      testID={`program-exercise-panel-${exercise.id}`}
    >
      <View style={styles.headerRow}>
        <View style={styles.identity}>
          <AppText
            accessibilityLabel={exercise.name}
            numberOfLines={1}
            variant="bodyStrong"
          >
            {exercise.name}
          </AppText>
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {exercise.setCount} set · {exercise.targetReps} tekrar ·{' '}
            {formatWorkoutWeight(exercise.weightKg)} kg
            {exercise.weightMode === 'per_hand' ? ' · Her el' : ''}
          </AppText>
          {metadata ? (
            <AppText numberOfLines={1} tone="subtle" variant="caption">
              {metadata}
            </AppText>
          ) : null}
          {exercise.supersetGroupId ? (
            <AppText
              accessibilityLabel="Superset grubu"
              tone="primary"
              variant="caption"
            >
              Superset · sıra {(exercise.supersetOrder ?? 0) + 1}
            </AppText>
          ) : null}
        </View>
        <View
          {...panResponderRef.current.panHandlers}
          accessibilityActions={moveActions}
          accessibilityHint="Basılı tutup sürükleyerek sırala."
          accessibilityLabel={`${exercise.name} sıralama tutamacı`}
          accessibilityRole="adjustable"
          accessibilityState={{ disabled }}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'moveUp')
              onAccessibleMove('up');
            if (event.nativeEvent.actionName === 'moveDown')
              onAccessibleMove('down');
          }}
          style={styles.handle}
          testID={`program-exercise-drag-handle-${exercise.id}`}
        >
          <AppIcon
            color={dragging ? theme.colors.primary : theme.colors.textMuted}
            name="drag-vertical"
          />
        </View>
      </View>

      <CompactAction
        accessibilityLabel={`${exercise.name} geçmişini aç`}
        disabled={disabled}
        label="Geçmiş"
        onPress={onOpenHistory}
      />

      <View style={styles.footerActions}>
        {exercise.supersetGroupId && onRemoveFromSuperset ? (
          <CompactAction
            accessibilityLabel={`${exercise.name} hareketini superset grubundan çıkar`}
            disabled={disabled}
            label="Gruptan çıkar"
            onPress={onRemoveFromSuperset}
          />
        ) : null}
        {exercise.supersetGroupId && onDissolveSuperset ? (
          <CompactAction
            accessibilityLabel={`${exercise.name} superset grubunu çöz`}
            disabled={disabled}
            label="Grubu çöz"
            onPress={onDissolveSuperset}
          />
        ) : null}
        {onSupersetToggle ? (
          <CompactAction
            accessibilityLabel={`${exercise.name} superset seçimi${supersetSelected ? ' kaldır' : ' ekle'}`}
            disabled={disabled}
            label={supersetSelected ? 'Seçildi' : 'Superset'}
            onPress={onSupersetToggle}
          />
        ) : null}
        <CompactAction
          accessibilityLabel={`${exercise.name} varsayılanlarını düzenle`}
          disabled={disabled}
          label="Varsayılanlar"
          onPress={onEditDefaults}
        />
        <CompactAction
          accessibilityLabel={`${exercise.name} hareketini program gününden kaldır`}
          danger
          disabled={disabled}
          label="Kaldır"
          onPress={onRemove}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderRadius: theme.radii.sm,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.layout.compactTouchTarget,
    paddingHorizontal: theme.spacing.sm,
  },
  actionText: { color: theme.colors.primary },
  dangerActionText: { color: theme.colors.danger },
  disabled: { opacity: 0.56 },
  footerActions: {
    borderTopColor: workoutTheme.separator,
    borderTopWidth: theme.borders.hairline,
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  handle: {
    alignItems: 'center',
    height: theme.layout.compactTouchTarget,
    justifyContent: 'center',
    width: theme.layout.compactTouchTarget,
  },
  headerRow: { flexDirection: 'row', gap: theme.spacing.sm },
  identity: { flex: 1, gap: theme.spacing.xxs, minWidth: 0 },
  panel: {
    backgroundColor: workoutTheme.surface,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    gap: theme.spacing.xxs,
    height: PROGRAM_EXERCISE_PANEL_HEIGHT,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  panelDragging: {
    borderColor: theme.colors.primary,
    boxShadow: theme.shadows.raised,
    transform: [{ scale: 1.01 }],
  },
  panelPlaceholder: { opacity: 0 },
  pressed: { backgroundColor: theme.colors.surfacePressed },
});

import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import type { WorkoutSetType } from '@/features/workouts/domain/models';
import {
  SET_TYPE_LABELS,
  WORKOUT_SET_TYPES,
} from '@/features/workouts/domain/set-policy';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

type SetTypeSelectorProps = {
  disabled?: boolean;
  onChange: (type: WorkoutSetType) => void;
  value: WorkoutSetType;
};

export function SetTypeSelector({
  disabled,
  onChange,
  value,
}: SetTypeSelectorProps) {
  return (
    <View accessibilityLabel="Set türü" style={styles.row}>
      {WORKOUT_SET_TYPES.map((type) => {
        const selected = type === value;
        return (
          <Pressable
            accessibilityLabel={`Set türü: ${SET_TYPE_LABELS[type]}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            key={type}
            onPress={() => onChange(type)}
            style={[styles.option, selected && styles.selected]}
          >
            <AppText
              numberOfLines={1}
              tone={selected ? 'primary' : 'muted'}
              variant="caption"
            >
              {SET_TYPE_LABELS[type]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    alignItems: 'center',
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.pill,
    borderWidth: theme.borders.thin,
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: theme.layout.compactTouchTarget,
    paddingHorizontal: theme.spacing.xs,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  selected: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
});

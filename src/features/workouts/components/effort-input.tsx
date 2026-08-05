import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { AppTextInput } from '@/components/app-text-input';
import type { WorkoutEffortMode } from '@/features/workouts/domain/models';
import { theme } from '@/theme/tokens';

type EffortInputProps = {
  disabled?: boolean;
  mode: WorkoutEffortMode;
  onModeChange: (mode: WorkoutEffortMode) => void;
  onValueChange: (value: string) => void;
  value: string;
};

const modes: readonly { label: string; value: WorkoutEffortMode }[] = [
  { label: 'Kapalı', value: 'off' },
  { label: 'RPE', value: 'rpe' },
  { label: 'RIR', value: 'rir' },
];

export function EffortInput({
  disabled,
  mode,
  onModeChange,
  onValueChange,
  value,
}: EffortInputProps) {
  return (
    <View style={styles.container}>
      <View accessibilityLabel="Efor takibi" style={styles.modes}>
        {modes.map((option) => (
          <Pressable
            accessibilityLabel={`Efor modu: ${option.label}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: mode === option.value, disabled }}
            disabled={disabled}
            key={option.value}
            onPress={() => onModeChange(option.value)}
            style={[styles.mode, mode === option.value && styles.selected]}
          >
            <AppText variant="caption">{option.label}</AppText>
          </Pressable>
        ))}
      </View>
      {mode !== 'off' ? (
        <AppTextInput
          accessibilityLabel={`${mode.toUpperCase()} değeri`}
          editable={!disabled}
          inputMode="decimal"
          keyboardType="decimal-pad"
          label={mode.toUpperCase()}
          onChangeText={onValueChange}
          placeholder={mode === 'rpe' ? '1–10' : '0–10'}
          value={value}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm },
  mode: {
    alignItems: 'center',
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: theme.borders.thin,
    justifyContent: 'center',
    minHeight: theme.layout.compactTouchTarget,
    minWidth: 72,
    paddingHorizontal: theme.spacing.sm,
  },
  modes: { flexDirection: 'row', gap: theme.spacing.xs },
  selected: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
});

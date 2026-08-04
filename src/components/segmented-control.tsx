import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { theme } from '@/theme/tokens';

type Segment<T extends string> = { label: string; value: T };

export function SegmentedControl<T extends string>({
  accessibilityLabel,
  onChange,
  options,
  value,
}: {
  accessibilityLabel: string;
  onChange: (value: T) => void;
  options: readonly Segment<T>[];
  value: T;
}) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      style={styles.container}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.selected]}
          >
            <AppText tone={selected ? 'default' : 'muted'} variant="bodyStrong">
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    flexDirection: 'row',
    padding: theme.spacing.xs,
  },
  option: {
    alignItems: 'center',
    borderRadius: theme.radii.sm,
    flex: 1,
    minHeight: theme.layout.compactTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  selected: { backgroundColor: theme.colors.surfaceInteractive },
});

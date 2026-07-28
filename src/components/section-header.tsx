import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { theme } from '@/theme/tokens';

type SectionHeaderProps = {
  actionLabel?: string;
  onActionPress?: () => void;
  title: string;
};

export function SectionHeader({
  actionLabel,
  onActionPress,
  title,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <AppText accessibilityRole="header" variant="heading">
        {title}
      </AppText>
      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          hitSlop={theme.spacing.sm}
          onPress={onActionPress}
        >
          <AppText tone="primary" variant="caption">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : actionLabel ? (
        <AppText tone="primary" variant="caption">
          {actionLabel}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
});

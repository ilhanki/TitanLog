import { StyleSheet, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/app-icon';
import { theme } from '@/theme/tokens';

type TabBarIconProps = {
  color: string;
  focused: boolean;
  name: AppIconName;
  size: number;
};

export function TabBarIcon({ color, focused, name, size }: TabBarIconProps) {
  return (
    <View style={[styles.container, focused && styles.focused]}>
      <AppIcon
        color={color}
        name={name}
        size={Math.min(size, theme.iconSizes.lg)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderRadius: theme.radii.pill,
    height: theme.spacing.xxxl,
    justifyContent: 'center',
    width: theme.spacing.giant,
  },
  focused: {
    backgroundColor: theme.colors.primarySoft,
  },
});

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import { theme } from '@/theme/tokens';

export type AppIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type AppIconProps = {
  color?: string;
  name: AppIconName;
  size?: number;
};

export function AppIcon({
  color = theme.colors.textMuted,
  name,
  size = theme.iconSizes.md,
}: AppIconProps) {
  return (
    <MaterialCommunityIcons
      accessibilityElementsHidden
      color={color}
      importantForAccessibility="no-hide-descendants"
      name={name}
      size={size}
    />
  );
}

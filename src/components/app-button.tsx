import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppIcon, type AppIconName } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { theme } from '@/theme/tokens';

type AppButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  icon?: AppIconName;
  label: string;
  style?: StyleProp<ViewStyle>;
  variant?: 'primary' | 'secondary' | 'ghost';
};

export function AppButton({
  accessibilityLabel,
  disabled,
  icon,
  label,
  style,
  variant = 'primary',
  ...props
}: AppButtonProps) {
  const iconColor =
    variant === 'primary' ? theme.colors.accentOnColor : theme.colors.primary;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={theme.spacing.xs}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {icon ? (
        <AppIcon color={iconColor} name={icon} size={theme.iconSizes.sm} />
      ) : null}
      <AppText
        selectable={false}
        style={
          variant === 'primary' ? styles.primaryText : styles.secondaryText
        }
        variant="button"
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'center',
    minHeight: theme.layout.touchTarget,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  primary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  secondary: {
    backgroundColor: theme.colors.surfaceInteractive,
    borderColor: theme.colors.borderStrong,
  },
  ghost: {
    backgroundColor: theme.colors.transparent,
    borderColor: theme.colors.border,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    opacity: 0.72,
  },
  primaryText: {
    color: theme.colors.accentOnColor,
  },
  secondaryText: {
    color: theme.colors.primary,
  },
});

import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/app-text';
import { theme } from '@/theme/tokens';

type AppTextInputProps = TextInputProps & {
  error?: string;
  label: string;
};

export function AppTextInput({
  accessibilityLabel,
  editable = true,
  error,
  label,
  onBlur,
  onFocus,
  style,
  ...props
}: AppTextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.container}>
      <AppText variant="bodyStrong">{label}</AppText>
      <TextInput
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={error}
        accessibilityState={{ disabled: !editable }}
        editable={editable}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        placeholderTextColor={theme.colors.textSubtle}
        selectionColor={theme.colors.primary}
        style={[
          styles.input,
          focused && styles.inputFocused,
          !editable && styles.inputDisabled,
          error && styles.inputError,
          style,
        ]}
        {...props}
      />
      {error ? (
        <AppText
          accessibilityLiveRegion="polite"
          selectable
          tone="danger"
          variant="caption"
        >
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderStrong,
    borderCurve: 'continuous',
    borderRadius: theme.radii.md,
    borderWidth: theme.borders.thin,
    color: theme.colors.text,
    fontSize: theme.typography.size.bodyLarge,
    minHeight: 54,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  inputDisabled: {
    backgroundColor: theme.colors.surfaceMuted,
    color: theme.colors.textDisabled,
  },
  inputFocused: {
    borderColor: theme.colors.primary,
    borderWidth: theme.borders.strong,
  },
});

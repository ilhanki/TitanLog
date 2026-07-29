import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { theme } from '@/theme/tokens';

type TextVariant =
  | 'brand'
  | 'caption'
  | 'display'
  | 'heading'
  | 'label'
  | 'metric'
  | 'title'
  | 'body'
  | 'bodyStrong'
  | 'button';

type TextTone =
  'default' | 'muted' | 'subtle' | 'primary' | 'success' | 'danger';

export type AppTextProps = TextProps & {
  tone?: TextTone;
  variant?: TextVariant;
};

const toneStyles: Record<TextTone, TextStyle> = {
  default: { color: theme.colors.text },
  muted: { color: theme.colors.textMuted },
  subtle: { color: theme.colors.textSubtle },
  primary: { color: theme.colors.primary },
  success: { color: theme.colors.success },
  danger: { color: theme.colors.danger },
};

export function AppText({
  style,
  tone = 'default',
  variant = 'body',
  ...props
}: AppTextProps) {
  return <Text style={[styles[variant], toneStyles[tone], style]} {...props} />;
}

const styles = StyleSheet.create({
  brand: {
    fontSize: theme.typography.size.brand,
    fontWeight: theme.typography.weight.black,
    letterSpacing: theme.typography.letterSpacing.brand,
    lineHeight: theme.typography.lineHeight.brand,
  },
  caption: {
    fontSize: theme.typography.size.caption,
    fontWeight: theme.typography.weight.medium,
    lineHeight: theme.typography.lineHeight.caption,
  },
  display: {
    fontSize: theme.typography.size.display,
    fontWeight: theme.typography.weight.bold,
    lineHeight: theme.typography.lineHeight.display,
  },
  heading: {
    fontSize: theme.typography.size.heading,
    fontWeight: theme.typography.weight.bold,
    lineHeight: theme.typography.lineHeight.heading,
  },
  label: {
    fontSize: theme.typography.size.label,
    fontWeight: theme.typography.weight.bold,
    letterSpacing: theme.typography.letterSpacing.label,
    lineHeight: theme.typography.lineHeight.label,
    textTransform: 'uppercase',
  },
  metric: {
    fontSize: theme.typography.size.metric,
    fontVariant: ['tabular-nums'],
    fontWeight: theme.typography.weight.black,
    letterSpacing: theme.typography.letterSpacing.metric,
    lineHeight: theme.typography.lineHeight.metric,
  },
  title: {
    fontSize: theme.typography.size.title,
    fontWeight: theme.typography.weight.bold,
    lineHeight: theme.typography.lineHeight.title,
  },
  body: {
    fontSize: theme.typography.size.body,
    fontWeight: theme.typography.weight.regular,
    lineHeight: theme.typography.lineHeight.body,
  },
  bodyStrong: {
    fontSize: theme.typography.size.body,
    fontWeight: theme.typography.weight.semibold,
    lineHeight: theme.typography.lineHeight.body,
  },
  button: {
    fontSize: theme.typography.size.body,
    fontWeight: theme.typography.weight.bold,
    lineHeight: theme.typography.lineHeight.body,
  },
});

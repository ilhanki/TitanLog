import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appStrings } from '@/constants/strings';
import { theme } from '@/theme/tokens';

export function FoundationScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark} />
          <Text style={styles.brand}>{appStrings.brandName}</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.eyebrow}>{appStrings.foundation.eyebrow}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {appStrings.foundation.title}
          </Text>
          <Text style={styles.description}>
            {appStrings.foundation.description}
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.status}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {appStrings.foundation.status}
            </Text>
          </View>
          <Text style={styles.slogan}>{appStrings.slogan}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  brandMark: {
    width: theme.spacing.sm,
    height: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.sm,
  },
  brand: {
    color: theme.colors.text,
    fontSize: theme.typography.size.brand,
    fontWeight: theme.typography.weight.black,
    letterSpacing: theme.typography.letterSpacing.brand,
    lineHeight: theme.typography.lineHeight.brand,
  },
  content: {
    gap: theme.spacing.md,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primaryMuted,
    borderRadius: theme.radii.pill,
    color: theme.colors.primary,
    fontSize: theme.typography.size.caption,
    fontWeight: theme.typography.weight.bold,
    letterSpacing: theme.typography.letterSpacing.label,
    lineHeight: theme.typography.lineHeight.caption,
    overflow: 'hidden',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.size.heading,
    fontWeight: theme.typography.weight.black,
    lineHeight: theme.typography.lineHeight.heading,
  },
  description: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.body,
    fontWeight: theme.typography.weight.medium,
    lineHeight: theme.typography.lineHeight.body,
    maxWidth: 420,
  },
  footer: {
    borderTopColor: theme.colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  status: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statusDot: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.pill,
  },
  statusText: {
    color: theme.colors.text,
    fontSize: theme.typography.size.caption,
    fontWeight: theme.typography.weight.semibold,
    lineHeight: theme.typography.lineHeight.caption,
  },
  slogan: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.size.caption,
    fontWeight: theme.typography.weight.medium,
    lineHeight: theme.typography.lineHeight.caption,
  },
});

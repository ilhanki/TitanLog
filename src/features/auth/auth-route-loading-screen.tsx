import { StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { theme } from '@/theme/tokens';

export function AuthRouteLoadingScreen() {
  return (
    <View accessibilityRole="summary" style={styles.container}>
      <AppIcon
        color={theme.colors.primary}
        name="account-clock-outline"
        size={theme.iconSizes.hero}
      />
      <AppText accessibilityRole="header" variant="title">
        Oturum hazırlanıyor…
      </AppText>
      <AppText selectable style={styles.centered} tone="muted">
        Güvenli oturum durumu tamamlanana kadar uygulama rotaları bekletiliyor.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { maxWidth: 360, textAlign: 'center' },
  container: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing.lg,
    justifyContent: 'center',
    padding: theme.spacing.xxl,
  },
});

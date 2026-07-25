import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { theme } from '@/theme/tokens';

type AuthLinkProps = {
  href: Href;
  label: string;
};

export function AuthLink({ href, label }: AuthLinkProps) {
  return (
    <Link asChild href={href}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="link"
        hitSlop={theme.spacing.sm}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      >
        <AppText
          selectable={false}
          style={styles.text}
          tone="primary"
          variant="bodyStrong"
        >
          {label}
        </AppText>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  link: {
    alignItems: 'center',
    minHeight: theme.layout.touchTarget,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  text: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});

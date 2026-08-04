import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { AppText } from '@/components/app-text';
import { theme } from '@/theme/tokens';

export function ProfileAvatar({
  name,
  size = 72,
  uri,
}: {
  name: string;
  size?: number;
  uri: string | null;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr-TR'))
    .join('');
  const frame = { borderRadius: size / 2, height: size, width: size };
  return uri && !failed ? (
    <Image
      accessibilityLabel={`${name} profil fotoğrafı`}
      contentFit="cover"
      onError={() => setFailed(true)}
      source={{ uri }}
      style={[styles.image, frame]}
      transition={160}
    />
  ) : (
    <View
      accessibilityLabel={`${name} profil simgesi`}
      style={[styles.fallback, frame]}
    >
      {initials ? (
        <AppText style={styles.initials} variant="heading">
          {initials}
        </AppText>
      ) : (
        <AppIcon
          color={theme.colors.primary}
          name="account-outline"
          size={theme.iconSizes.xl}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
    borderWidth: theme.borders.thin,
    justifyContent: 'center',
  },
  image: { backgroundColor: theme.colors.surfaceRaised },
  initials: { color: theme.colors.primary },
});

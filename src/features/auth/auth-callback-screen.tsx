import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { completeAuthCallback } from '@/features/auth/auth-service';

export function AuthCallbackScreen() {
  const router = useRouter();
  const callbackUrl = Linking.useLinkingURL();
  const handledUrl = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!callbackUrl || handledUrl.current === callbackUrl) return;
    handledUrl.current = callbackUrl;
    setFailed(false);
    void completeAuthCallback(callbackUrl)
      .then(() => router.replace('/(tabs)/profile'))
      .catch(() => setFailed(true));
  }, [callbackUrl, router]);

  return (
    <Screen edges={['top', 'bottom']}>
      <AppText accessibilityRole="header" variant="title">
        E-posta Doğrulama
      </AppText>
      <AppCard tone="raised">
        <AppText selectable tone={failed ? 'danger' : 'muted'}>
          {failed
            ? 'Doğrulama bağlantısı geçersiz veya süresi dolmuş olabilir.'
            : callbackUrl
              ? 'Hesabın güvenli biçimde doğrulanıyor…'
              : 'Doğrulama bağlantısı bulunamadı.'}
        </AppText>
        {failed || !callbackUrl ? (
          <AppButton
            label="Giriş Ekranına Dön"
            onPress={() => router.replace('/auth/sign-in')}
            variant="secondary"
          />
        ) : null}
      </AppCard>
    </Screen>
  );
}

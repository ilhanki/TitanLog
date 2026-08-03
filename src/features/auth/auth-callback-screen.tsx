import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import {
  processAuthCallbackOnce,
  type AuthCallbackResult,
} from '@/features/auth/auth-callback-coordinator';
import {
  clearPostAuthDestination,
  requestPostAuthDestination,
} from '@/features/auth/auth-navigation-state';
import { completeAuthCallback } from '@/features/auth/auth-service';

export function AuthCallbackScreen() {
  const router = useRouter();
  const callbackUrl = Linking.useLinkingURL();
  const [result, setResult] = useState<AuthCallbackResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!callbackUrl) return;
    let active = true;
    setResult(null);
    setFailed(false);
    requestPostAuthDestination('profile');
    void processAuthCallbackOnce('email_verification', callbackUrl, () =>
      completeAuthCallback(callbackUrl)
    )
      .then((nextResult) => {
        if (!active) return;
        if (nextResult.duplicate) clearPostAuthDestination();
        setResult(nextResult);
      })
      .catch(() => {
        if (active) {
          clearPostAuthDestination();
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [callbackUrl]);

  const message = failed
    ? 'Doğrulama bağlantısı geçersiz veya süresi dolmuş olabilir.'
    : !callbackUrl
      ? 'Doğrulama bağlantısı bulunamadı.'
      : !result
        ? 'Hesabın güvenli biçimde doğrulanıyor…'
        : result.duplicate
          ? 'Bu doğrulama bağlantısı daha önce işlendi.'
          : 'Doğrulama tamamlandı. Güvenli oturum hazırlanıyor…';

  return (
    <Screen edges={['top', 'bottom']}>
      <AppText accessibilityRole="header" variant="title">
        E-posta Doğrulama
      </AppText>
      <AppCard tone="raised">
        <AppText selectable tone={failed ? 'danger' : 'muted'}>
          {message}
        </AppText>
        {result?.duplicate ? (
          <AppButton
            label="Giriş Ekranına Dön"
            onPress={() => router.replace('/auth/sign-in')}
            variant="secondary"
          />
        ) : failed || !callbackUrl ? (
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

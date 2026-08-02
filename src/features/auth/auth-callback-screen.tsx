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
import { useAuth } from '@/features/auth/auth-provider';
import { completeAuthCallback } from '@/features/auth/auth-service';
import {
  AUTH_PROFILE_ROUTE,
  useAuthCallbackNavigation,
} from '@/features/auth/use-auth-callback-navigation';

export function AuthCallbackScreen() {
  const router = useRouter();
  const callbackUrl = Linking.useLinkingURL();
  const { initializing, session } = useAuth();
  const [result, setResult] = useState<AuthCallbackResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!callbackUrl) return;
    let active = true;
    setResult(null);
    setFailed(false);
    void processAuthCallbackOnce('email_verification', callbackUrl, () =>
      completeAuthCallback(callbackUrl)
    )
      .then((nextResult) => {
        if (active) setResult(nextResult);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [callbackUrl]);

  const sessionReady = !initializing && Boolean(session);
  const navigationReady = useAuthCallbackNavigation(
    result?.callbackId ?? null,
    Boolean(result) && sessionReady
  );

  const message = failed
    ? 'Doğrulama bağlantısı geçersiz veya süresi dolmuş olabilir.'
    : !callbackUrl
      ? 'Doğrulama bağlantısı bulunamadı.'
      : !result
        ? 'Hesabın güvenli biçimde doğrulanıyor…'
        : result.duplicate
          ? 'Bu doğrulama bağlantısı daha önce işlendi.'
          : !sessionReady
            ? 'Doğrulama tamamlandı. Oturum hazırlanıyor…'
            : !navigationReady
              ? 'Doğrulama tamamlandı. Uygulama hazırlanıyor…'
              : 'E-posta adresin doğrulandı. Profiline yönlendiriliyorsun…';

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
            label="Profil Ekranına Dön"
            onPress={() => router.replace(AUTH_PROFILE_ROUTE)}
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

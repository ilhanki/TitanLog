import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { AppTextInput } from '@/components/app-text-input';
import { Screen } from '@/components/screen';
import {
  completeAuthCallbackOnce,
  processAuthCallbackOnce,
  type AuthCallbackResult,
} from '@/features/auth/auth-callback-coordinator';
import {
  beginPasswordRecovery,
  clearAuthNavigationState,
  finishPasswordRecovery,
  requestPostAuthDestination,
} from '@/features/auth/auth-navigation-state';
import { useAuth } from '@/features/auth/auth-provider';
import {
  preparePasswordResetCallback,
  signOut,
  updatePassword,
} from '@/features/auth/auth-service';
import { theme } from '@/theme/tokens';

export function ResetPasswordScreen() {
  const router = useRouter();
  const callbackUrl = Linking.useLinkingURL();
  const { initializing, session } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [callbackFailed, setCallbackFailed] = useState(false);
  const [callbackResult, setCallbackResult] =
    useState<AuthCallbackResult | null>(null);
  const [completed, setCompleted] = useState(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!callbackUrl) return;
    let active = true;
    beginPasswordRecovery();
    setCallbackFailed(false);
    setCallbackResult(null);
    void processAuthCallbackOnce('password_recovery', callbackUrl, () =>
      preparePasswordResetCallback(callbackUrl)
    )
      .then((result) => {
        if (active) setCallbackResult(result);
      })
      .catch(() => {
        if (active) setCallbackFailed(true);
      });
    return () => {
      active = false;
    };
  }, [callbackUrl]);

  const sessionReady = !initializing && Boolean(session);
  const callbackReady = Boolean(callbackResult) && sessionReady;

  const submit = async () => {
    if (pendingRef.current) return;
    if (password.length < 8) {
      setNotice('Şifren en az 8 karakter olmalı.');
      return;
    }
    if (password !== confirmation) {
      setNotice('Şifreler eşleşmiyor.');
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setNotice(null);
    try {
      if (!callbackResult || !callbackReady)
        throw new Error('callback_not_ready');
      const completedNow = await completeAuthCallbackOnce(
        callbackResult.callbackId,
        () => updatePassword(password)
      );
      if (!completedNow) {
        setNotice('Bu şifre yenileme bağlantısı daha önce işlendi.');
        return;
      }
      requestPostAuthDestination('password_update_complete');
      setCompleted(true);
      finishPasswordRecovery();
    } catch {
      setNotice(
        'Şifre yenileme bağlantısı geçersiz veya süresi dolmuş olabilir.'
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const cancel = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setNotice(null);
    try {
      if (session) {
        await signOut();
      } else {
        clearAuthNavigationState();
        router.replace('/auth/sign-in');
      }
    } catch {
      beginPasswordRecovery();
      setNotice('Şifre yenileme oturumu kapatılamadı. Yeniden deneyebilirsin.');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']} keyboardAware>
      <AppText accessibilityRole="header" variant="title">
        Yeni Şifre
      </AppText>
      <AppText selectable tone="muted">
        {callbackFailed
          ? 'Şifre yenileme bağlantısı geçersiz veya süresi dolmuş olabilir.'
          : !callbackUrl
            ? 'Şifre yenileme bağlantısı bulunamadı.'
            : !callbackReady
              ? 'Güvenli şifre yenileme oturumu hazırlanıyor…'
              : 'E-posta bağlantısından gelen doğrulanmış oturum için yeni şifreni belirle.'}
      </AppText>
      <AppCard style={styles.form} tone="raised">
        <AppTextInput
          autoCapitalize="none"
          autoComplete="new-password"
          editable={!pending && callbackReady}
          label="Yeni Şifre"
          onChangeText={setPassword}
          secureTextEntry
          value={password}
        />
        <AppTextInput
          autoCapitalize="none"
          autoComplete="new-password"
          editable={!pending && callbackReady}
          label="Yeni Şifre Tekrarı"
          onChangeText={setConfirmation}
          secureTextEntry
          value={confirmation}
        />
        {notice ? (
          <AppText accessibilityLiveRegion="polite" selectable tone="danger">
            {notice}
          </AppText>
        ) : null}
        <AppButton
          disabled={pending || !callbackReady || completed}
          label={
            pending
              ? 'Güncelleniyor…'
              : completed
                ? 'Şifre Güncellendi'
                : 'Şifreyi Güncelle'
          }
          onPress={() => void submit()}
        />
        <AppButton
          disabled={pending}
          label="Vazgeç"
          onPress={() => void cancel()}
          variant="ghost"
        />
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({ form: { gap: theme.spacing.lg } });

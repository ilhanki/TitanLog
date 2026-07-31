import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { AppTextInput } from '@/components/app-text-input';
import { Screen } from '@/components/screen';
import { completePasswordReset } from '@/features/auth/auth-service';
import { theme } from '@/theme/tokens';

export function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

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
      const url = await Linking.getInitialURL();
      if (!url) throw new Error('callback_missing');
      await completePasswordReset(url, password);
      router.replace('/auth/sign-in');
    } catch {
      setNotice(
        'Şifre yenileme bağlantısı geçersiz veya süresi dolmuş olabilir.'
      );
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
        E-posta bağlantısından gelen doğrulanmış oturum için yeni şifreni
        belirle.
      </AppText>
      <AppCard style={styles.form} tone="raised">
        <AppTextInput
          autoCapitalize="none"
          autoComplete="new-password"
          label="Yeni Şifre"
          onChangeText={setPassword}
          secureTextEntry
          value={password}
        />
        <AppTextInput
          autoCapitalize="none"
          autoComplete="new-password"
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
          disabled={pending}
          label={pending ? 'Güncelleniyor…' : 'Şifreyi Güncelle'}
          onPress={() => void submit()}
        />
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({ form: { gap: theme.spacing.lg } });

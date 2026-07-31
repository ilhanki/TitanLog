import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { AppTextInput } from '@/components/app-text-input';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { AuthLink } from '@/features/auth/auth-link';
import { AuthScreenHeader } from '@/features/auth/auth-screen-header';
import { requestPasswordReset, signIn } from '@/features/auth/auth-service';
import {
  hasFieldErrors,
  validateSignIn,
  type FieldErrors,
  type SignInFields,
} from '@/features/auth/auth-validation';
import { theme } from '@/theme/tokens';

const initialFields: SignInFields = { email: '', password: '' };

export function SignInScreen() {
  const router = useRouter();
  const [fields, setFields] = useState(initialFields);
  const [errors, setErrors] = useState<FieldErrors<SignInFields>>({});
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  async function handleSubmit() {
    const nextErrors = validateSignIn(fields);
    setErrors(nextErrors);

    if (hasFieldErrors(nextErrors)) {
      setNotice(undefined);
      return;
    }

    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await signIn(fields.email, fields.password);
      router.replace('/(tabs)/profile');
    } catch {
      setNotice(appStrings.auth.safeError);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  async function handlePasswordReset() {
    const nextErrors = validateSignIn({ ...fields, password: 'reset-request' });
    setErrors((current) => ({ ...current, email: nextErrors.email }));
    if (nextErrors.email || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await requestPasswordReset(fields.email);
      setNotice(appStrings.auth.passwordResetSent);
    } catch {
      setNotice(appStrings.auth.safeError);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} keyboardAware>
      <AuthScreenHeader
        description={appStrings.auth.signInDescription}
        title={appStrings.auth.signIn}
      />
      <AppCard style={styles.form} tone="raised">
        <AppTextInput
          autoCapitalize="none"
          autoComplete="email"
          error={errors.email}
          keyboardType="email-address"
          label={appStrings.auth.emailLabel}
          onChangeText={(email) =>
            setFields((current) => ({ ...current, email }))
          }
          placeholder={appStrings.auth.emailPlaceholder}
          returnKeyType="next"
          value={fields.email}
        />
        <AppTextInput
          autoCapitalize="none"
          autoComplete="current-password"
          error={errors.password}
          label={appStrings.auth.passwordLabel}
          onChangeText={(password) =>
            setFields((current) => ({ ...current, password }))
          }
          placeholder={appStrings.auth.passwordPlaceholder}
          returnKeyType="done"
          secureTextEntry
          value={fields.password}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => void handlePasswordReset()}
          style={styles.forgotPassword}
        >
          <AppText tone="primary" variant="bodyStrong">
            {appStrings.auth.forgotPassword}
          </AppText>
        </Pressable>
        <AppButton
          disabled={pending}
          label={pending ? 'Giriş yapılıyor…' : appStrings.auth.signIn}
          onPress={() => void handleSubmit()}
        />
        {notice ? (
          <AppText
            accessibilityLiveRegion="polite"
            selectable
            style={styles.notice}
            tone="muted"
          >
            {notice}
          </AppText>
        ) : null}
      </AppCard>
      <AuthLink href="/auth/sign-up" label={appStrings.auth.noAccountPrompt} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: theme.spacing.lg,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    minHeight: theme.layout.touchTarget,
    paddingVertical: theme.spacing.md,
  },
  notice: {
    textAlign: 'center',
  },
});

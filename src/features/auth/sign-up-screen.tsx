import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { AppTextInput } from '@/components/app-text-input';
import { Screen } from '@/components/screen';
import { appStrings } from '@/constants/strings';
import { AuthLink } from '@/features/auth/auth-link';
import { AuthScreenHeader } from '@/features/auth/auth-screen-header';
import {
  hasFieldErrors,
  validateSignUp,
  type FieldErrors,
  type SignUpFields,
} from '@/features/auth/auth-validation';
import { theme } from '@/theme/tokens';

const initialFields: SignUpFields = {
  email: '',
  name: '',
  password: '',
  passwordConfirmation: '',
};

export function SignUpScreen() {
  const [fields, setFields] = useState(initialFields);
  const [errors, setErrors] = useState<FieldErrors<SignUpFields>>({});
  const [notice, setNotice] = useState<string>();

  function handleSubmit() {
    const nextErrors = validateSignUp(fields);
    setErrors(nextErrors);

    if (hasFieldErrors(nextErrors)) {
      setNotice(undefined);
      return;
    }

    setNotice(appStrings.auth.developmentNotice);
  }

  return (
    <Screen edges={['top', 'bottom']} keyboardAware>
      <AuthScreenHeader
        description={appStrings.auth.signUpDescription}
        title={appStrings.auth.signUp}
      />
      <AppCard style={styles.form} tone="raised">
        <AppTextInput
          autoCapitalize="words"
          autoComplete="name"
          error={errors.name}
          label={appStrings.auth.nameLabel}
          onChangeText={(name) =>
            setFields((current) => ({ ...current, name }))
          }
          placeholder={appStrings.auth.namePlaceholder}
          returnKeyType="next"
          value={fields.name}
        />
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
          autoComplete="new-password"
          error={errors.password}
          label={appStrings.auth.passwordLabel}
          onChangeText={(password) =>
            setFields((current) => ({ ...current, password }))
          }
          placeholder={appStrings.auth.passwordPlaceholder}
          returnKeyType="next"
          secureTextEntry
          value={fields.password}
        />
        <AppTextInput
          autoCapitalize="none"
          autoComplete="new-password"
          error={errors.passwordConfirmation}
          label={appStrings.auth.passwordConfirmationLabel}
          onChangeText={(passwordConfirmation) =>
            setFields((current) => ({ ...current, passwordConfirmation }))
          }
          placeholder={appStrings.auth.passwordConfirmationPlaceholder}
          returnKeyType="done"
          secureTextEntry
          value={fields.passwordConfirmation}
        />
        <AppButton label={appStrings.auth.signUp} onPress={handleSubmit} />
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
      <AuthLink
        href="/auth/sign-in"
        label={appStrings.auth.existingAccountPrompt}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: theme.spacing.lg,
  },
  notice: {
    textAlign: 'center',
  },
});

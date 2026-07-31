import { appStrings } from '@/constants/strings';

export type SignInFields = {
  email: string;
  password: string;
};

export type SignUpFields = SignInFields & {
  name: string;
  passwordConfirmation: string;
};

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

function isBlank(value: string) {
  return value.trim().length === 0;
}

export function validateSignIn(
  fields: SignInFields
): FieldErrors<SignInFields> {
  const errors: FieldErrors<SignInFields> = {};

  if (isBlank(fields.email)) {
    errors.email = appStrings.auth.validation.emailRequired;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
    errors.email = appStrings.auth.validation.emailInvalid;
  }

  if (isBlank(fields.password)) {
    errors.password = appStrings.auth.validation.passwordRequired;
  } else if (fields.password.length < 8) {
    errors.password = appStrings.auth.validation.passwordTooShort;
  }

  return errors;
}

export function validateSignUp(
  fields: SignUpFields
): FieldErrors<SignUpFields> {
  const errors: FieldErrors<SignUpFields> = validateSignIn(fields);

  if (isBlank(fields.name)) {
    errors.name = appStrings.auth.validation.nameRequired;
  }

  if (isBlank(fields.passwordConfirmation)) {
    errors.passwordConfirmation =
      appStrings.auth.validation.passwordConfirmationRequired;
  } else if (fields.password !== fields.passwordConfirmation) {
    errors.passwordConfirmation = appStrings.auth.validation.passwordMismatch;
  }

  return errors;
}

export function hasFieldErrors<T>(errors: FieldErrors<T>) {
  return Object.keys(errors).length > 0;
}

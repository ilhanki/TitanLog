import type { AuthRouteFlow } from '@/features/auth/auth-navigation-state';
import type { DatasetAccessState } from '@/features/data-safety/dataset-access-guard';

type AuthRouteActivationInput = {
  authenticated: boolean;
  datasetAccess: DatasetAccessState;
  flow: AuthRouteFlow;
  initializing: boolean;
  passwordResetLink: boolean;
};

export type AuthRouteActivation = {
  datasetAccessRouteAvailable: boolean;
  loading: boolean;
  localRoutesAvailable: boolean;
  passwordResetRouteAvailable: boolean;
  signedOutAuthRoutesAvailable: boolean;
};

export function getAuthRouteActivation({
  authenticated,
  datasetAccess,
  flow,
  initializing,
  passwordResetLink,
}: AuthRouteActivationInput): AuthRouteActivation {
  const passwordRecoveryActive =
    flow === 'password_recovery' ||
    (flow !== 'password_recovery_complete' && passwordResetLink);
  const localRoutesAvailable = authenticated
    ? datasetAccess === 'granted' && !passwordRecoveryActive
    : !passwordRecoveryActive;

  return {
    datasetAccessRouteAvailable:
      authenticated && !passwordRecoveryActive && datasetAccess !== 'granted',
    loading: initializing,
    localRoutesAvailable,
    passwordResetRouteAvailable: !authenticated || passwordRecoveryActive,
    signedOutAuthRoutesAvailable: !authenticated,
  };
}

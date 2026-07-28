import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { appStrings } from '@/constants/strings';

export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  const navigation = useNavigation();
  const allowNavigationRef = useRef(false);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!hasUnsavedChanges || allowNavigationRef.current) return;
        event.preventDefault();
        Alert.alert(
          appStrings.workout.discardTitle,
          appStrings.workout.discardDescription,
          [
            {
              style: 'cancel',
              text: appStrings.workout.keepEditing,
            },
            {
              onPress: () => {
                allowNavigationRef.current = true;
                navigation.dispatch(event.data.action);
              },
              style: 'destructive',
              text: appStrings.workout.discardConfirm,
            },
          ]
        );
      }),
    [hasUnsavedChanges, navigation]
  );

  return useCallback(() => {
    allowNavigationRef.current = true;
  }, []);
}

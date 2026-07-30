import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Keyboard,
  PanResponder,
  StyleSheet,
  TextInput,
  View,
  type InputModeOptions,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { appStrings } from '@/constants/strings';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

export const INLINE_WHEEL_STEP_DISTANCE = 18;

export function getInlineWheelStep(distanceY: number): number {
  return Math.trunc(-distanceY / INLINE_WHEEL_STEP_DISTANCE);
}

type InlineNumericWheelFieldProps = {
  accessibilityHint?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  formatValue: (value: number) => string;
  inputMode: InputModeOptions;
  inputStyle?: StyleProp<TextStyle>;
  keyboardType: KeyboardTypeOptions;
  max: number;
  min: number;
  onChangeText: (value: string) => void;
  parseValue: (value: string) => number | null;
  step: number;
  style?: StyleProp<ViewStyle>;
  value: string;
};

function decimalPlaces(value: number): number {
  const decimal = String(value).split('.')[1];
  return decimal?.length ?? 0;
}

export function stepInlineNumericValue(
  value: string,
  direction: number,
  options: Pick<
    InlineNumericWheelFieldProps,
    'formatValue' | 'max' | 'min' | 'parseValue' | 'step'
  >
): string {
  const parsed = options.parseValue(value);
  if (parsed === null || direction === 0) return value;
  const precision = 10 ** decimalPlaces(options.step);
  const stepped =
    Math.round((parsed + direction * options.step) * precision) / precision;
  return options.formatValue(
    Math.min(options.max, Math.max(options.min, stepped))
  );
}

export function InlineNumericWheelField({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  formatValue,
  inputMode,
  inputStyle,
  keyboardType,
  max,
  min,
  onChangeText,
  parseValue,
  step,
  style,
  value,
}: InlineNumericWheelFieldProps) {
  const valueRef = useRef(value);
  const gestureStepRef = useRef(0);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const changeBy = useCallback(
    (direction: number) => {
      if (disabled) return;
      const next = stepInlineNumericValue(valueRef.current, direction, {
        formatValue,
        max,
        min,
        parseValue,
        step,
      });
      if (next === valueRef.current) return;
      valueRef.current = next;
      onChangeText(next);
    },
    [disabled, formatValue, max, min, onChangeText, parseValue, step]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          !disabled &&
          Math.abs(gesture.dy) >= 8 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          gestureStepRef.current = 0;
          Keyboard.dismiss();
        },
        onPanResponderMove: (_, gesture) => {
          const currentStep = getInlineWheelStep(gesture.dy);
          const difference = currentStep - gestureStepRef.current;
          if (difference === 0) return;
          gestureStepRef.current = currentStep;
          changeBy(difference);
        },
        onPanResponderRelease: () => {
          gestureStepRef.current = 0;
        },
        onPanResponderTerminate: () => {
          gestureStepRef.current = 0;
        },
      }),
    [changeBy, disabled]
  );

  return (
    <View
      {...panResponder.panHandlers}
      style={[styles.container, style, disabled && styles.disabled]}
      testID={`${accessibilityLabel}-inline-wheel`}
    >
      <TextInput
        accessibilityActions={[
          { label: appStrings.common.increase, name: 'increment' },
          { label: appStrings.common.decrease, name: 'decrement' },
        ]}
        accessibilityHint={`${appStrings.common.inlineWheelHint}${accessibilityHint ? ` ${accessibilityHint}` : ''}`}
        accessibilityLabel={accessibilityLabel}
        editable={!disabled}
        inputMode={inputMode}
        keyboardType={keyboardType}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') changeBy(1);
          if (event.nativeEvent.actionName === 'decrement') changeBy(-1);
        }}
        onChangeText={onChangeText}
        selectTextOnFocus
        style={[styles.input, inputStyle]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: workoutTheme.input,
    borderColor: workoutTheme.separator,
    borderRadius: theme.radii.sm,
    borderWidth: theme.borders.thin,
    height: theme.layout.compactTouchTarget,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  disabled: { opacity: 0.72 },
  input: {
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.typography.size.caption,
    fontVariant: ['tabular-nums'],
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 0,
    textAlign: 'center',
  },
});

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  PanResponder,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type InputModeOptions,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/app-text';
import { appStrings } from '@/constants/strings';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

export const INLINE_WHEEL_ITEM_HEIGHT = 18;
export const INLINE_WHEEL_STEP_DISTANCE = INLINE_WHEEL_ITEM_HEIGHT;
export const INLINE_WHEEL_GESTURE_THRESHOLD = 8;
const INLINE_WHEEL_CONTENT_PADDING =
  (theme.layout.compactTouchTarget - INLINE_WHEEL_ITEM_HEIGHT) / 2;

export function getInlineWheelStep(distanceY: number): number {
  return Math.trunc(distanceY / INLINE_WHEEL_STEP_DISTANCE);
}

export function shouldCaptureInlineWheelGesture(
  distanceX: number,
  distanceY: number,
  disabled = false
): boolean {
  return (
    !disabled &&
    Math.abs(distanceY) >= INLINE_WHEEL_GESTURE_THRESHOLD &&
    Math.abs(distanceY) > Math.abs(distanceX)
  );
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
  unit: string;
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

export function getInlineWheelValues(
  value: string,
  options: Pick<
    InlineNumericWheelFieldProps,
    'formatValue' | 'max' | 'min' | 'parseValue' | 'step'
  >
): readonly [string, string, string] {
  return [
    stepInlineNumericValue(value, 1, options),
    value,
    stepInlineNumericValue(value, -1, options),
  ];
}

type ActiveInlineEditor = {
  finish: (dismissKeyboard: boolean) => void;
  id: symbol;
};

let activeInlineEditor: ActiveInlineEditor | null = null;

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
  unit,
  value,
}: InlineNumericWheelFieldProps) {
  const valueRef = useRef(value);
  const lastValidValueRef = useRef(value);
  const gestureStepRef = useRef(0);
  const editorIdRef = useRef(Symbol(accessibilityLabel));
  const inputRef = useRef<TextInput>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    valueRef.current = value;
    if (parseValue(value) !== null) lastValidValueRef.current = value;
  }, [parseValue, value]);

  const finishEditing = useCallback(
    (dismissKeyboard = true) => {
      const finalValue =
        parseValue(valueRef.current) === null
          ? lastValidValueRef.current
          : valueRef.current;
      if (finalValue !== valueRef.current) {
        valueRef.current = finalValue;
        onChangeText(finalValue);
      }
      if (activeInlineEditor?.id === editorIdRef.current) {
        activeInlineEditor = null;
      }
      setEditing(false);
      if (dismissKeyboard) Keyboard.dismiss();
    },
    [onChangeText, parseValue]
  );

  useEffect(
    () => () => {
      if (activeInlineEditor?.id === editorIdRef.current) {
        activeInlineEditor = null;
      }
    },
    []
  );

  useEffect(() => {
    if (!editing) return;
    const subscription = Keyboard.addListener('keyboardDidHide', () =>
      finishEditing(false)
    );
    return () => subscription.remove();
  }, [editing, finishEditing]);

  const beginEditing = useCallback(() => {
    if (disabled || editing) return;
    if (activeInlineEditor?.id !== editorIdRef.current) {
      activeInlineEditor?.finish(false);
      activeInlineEditor = {
        finish: finishEditing,
        id: editorIdRef.current,
      };
    }
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [disabled, editing, finishEditing]);

  const handleChangeText = useCallback(
    (next: string) => {
      valueRef.current = next;
      if (parseValue(next) !== null) lastValidValueRef.current = next;
      onChangeText(next);
    },
    [onChangeText, parseValue]
  );

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
          shouldCaptureInlineWheelGesture(gesture.dx, gesture.dy, disabled),
        onPanResponderGrant: () => {
          if (editing) finishEditing();
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
    [changeBy, disabled, editing, finishEditing]
  );

  const wheelOptions = { formatValue, max, min, parseValue, step };
  const [higherValue, selectedValue, lowerValue] = getInlineWheelValues(
    value,
    wheelOptions
  );

  return (
    <Pressable
      {...panResponder.panHandlers}
      disabled={disabled}
      onPress={beginEditing}
      style={[styles.container, style, disabled && styles.disabled]}
      testID={`${accessibilityLabel}-inline-wheel`}
    >
      {!editing ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={styles.wheelValues}
        >
          <AppText style={styles.neighbourValue} variant="caption">
            {higherValue}
          </AppText>
          <AppText style={styles.selectedValue} variant="bodyStrong">
            {selectedValue}
          </AppText>
          <AppText style={styles.neighbourValue} variant="caption">
            {lowerValue}
          </AppText>
        </View>
      ) : null}
      <TextInput
        accessibilityActions={[
          { label: appStrings.common.increase, name: 'increment' },
          { label: appStrings.common.decrease, name: 'decrement' },
        ]}
        accessibilityHint={`${appStrings.common.inlineWheelHint}${accessibilityHint ? ` ${accessibilityHint}` : ''}`}
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: `${value} ${unit}` }}
        editable={!disabled}
        inputMode={inputMode}
        keyboardType={keyboardType}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') changeBy(1);
          if (event.nativeEvent.actionName === 'decrement') changeBy(-1);
        }}
        onBlur={() => finishEditing()}
        onChangeText={handleChangeText}
        onFocus={beginEditing}
        onSubmitEditing={() => finishEditing()}
        ref={inputRef}
        selectTextOnFocus
        submitBehavior="blurAndSubmit"
        style={[styles.input, !editing && styles.hiddenInput, inputStyle]}
        testID={`${accessibilityLabel}-inline-input`}
        value={value}
      />
    </Pressable>
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
  hiddenInput: { opacity: 0 },
  input: {
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.typography.size.caption,
    fontVariant: ['tabular-nums'],
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 0,
    textAlign: 'center',
  },
  neighbourValue: {
    color: theme.colors.textMuted,
    height: INLINE_WHEEL_ITEM_HEIGHT,
    lineHeight: INLINE_WHEEL_ITEM_HEIGHT,
    opacity: 0.62,
    textAlign: 'center',
  },
  selectedValue: {
    color: theme.colors.text,
    height: INLINE_WHEEL_ITEM_HEIGHT,
    lineHeight: INLINE_WHEEL_ITEM_HEIGHT,
    textAlign: 'center',
  },
  wheelValues: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: INLINE_WHEEL_CONTENT_PADDING - INLINE_WHEEL_ITEM_HEIGHT,
  },
});

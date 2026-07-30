import { useCallback, useEffect, useRef, useState } from 'react';
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
export const INLINE_WHEEL_VERTICAL_DOMINANCE_RATIO = 1.25;
const INLINE_WHEEL_CONTENT_PADDING =
  (theme.layout.compactTouchTarget - INLINE_WHEEL_ITEM_HEIGHT) / 2;

export function getInlineWheelStep(distanceY: number): number {
  return Math.trunc(distanceY / INLINE_WHEEL_STEP_DISTANCE);
}

export function getInlineWheelStepDifference(
  accumulatedDistanceY: number,
  appliedStepCount: number
): number {
  return getInlineWheelStep(accumulatedDistanceY) - appliedStepCount;
}

export function getInlineWheelTranslation(distanceY: number): number {
  const appliedDistance =
    getInlineWheelStep(distanceY) * INLINE_WHEEL_STEP_DISTANCE;
  return Math.max(
    -INLINE_WHEEL_ITEM_HEIGHT / 2,
    Math.min(INLINE_WHEEL_ITEM_HEIGHT / 2, distanceY - appliedDistance)
  );
}

export function shouldCaptureInlineWheelGesture(
  distanceX: number,
  distanceY: number,
  disabled = false,
  editing = false
): boolean {
  return (
    !disabled &&
    !editing &&
    Math.abs(distanceY) >= INLINE_WHEEL_GESTURE_THRESHOLD &&
    Math.abs(distanceY) >
      Math.abs(distanceX) * INLINE_WHEEL_VERTICAL_DOMINANCE_RATIO
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
  onGestureActiveChange?: (active: boolean) => void;
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
    stepInlineNumericValue(value, -1, options),
    value,
    stepInlineNumericValue(value, 1, options),
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
  onGestureActiveChange,
  parseValue,
  step,
  style,
  unit,
  value,
}: InlineNumericWheelFieldProps) {
  const valueRef = useRef(value);
  const lastValidValueRef = useRef(value);
  const gestureStepRef = useRef(0);
  const gestureActiveRef = useRef(false);
  const disabledRef = useRef(disabled);
  const editingRef = useRef(false);
  const editorIdRef = useRef(Symbol(accessibilityLabel));
  const inputRef = useRef<TextInput>(null);
  const changeByRef = useRef<(direction: number) => void>(() => undefined);
  const finishEditingRef = useRef<(dismissKeyboard?: boolean) => void>(
    () => undefined
  );
  const gestureActiveChangeRef = useRef(onGestureActiveChange);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [translationY, setTranslationY] = useState(0);

  disabledRef.current = disabled;
  editingRef.current = editing;
  gestureActiveChangeRef.current = onGestureActiveChange;

  useEffect(() => {
    valueRef.current = value;
    if (parseValue(value) !== null) lastValidValueRef.current = value;
  }, [parseValue, value]);

  const setGestureActive = useCallback((active: boolean) => {
    if (gestureActiveRef.current === active) return;
    gestureActiveRef.current = active;
    setDragging(active);
    gestureActiveChangeRef.current?.(active);
  }, []);

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
      editingRef.current = false;
      setEditing(false);
      if (dismissKeyboard) Keyboard.dismiss();
    },
    [onChangeText, parseValue]
  );
  finishEditingRef.current = finishEditing;

  useEffect(
    () => () => {
      if (activeInlineEditor?.id === editorIdRef.current) {
        activeInlineEditor = null;
      }
      if (gestureActiveRef.current) {
        gestureActiveRef.current = false;
        gestureActiveChangeRef.current?.(false);
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
    if (disabledRef.current || editingRef.current) return;
    if (activeInlineEditor?.id !== editorIdRef.current) {
      activeInlineEditor?.finish(false);
      activeInlineEditor = {
        finish: finishEditingRef.current,
        id: editorIdRef.current,
      };
    }
    editingRef.current = true;
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

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
      if (disabledRef.current) return;
      const next = stepInlineNumericValue(valueRef.current, direction, {
        formatValue,
        max,
        min,
        parseValue,
        step,
      });
      if (next === valueRef.current) return;
      valueRef.current = next;
      lastValidValueRef.current = next;
      onChangeText(next);
    },
    [formatValue, max, min, onChangeText, parseValue, step]
  );
  changeByRef.current = changeBy;

  const finishGesture = useCallback(() => {
    gestureStepRef.current = 0;
    setTranslationY(0);
    setGestureActive(false);
  }, [setGestureActive]);

  const panResponderRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        shouldCaptureInlineWheelGesture(
          gesture.dx,
          gesture.dy,
          disabledRef.current,
          editingRef.current
        ),
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        shouldCaptureInlineWheelGesture(
          gesture.dx,
          gesture.dy,
          disabledRef.current,
          editingRef.current
        ),
      onPanResponderGrant: () => {
        gestureStepRef.current = 0;
        Keyboard.dismiss();
        setGestureActive(true);
      },
      onPanResponderMove: (_, gesture) => {
        const difference = getInlineWheelStepDifference(
          gesture.dy,
          gestureStepRef.current
        );
        if (difference !== 0) {
          gestureStepRef.current += difference;
          changeByRef.current(-difference);
        }
        setTranslationY(getInlineWheelTranslation(gesture.dy));
      },
      onPanResponderRelease: finishGesture,
      onPanResponderTerminate: finishGesture,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    })
  );

  const wheelOptions = { formatValue, max, min, parseValue, step };
  const [lowerValue, selectedValue, higherValue] = getInlineWheelValues(
    value,
    wheelOptions
  );
  const interactionHint = `${appStrings.common.inlineWheelHint}${accessibilityHint ? ` ${accessibilityHint}` : ''}`;

  return (
    <View
      {...panResponderRef.current.panHandlers}
      style={[styles.container, style, disabled && styles.disabled]}
      testID={`${accessibilityLabel}-inline-wheel`}
    >
      {editing ? (
        <TextInput
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ text: `${value} ${unit}` }}
          autoFocus
          editable={!disabled}
          inputMode={inputMode}
          keyboardType={keyboardType}
          onBlur={() => finishEditing()}
          onChangeText={handleChangeText}
          onSubmitEditing={() => finishEditing()}
          ref={inputRef}
          selectTextOnFocus
          submitBehavior="blurAndSubmit"
          style={[styles.input, inputStyle]}
          testID={`${accessibilityLabel}-inline-input`}
          value={value}
        />
      ) : (
        <Pressable
          accessibilityActions={[
            { label: appStrings.common.increase, name: 'increment' },
            { label: appStrings.common.decrease, name: 'decrement' },
          ]}
          accessibilityHint={interactionHint}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="adjustable"
          accessibilityState={{ disabled }}
          accessibilityValue={{ text: `${value} ${unit}` }}
          disabled={disabled}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment')
              changeByRef.current(1);
            if (event.nativeEvent.actionName === 'decrement')
              changeByRef.current(-1);
          }}
          onPress={beginEditing}
          style={styles.gestureSurface}
          testID={`${accessibilityLabel}-inline-display`}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[
              styles.wheelValues,
              { transform: [{ translateY: translationY }] },
            ]}
          >
            <AppText
              style={[styles.neighbourValue, dragging && styles.dragNeighbour]}
              variant="caption"
            >
              {lowerValue}
            </AppText>
            <AppText
              style={[styles.selectedValue, dragging && styles.dragSelected]}
              variant="bodyStrong"
            >
              {selectedValue}
            </AppText>
            <AppText
              style={[styles.neighbourValue, dragging && styles.dragNeighbour]}
              variant="caption"
            >
              {higherValue}
            </AppText>
          </View>
        </Pressable>
      )}
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
  dragNeighbour: { opacity: 0.82 },
  dragSelected: { transform: [{ scale: 0.97 }] },
  gestureSurface: { flex: 1, justifyContent: 'center' },
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

import { fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';
import { Keyboard } from 'react-native';

import { WeightSelectorField } from '@/components/weight-selector-field';
import {
  getInlineWheelStep,
  getInlineWheelStepDifference,
  getInlineWheelTranslation,
  getInlineWheelValues,
  InlineNumericWheelField,
  shouldCaptureInlineWheelGesture,
  stepInlineNumericValue,
} from '@/features/workouts/components/inline-numeric-wheel-field';
import {
  formatWorkoutWeight,
  parseRepetitionInput,
  parseWeightInput,
} from '@/features/workouts/utils/workout-values';

function WeightHarness({
  disabled = false,
  initialValue = '50',
  onGestureActiveChange,
}: {
  disabled?: boolean;
  initialValue?: string;
  onGestureActiveChange?: (active: boolean) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <InlineNumericWheelField
      accessibilityLabel="Lat Pulldown Kilo (kg)"
      disabled={disabled}
      formatValue={formatWorkoutWeight}
      inputMode="decimal"
      keyboardType="decimal-pad"
      max={2000}
      min={2.5}
      onChangeText={setValue}
      onGestureActiveChange={onGestureActiveChange}
      parseValue={parseWeightInput}
      step={2.5}
      unit="kilogram"
      value={value}
    />
  );
}

function RepetitionHarness() {
  const [value, setValue] = useState('12');
  return (
    <InlineNumericWheelField
      accessibilityLabel="Lat Pulldown tekrar sayısı"
      formatValue={String}
      inputMode="numeric"
      keyboardType="number-pad"
      max={100}
      min={1}
      onChangeText={setValue}
      parseValue={parseRepetitionInput}
      step={1}
      unit="tekrar"
      value={value}
    />
  );
}

function TwoFieldHarness() {
  return (
    <>
      <WeightHarness />
      <RepetitionHarness />
    </>
  );
}

function ExerciseDefaultWeightHarness() {
  const [value, setValue] = useState('17,5');
  return (
    <WeightSelectorField
      accessibilityLabel="Varsayılan ağırlık"
      kind="exercise"
      label="Varsayılan Ağırlık"
      onChangeText={setValue}
      title="Varsayılan Ağırlık"
      value={value}
    />
  );
}

const weightOptions = {
  formatValue: formatWorkoutWeight,
  max: 2000,
  min: 2.5,
  parseValue: parseWeightInput,
  step: 2.5,
};

describe('inline numeric wheel field', () => {
  it('maps accumulated downward and upward movement to only newly crossed steps', () => {
    expect(getInlineWheelStep(20)).toBe(1);
    expect(getInlineWheelStep(-20)).toBe(-1);
    expect(getInlineWheelStepDifference(37, 1)).toBe(1);
    expect(getInlineWheelStepDifference(-37, -1)).toBe(-1);
    expect(getInlineWheelStepDifference(20, 1)).toBe(0);
    expect(getInlineWheelTranslation(12)).toBeLessThanOrEqual(9);
    expect(getInlineWheelTranslation(-12)).toBeGreaterThanOrEqual(-9);
  });

  it('changes repetitions by one and weight by 2.5 in the approved direction', () => {
    expect(stepInlineNumericValue('50', 1, weightOptions)).toBe('52,5');
    expect(stepInlineNumericValue('50', -1, weightOptions)).toBe('47,5');
    const repetitionOptions = {
      formatValue: String,
      max: 100,
      min: 1,
      parseValue: parseRepetitionInput,
      step: 1,
    };
    expect(stepInlineNumericValue('12', 1, repetitionOptions)).toBe('13');
    expect(stepInlineNumericValue('12', -1, repetitionOptions)).toBe('11');
    expect(stepInlineNumericValue('100', 1, repetitionOptions)).toBe('100');
  });

  it('shows smaller values above, larger values below, and preserves exact drafts', () => {
    expect(getInlineWheelValues('50', weightOptions)).toEqual([
      '47,5',
      '50',
      '52,5',
    ]);
    expect(getInlineWheelValues('52,5', weightOptions)).toEqual([
      '50',
      '52,5',
      '55',
    ]);
    expect(getInlineWheelValues('18', weightOptions)).toEqual([
      '15,5',
      '18',
      '20,5',
    ]);
  });

  it('activates only deliberate dominant vertical movement', () => {
    expect(shouldCaptureInlineWheelGesture(0, 7)).toBe(false);
    expect(shouldCaptureInlineWheelGesture(8, 9)).toBe(false);
    expect(shouldCaptureInlineWheelGesture(0, 8)).toBe(true);
    expect(shouldCaptureInlineWheelGesture(0, -8)).toBe(true);
    expect(shouldCaptureInlineWheelGesture(0, 20, true)).toBe(false);
    expect(shouldCaptureInlineWheelGesture(0, 20, false, true)).toBe(false);
  });

  it('owns the complete display surface without mounting an intercepting TextInput', async () => {
    const { getByTestId, queryByTestId } = await render(<WeightHarness />);
    const surface = getByTestId('Lat Pulldown Kilo (kg)-inline-wheel');

    expect(surface).toHaveProp('onMoveShouldSetResponder');
    expect(surface).toHaveProp('onMoveShouldSetResponderCapture');
    expect(surface).toHaveProp('onResponderTerminationRequest');
    expect(getByTestId('Lat Pulldown Kilo (kg)-inline-display')).toBeTruthy();
    expect(queryByTestId('Lat Pulldown Kilo (kg)-inline-input')).toBeNull();
  });

  it('mounts and focuses TextInput only after a genuine tap', async () => {
    const { getByTestId, queryByTestId } = await render(<WeightHarness />);

    await fireEvent.press(getByTestId('Lat Pulldown Kilo (kg)-inline-display'));

    const input = getByTestId('Lat Pulldown Kilo (kg)-inline-input');
    expect(input).toHaveProp('editable', true);
    expect(input).toHaveProp('value', '50');
    expect(queryByTestId('Lat Pulldown Kilo (kg)-inline-display')).toBeNull();
    expect(queryByTestId('weight-wheel-modal')).toBeNull();
  });

  it('accepts comma and period drafts, submits locally, and dismisses the keyboard', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    const { getByTestId, queryByTestId } = await render(<WeightHarness />);
    await fireEvent.press(getByTestId('Lat Pulldown Kilo (kg)-inline-display'));
    const input = getByTestId('Lat Pulldown Kilo (kg)-inline-input');

    await fireEvent.changeText(input, '57,5');
    await fireEvent.changeText(input, '57.5');
    await fireEvent(input, 'submitEditing');

    expect(queryByTestId('Lat Pulldown Kilo (kg)-inline-input')).toBeNull();
    expect(getByTestId('Lat Pulldown Kilo (kg)-inline-display')).toHaveProp(
      'accessibilityValue',
      { text: '57.5 kilogram' }
    );
    expect(dismiss).toHaveBeenCalled();
    dismiss.mockRestore();
  });

  it('restores the last valid value after invalid editing ends', async () => {
    const { getByTestId } = await render(<WeightHarness initialValue="18" />);
    await fireEvent.press(getByTestId('Lat Pulldown Kilo (kg)-inline-display'));
    const input = getByTestId('Lat Pulldown Kilo (kg)-inline-input');
    await fireEvent.changeText(input, 'geçersiz');
    await fireEvent(input, 'blur');

    expect(getByTestId('Lat Pulldown Kilo (kg)-inline-display')).toHaveProp(
      'accessibilityValue',
      { text: '18 kilogram' }
    );
  });

  it('allows only one inline field to edit at a time', async () => {
    const { getByTestId, queryByTestId } = await render(<TwoFieldHarness />);
    await fireEvent.press(getByTestId('Lat Pulldown Kilo (kg)-inline-display'));
    await fireEvent.press(
      getByTestId('Lat Pulldown tekrar sayısı-inline-display')
    );

    expect(queryByTestId('Lat Pulldown Kilo (kg)-inline-input')).toBeNull();
    expect(getByTestId('Lat Pulldown tekrar sayısı-inline-input')).toBeTruthy();
  });

  it('keeps semantic accessibility actions and the truthful Turkish hint', async () => {
    const { getByTestId } = await render(<WeightHarness />);
    const field = getByTestId('Lat Pulldown Kilo (kg)-inline-display');

    expect(field).toHaveProp('accessibilityRole', 'adjustable');
    expect(field).toHaveProp(
      'accessibilityHint',
      'Yukarı kaydırarak artır, aşağı kaydırarak azalt; yazmak için dokun.'
    );
    await fireEvent(field, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(getByTestId('Lat Pulldown Kilo (kg)-inline-display')).toHaveProp(
      'accessibilityValue',
      { text: '52,5 kilogram' }
    );
    await fireEvent(
      getByTestId('Lat Pulldown Kilo (kg)-inline-display'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'decrement' } }
    );
    expect(getByTestId('Lat Pulldown Kilo (kg)-inline-display')).toHaveProp(
      'accessibilityValue',
      { text: '50 kilogram' }
    );
  });

  it('prevents disabled fields from dragging, typing, or adjusting', async () => {
    const { getByTestId, queryByTestId } = await render(
      <WeightHarness disabled />
    );
    const display = getByTestId('Lat Pulldown Kilo (kg)-inline-display');
    await fireEvent.press(display);
    await fireEvent(display, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });

    expect(queryByTestId('Lat Pulldown Kilo (kg)-inline-input')).toBeNull();
    expect(display).toHaveProp('accessibilityValue', {
      text: '50 kilogram',
    });
  });

  it('keeps exercise defaults inline while the body-weight modal stays separate', async () => {
    const { getByTestId, queryByTestId } = await render(
      <ExerciseDefaultWeightHarness />
    );
    await fireEvent(
      getByTestId('Varsayılan ağırlık-inline-display'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } }
    );

    expect(getByTestId('Varsayılan ağırlık-inline-display')).toHaveProp(
      'accessibilityValue',
      { text: '20 kilogram' }
    );
    expect(queryByTestId('weight-wheel-modal')).toBeNull();
  });
});

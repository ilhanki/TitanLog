import { fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';
import { Keyboard } from 'react-native';

import { WeightSelectorField } from '@/components/weight-selector-field';
import {
  getInlineWheelStep,
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
}: {
  disabled?: boolean;
  initialValue?: string;
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
      max={1000}
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
  it('maps downward movement to increase and upward movement to decrease', () => {
    expect(getInlineWheelStep(20)).toBe(1);
    expect(getInlineWheelStep(-20)).toBe(-1);
    expect(getInlineWheelStep(7)).toBe(0);
    expect(stepInlineNumericValue('50', 1, weightOptions)).toBe('52,5');
    expect(stepInlineNumericValue('50', -1, weightOptions)).toBe('47,5');
    expect(
      stepInlineNumericValue('12', 1, {
        formatValue: String,
        max: 1000,
        min: 1,
        parseValue: parseRepetitionInput,
        step: 1,
      })
    ).toBe('13');
    expect(
      stepInlineNumericValue('12', -1, {
        formatValue: String,
        max: 1000,
        min: 1,
        parseValue: parseRepetitionInput,
        step: 1,
      })
    ).toBe('11');
  });

  it('shows higher values above and lower values below without rounding exact drafts', () => {
    expect(getInlineWheelValues('50', weightOptions)).toEqual([
      '52,5',
      '50',
      '47,5',
    ]);
    expect(getInlineWheelValues('52,5', weightOptions)).toEqual([
      '55',
      '52,5',
      '50',
    ]);
    expect(getInlineWheelValues('18', weightOptions)).toEqual([
      '20,5',
      '18',
      '15,5',
    ]);
  });

  it('captures only deliberate vertical movement and leaves taps and horizontal gestures free', () => {
    expect(shouldCaptureInlineWheelGesture(0, 7)).toBe(false);
    expect(shouldCaptureInlineWheelGesture(12, 8)).toBe(false);
    expect(shouldCaptureInlineWheelGesture(0, 8)).toBe(true);
    expect(shouldCaptureInlineWheelGesture(0, -8)).toBe(true);
    expect(shouldCaptureInlineWheelGesture(0, 20, true)).toBe(false);
  });

  it('opens typing only after a tap and never opens an extra picker panel', async () => {
    const { getByTestId, queryByTestId } = await render(<WeightHarness />);
    const input = getByTestId('Lat Pulldown Kilo (kg)-inline-input');

    expect(input).toHaveProp('editable', true);
    expect(input).toHaveStyle({ opacity: 0 });
    await fireEvent.press(getByTestId('Lat Pulldown Kilo (kg)-inline-wheel'));
    expect(input).toHaveProp('editable', true);
    expect(input).not.toHaveStyle({ opacity: 0 });
    expect(input).toHaveProp('value', '50');
    expect(queryByTestId('weight-wheel-modal')).toBeNull();
  });

  it('accepts comma and period drafts, submits locally, and dismisses the keyboard', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    const { getByTestId } = await render(<WeightHarness />);
    const input = getByTestId('Lat Pulldown Kilo (kg)-inline-input');

    await fireEvent.press(getByTestId('Lat Pulldown Kilo (kg)-inline-wheel'));
    await fireEvent.changeText(input, '57,5');
    expect(input).toHaveProp('value', '57,5');
    await fireEvent.changeText(input, '57.5');
    await fireEvent(input, 'submitEditing');

    expect(input).toHaveProp('value', '57.5');
    expect(input).toHaveProp('editable', true);
    expect(dismiss).toHaveBeenCalled();
    dismiss.mockRestore();
  });

  it('restores the last valid draft on blur and keeps exact valid values', async () => {
    const { getByTestId } = await render(<WeightHarness initialValue="18" />);
    const input = getByTestId('Lat Pulldown Kilo (kg)-inline-input');

    await fireEvent.press(getByTestId('Lat Pulldown Kilo (kg)-inline-wheel'));
    await fireEvent.changeText(input, 'geçersiz');
    await fireEvent(input, 'blur');

    expect(input).toHaveProp('value', '18');
    expect(input).toHaveStyle({ opacity: 0 });
  });

  it('allows only one inline field to stay in typing mode', async () => {
    const { getByTestId } = await render(<TwoFieldHarness />);
    const weight = getByTestId('Lat Pulldown Kilo (kg)-inline-input');
    const repetitions = getByTestId('Lat Pulldown tekrar sayısı-inline-input');

    await fireEvent.press(getByTestId('Lat Pulldown Kilo (kg)-inline-wheel'));
    expect(weight).not.toHaveStyle({ opacity: 0 });
    await fireEvent.press(
      getByTestId('Lat Pulldown tekrar sayısı-inline-wheel')
    );

    expect(weight).toHaveStyle({ opacity: 0 });
    expect(repetitions).not.toHaveStyle({ opacity: 0 });
  });

  it('supports semantic accessible increment and decrement with the Turkish hint', async () => {
    const { getByTestId } = await render(<WeightHarness />);
    const field = getByTestId('Lat Pulldown Kilo (kg)-inline-input');

    expect(field).toHaveProp(
      'accessibilityHint',
      'Aşağı kaydırarak artır, yukarı kaydırarak azalt; yazmak için dokun.'
    );
    expect(field).toHaveProp('accessibilityValue', {
      text: '50 kilogram',
    });
    await fireEvent(field, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(getByTestId('Lat Pulldown Kilo (kg)-inline-input')).toHaveProp(
      'value',
      '52,5'
    );
    await fireEvent(
      getByTestId('Lat Pulldown Kilo (kg)-inline-input'),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'decrement' },
      }
    );
    expect(getByTestId('Lat Pulldown Kilo (kg)-inline-input')).toHaveProp(
      'value',
      '50'
    );
  });

  it('keeps completed or pending fields locked', async () => {
    const { getByTestId } = await render(<WeightHarness disabled />);
    const input = getByTestId('Lat Pulldown Kilo (kg)-inline-input');

    expect(input).toHaveProp('editable', false);
    await fireEvent(
      getByTestId('Lat Pulldown Kilo (kg)-inline-input'),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'increment' },
      }
    );
    expect(input).toHaveProp('value', '50');
  });

  it('keeps exercise default weight inline while body modal behavior stays separate', async () => {
    const { getByTestId, queryByTestId } = await render(
      <ExerciseDefaultWeightHarness />
    );

    await fireEvent(
      getByTestId('Varsayılan ağırlık-inline-input'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } }
    );

    expect(getByTestId('Varsayılan ağırlık-inline-input')).toHaveProp(
      'value',
      '20'
    );
    expect(queryByTestId('weight-wheel-modal')).toBeNull();
  });
});

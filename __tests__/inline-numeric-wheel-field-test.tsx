import { fireEvent, render } from '@testing-library/react-native';
import { useState } from 'react';

import { WeightSelectorField } from '@/components/weight-selector-field';
import {
  getInlineWheelStep,
  InlineNumericWheelField,
  stepInlineNumericValue,
} from '@/features/workouts/components/inline-numeric-wheel-field';
import {
  formatWorkoutWeight,
  parseRepetitionInput,
  parseWeightInput,
} from '@/features/workouts/utils/workout-values';

function WeightHarness({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState('50');
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
      value={value}
    />
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

describe('inline numeric wheel field', () => {
  it('steps valid exercise values and preserves invalid drafts', () => {
    const options = {
      formatValue: formatWorkoutWeight,
      max: 2000,
      min: 2.5,
      parseValue: parseWeightInput,
      step: 2.5,
    };

    expect(stepInlineNumericValue('50', 1, options)).toBe('52,5');
    expect(stepInlineNumericValue('2,5', -1, options)).toBe('2,5');
    expect(stepInlineNumericValue('taslak', 1, options)).toBe('taslak');
  });

  it('supports inline typing without opening an extra picker panel', async () => {
    const { getByLabelText, queryByTestId } = await render(<WeightHarness />);
    const input = getByLabelText('Lat Pulldown Kilo (kg)');

    await fireEvent.changeText(input, '57,5');

    expect(input).toHaveProp('value', '57,5');
    expect(input).toHaveProp('keyboardType', 'decimal-pad');
    expect(queryByTestId('weight-wheel-modal')).toBeNull();
  });

  it('supports accessible increment and decrement actions', async () => {
    const { getByLabelText } = await render(<WeightHarness />);
    const input = getByLabelText('Lat Pulldown Kilo (kg)');

    await fireEvent(input, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(input).toHaveProp('value', '52,5');
    await fireEvent(input, 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(input).toHaveProp('value', '50');
  });

  it('exposes vertical lock-wheel responders with deterministic direction', async () => {
    const { getByTestId } = await render(<WeightHarness />);
    const field = getByTestId('Lat Pulldown Kilo (kg)-inline-wheel');

    expect(field).toHaveProp('onMoveShouldSetResponderCapture');
    expect(field).toHaveProp('onResponderMove');
    expect(getInlineWheelStep(-20)).toBe(1);
    expect(getInlineWheelStep(20)).toBe(-1);
  });

  it('keeps completed or pending fields locked', async () => {
    const { getByLabelText } = await render(<WeightHarness disabled />);
    const input = getByLabelText('Lat Pulldown Kilo (kg)');

    expect(input).toHaveProp('editable', false);
    await fireEvent(input, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(input).toHaveProp('value', '50');
  });

  it('steps repetitions as whole numbers', () => {
    expect(
      stepInlineNumericValue('12', 1, {
        formatValue: String,
        max: 1000,
        min: 1,
        parseValue: parseRepetitionInput,
        step: 1,
      })
    ).toBe('13');
  });

  it('keeps exercise default weight inline while body modal behavior stays separate', async () => {
    const { getByLabelText, queryByTestId } = await render(
      <ExerciseDefaultWeightHarness />
    );
    const input = getByLabelText('Varsayılan ağırlık');

    await fireEvent(input, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });

    expect(input).toHaveProp('value', '20');
    expect(queryByTestId('weight-wheel-modal')).toBeNull();
  });
});

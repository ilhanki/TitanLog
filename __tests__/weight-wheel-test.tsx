import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useState } from 'react';

import {
  WheelPicker,
  createDescendingWheelOptions,
  resolveWheelValue,
} from '@/components/wheel-picker';
import {
  WeightWheelModal,
  combineBodyWeight,
  createExerciseWeightOptions,
} from '@/components/weight-wheel-modal';
import { appStrings } from '@/constants/strings';
import { WeightSelectorField } from '@/components/weight-selector-field';

function BodyWeightHarness() {
  const [weight, setWeight] = useState('114,8');
  const [target, setTarget] = useState('99,9');
  return (
    <>
      <WeightSelectorField
        kind="body"
        label="Vücut kilosu"
        onChangeText={setWeight}
        title="Kilonu Seç"
        value={weight}
      />
      <WeightSelectorField
        kind="body"
        label="Hedef kilosu"
        onChangeText={setTarget}
        title="Hedef Kilonu Seç"
        value={target}
      />
    </>
  );
}

describe('weight wheels', () => {
  it('orders larger values above smaller values and resolves exact snaps', () => {
    const options = createDescendingWheelOptions([75, 85, 80]);

    expect(options).toEqual([85, 80, 75]);
    expect(resolveWheelValue(options, 52)).toBe(80);
    expect(resolveWheelValue(options, 0)).toBe(85);
    expect(resolveWheelValue(options, 104)).toBe(75);
  });

  it('makes downward movement increase and upward movement decrease', () => {
    const options = createDescendingWheelOptions([75, 80, 85]);
    const centeredOffset = 52;

    expect(resolveWheelValue(options, centeredOffset - 52)).toBe(85);
    expect(resolveWheelValue(options, centeredOffset + 52)).toBe(75);
  });

  it('combines body whole and decimal wheels without string storage', () => {
    expect(combineBodyWeight(114, 8)).toBe(114.8);
  });

  it('preserves an exact non-step-aligned exercise value', () => {
    const options = createExerciseWeightOptions(17.3);

    expect(options).toContain(17.3);
    expect(options).toContain(17.5);
  });

  it('supports adjustable increment and decrement actions with units', async () => {
    const onChange = jest.fn();
    const { getByLabelText, rerender } = await render(
      <WheelPicker
        accessibilityLabel="Lat Pulldown ağırlığı"
        formatValue={String}
        onChange={onChange}
        options={[75, 80, 85]}
        unit="kilogram"
        value={80}
      />
    );
    const wheel = getByLabelText('Lat Pulldown ağırlığı');

    expect(wheel).toHaveProp('accessibilityValue', { text: '80 kilogram' });
    await fireEvent(wheel, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(onChange).toHaveBeenLastCalledWith(85);

    await rerender(
      <WheelPicker
        accessibilityLabel="Lat Pulldown ağırlığı"
        formatValue={String}
        onChange={onChange}
        options={[75, 80, 85]}
        unit="kilogram"
        value={80}
      />
    );
    await fireEvent(
      getByLabelText('Lat Pulldown ağırlığı'),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'decrement' },
      }
    );
    expect(onChange).toHaveBeenLastCalledWith(75);
  });

  it('centers persisted body values and applies the unchanged draft', async () => {
    const onApply = jest.fn();
    const { getByLabelText, getByRole } = await render(
      <WeightWheelModal
        accessibilityLabel="Vücut kilosu"
        kind="body"
        onApply={onApply}
        onCancel={jest.fn()}
        title="Kilonu Seç"
        value={114.8}
        visible
      />
    );

    await waitFor(() =>
      expect(getByLabelText('Kilonu Seç tam kilogram')).toHaveProp(
        'accessibilityValue',
        { text: '114 kilogram' }
      )
    );
    expect(getByLabelText('Kilonu Seç ondalık')).toHaveProp(
      'accessibilityValue',
      { text: '8 ondalık' }
    );
    await fireEvent.press(
      getByRole('button', { name: appStrings.common.apply })
    );
    expect(onApply).toHaveBeenCalledWith(114.8);
  });

  it.each([
    ['114,8', 114.8],
    ['114.8', 114.8],
  ])('applies valid manual body input %s', async (input, expected) => {
    const onApply = jest.fn();
    const { getByLabelText, getByRole } = await render(
      <WeightWheelModal
        accessibilityLabel="Vücut kilosu"
        kind="body"
        onApply={onApply}
        onCancel={jest.fn()}
        title="Kilonu Seç"
        value={100}
        visible
      />
    );

    await waitFor(() =>
      expect(
        getByRole('button', { name: appStrings.common.manualEntry })
      ).toBeTruthy()
    );
    await fireEvent.press(
      getByRole('button', { name: appStrings.common.manualEntry })
    );
    await fireEvent.changeText(
      getByLabelText(appStrings.common.manualEntry),
      input
    );
    await fireEvent.press(
      getByRole('button', { name: appStrings.common.apply })
    );

    expect(onApply).toHaveBeenCalledWith(expected);
  });

  it('rejects invalid manual input and cancellation discards the draft', async () => {
    const onApply = jest.fn();
    const onCancel = jest.fn();
    const { getAllByLabelText, getByLabelText, getByRole, getByText } =
      await render(
        <WeightWheelModal
          accessibilityLabel="Vücut kilosu"
          kind="body"
          onApply={onApply}
          onCancel={onCancel}
          title="Kilonu Seç"
          value={100}
          visible
        />
      );
    await waitFor(() =>
      expect(
        getByRole('button', { name: appStrings.common.manualEntry })
      ).toBeTruthy()
    );
    await fireEvent.press(
      getByRole('button', { name: appStrings.common.manualEntry })
    );
    await fireEvent.changeText(
      getByLabelText(appStrings.common.manualEntry),
      '999'
    );
    await fireEvent.press(
      getByRole('button', { name: appStrings.common.apply })
    );

    expect(getByText(appStrings.progress.invalidWeight)).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
    await fireEvent.press(getAllByLabelText(appStrings.common.cancel)[0]!);
    expect(onCancel).toHaveBeenCalled();
  });

  it('applies body wheel confirmation without resetting unrelated fields', async () => {
    const { getByLabelText, getByRole } = await render(<BodyWeightHarness />);
    await fireEvent(getByLabelText('Vücut kilosu'), 'focus');
    const decimalWheel = await waitFor(() =>
      getByLabelText('Kilonu Seç ondalık')
    );
    await fireEvent(decimalWheel, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    await fireEvent.press(
      getByRole('button', { name: appStrings.common.apply })
    );

    expect(getByLabelText('Vücut kilosu')).toHaveProp('value', '114,9');
    expect(getByLabelText('Hedef kilosu')).toHaveProp('value', '99,9');
  });

  it('discards wheel changes on cancel', async () => {
    const { getAllByLabelText, getByLabelText } = await render(
      <BodyWeightHarness />
    );
    await fireEvent(getByLabelText('Vücut kilosu'), 'focus');
    const decimalWheel = await waitFor(() =>
      getByLabelText('Kilonu Seç ondalık')
    );
    await fireEvent(decimalWheel, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    await fireEvent.press(getAllByLabelText(appStrings.common.cancel)[0]!);

    expect(getByLabelText('Vücut kilosu')).toHaveProp('value', '114,8');
  });

  it('does not include external wheel or legacy gradient packages', () => {
    const dependencies = require('../package.json').dependencies;

    expect(dependencies).not.toHaveProperty('react-native-wheel-picker');
    expect(dependencies).not.toHaveProperty('expo-linear-gradient');
  });
});

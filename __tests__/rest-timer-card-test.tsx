import { fireEvent, render } from '@testing-library/react-native';

import { RestTimerCard } from '@/features/workouts/components/rest-timer-card';
import { createRestTimerState } from '@/features/workouts/domain/rest-timer';

describe('rest timer card', () => {
  const now = Date.parse('2026-08-05T10:00:00.000Z');

  it('offers every quick preset and announces the idle state', async () => {
    const onStart = jest.fn();
    const { getByLabelText } = await render(
      <RestTimerCard
        now={now}
        onAdjust={jest.fn()}
        onCancel={jest.fn()}
        onStart={onStart}
        timer={null}
      />
    );

    for (const seconds of [30, 60, 90, 120, 180])
      expect(getByLabelText(`${seconds} saniye dinlenme başlat`)).toBeTruthy();
    await fireEvent.press(getByLabelText('120 saniye dinlenme başlat'));
    expect(onStart).toHaveBeenCalledWith(120);
    expect(getByLabelText('Dinlenme zamanlayıcısı hazır.')).toBeTruthy();
  });

  it('shows deadline-derived remaining time and one-hand controls', async () => {
    const onAdjust = jest.fn();
    const onCancel = jest.fn();
    const timer = createRestTimerState(90, now, 7);
    const { getByLabelText, getByText } = await render(
      <RestTimerCard
        exerciseName="Squat"
        now={now + 30_000}
        onAdjust={onAdjust}
        onCancel={onCancel}
        onStart={jest.fn()}
        timer={timer}
      />
    );

    expect(
      getByLabelText('Dinlenme zamanı, 60 saniye kaldı, Squat.')
    ).toBeTruthy();
    expect(getByText('1:00')).toBeTruthy();
    await fireEvent.press(getByText('+15 sn'));
    await fireEvent.press(getByText('Atla'));
    expect(onAdjust).toHaveBeenCalledWith(15);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

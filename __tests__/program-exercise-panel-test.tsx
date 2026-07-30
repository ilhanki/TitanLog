import { render } from '@testing-library/react-native';

import {
  getProgramExerciseDropIndex,
  PROGRAM_REORDER_LONG_PRESS_DELAY,
  ProgramExercisePanel,
} from '@/features/workouts/components/program-exercise-panel';

const exercise = {
  equipment: 'Cable machine',
  id: 11,
  muscleGroup: 'Sırt',
  name: 'Lat Pulldown',
  setCount: 3,
  sortOrder: 1,
  targetReps: 12,
  weightKg: 50,
  weightMode: 'total' as const,
};

function renderPanel(overrides = {}) {
  const props = {
    exercise,
    index: 0,
    onAccessibleMove: jest.fn(),
    onDragCancel: jest.fn(),
    onDragEnd: jest.fn(),
    onDragMove: jest.fn(),
    onDragStart: jest.fn(),
    onEditDefaults: jest.fn(),
    onOpenHistory: jest.fn(),
    onRemove: jest.fn(),
    totalCount: 3,
    ...overrides,
  };
  return { props, result: render(<ProgramExercisePanel {...props} />) };
}

describe('program exercise panel', () => {
  it('calculates bounded first, middle, last, and unchanged drop targets', () => {
    expect(getProgramExerciseDropIndex(1, 0, 3)).toBe(1);
    expect(getProgramExerciseDropIndex(1, -200, 3)).toBe(0);
    expect(getProgramExerciseDropIndex(1, 200, 3)).toBe(2);
    expect(getProgramExerciseDropIndex(0, -500, 3)).toBe(0);
    expect(getProgramExerciseDropIndex(2, 500, 3)).toBe(2);
  });

  it('renders the compact hierarchy, handle, and three restrained actions', async () => {
    const { result } = renderPanel();
    const { getByRole, getByTestId, getByText, queryByText } = await result;

    expect(getByText('Lat Pulldown')).toBeTruthy();
    expect(getByText('3 set · 12 tekrar · 50 kg')).toBeTruthy();
    expect(getByText('Sırt · Cable machine')).toBeTruthy();
    expect(getByTestId('program-exercise-drag-handle-11')).toHaveProp(
      'accessibilityRole',
      'adjustable'
    );
    expect(
      getByRole('button', { name: 'Lat Pulldown geçmişini aç' })
    ).toBeTruthy();
    expect(
      getByRole('button', {
        name: 'Lat Pulldown varsayılanlarını düzenle',
      })
    ).toBeTruthy();
    expect(
      getByRole('button', {
        name: 'Lat Pulldown hareketini program gününden kaldır',
      })
    ).toBeTruthy();
    expect(queryByText('Yukarı Taşı')).toBeNull();
    expect(queryByText('Aşağı Taşı')).toBeNull();
  });

  it('configures the handle-only responder with a deliberate long-press delay', async () => {
    const { result } = renderPanel();
    const { getByTestId } = await result;
    const handle = getByTestId('program-exercise-drag-handle-11');

    expect(handle).toHaveProp('onStartShouldSetResponder');
    expect(handle).toHaveProp('onResponderGrant');
    expect(handle).toHaveProp('onResponderMove');
    expect(PROGRAM_REORDER_LONG_PRESS_DELAY).toBeGreaterThanOrEqual(200);
    expect(PROGRAM_REORDER_LONG_PRESS_DELAY).toBeLessThanOrEqual(350);
  });

  it('offers only available boundary accessibility actions', async () => {
    const first = renderPanel();
    const firstHandle = (await first.result).getByTestId(
      'program-exercise-drag-handle-11'
    );
    expect(firstHandle).toHaveProp('accessibilityActions', [
      { label: 'Aşağı Taşı', name: 'moveDown' },
    ]);

    await first.result.then((result) => result.unmount());
    const last = renderPanel({ index: 2 });
    expect(
      (await last.result).getByTestId('program-exercise-drag-handle-11')
    ).toHaveProp('accessibilityActions', [
      { label: 'Yukarı Taşı', name: 'moveUp' },
    ]);
  });
});

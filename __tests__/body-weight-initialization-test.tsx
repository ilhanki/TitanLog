import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useEffect, type EffectCallback } from 'react';

import { appStrings } from '@/constants/strings';
import { resolveWeightSelectorValue } from '@/components/weight-selector-field';
import { AddMeasurementScreen } from '@/features/body/screens/add-measurement-screen';
import { BodySettingsScreen } from '@/features/body/screens/body-settings-screen';

const mockGetLatestMeasurement = jest.fn();
const mockGetProfile = jest.fn();
const mockCreateMeasurement = jest.fn();
const mockUpdateTargetWeight = jest.fn();
const mockRouter = { back: jest.fn(), replace: jest.fn() };
const mockNavigation = {
  addListener: jest.fn(() => jest.fn()),
  dispatch: jest.fn(),
};
const mockDatabase = {};
const mockUseEffect = useEffect;

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: EffectCallback) => mockUseEffect(effect, [effect]),
  useRouter: () => mockRouter,
  useNavigation: () => mockNavigation,
}));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDatabase }));
jest.mock('@/features/body/data/body-measurement-repository', () => ({
  createBodyMeasurementRepository: () => ({
    createMeasurement: mockCreateMeasurement,
    getLatestMeasurement: mockGetLatestMeasurement,
  }),
}));
jest.mock('@/features/body/data/body-profile-repository', () => ({
  ...jest.requireActual('@/features/body/data/body-profile-repository'),
  createBodyProfileRepository: () => ({
    getProfile: mockGetProfile,
    updateTargetWeight: mockUpdateTargetWeight,
  }),
}));

const profile = {
  createdAt: '2026-07-01T10:00:00.000Z',
  id: 1,
  startingWeightKg: 119.6,
  targetWeightKg: 99.9,
  updatedAt: '2026-07-01T10:00:00.000Z',
};

const latestMeasurement = {
  chestCm: null,
  createdAt: '2026-07-30T10:00:00.000Z',
  hipCm: null,
  id: 4,
  measuredAt: '2026-07-30T10:00:00.000Z',
  note: null,
  thighCm: null,
  upperArmCm: null,
  updatedAt: '2026-07-30T10:00:00.000Z',
  waistCm: null,
  weightKg: 112.4,
};

describe('body weight initialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProfile.mockResolvedValue(profile);
    mockGetLatestMeasurement.mockResolvedValue(latestMeasurement);
    mockCreateMeasurement.mockResolvedValue({ id: 5 });
    mockUpdateTargetWeight.mockResolvedValue(undefined);
  });

  it('prefers valid drafts and persisted fallbacks without a fake body default', () => {
    expect(resolveWeightSelectorValue('114,8', 'body', 112.4)).toBe(114.8);
    expect(resolveWeightSelectorValue('', 'body', 112.4)).toBe(112.4);
    expect(resolveWeightSelectorValue('', 'body')).toBeNull();
    expect(resolveWeightSelectorValue('', 'exercise')).toBe(2.5);
  });

  it('shows loading instead of a 70 kg draft while persisted weight loads', async () => {
    let resolveLatest: (value: typeof latestMeasurement) => void = () =>
      undefined;
    mockGetLatestMeasurement.mockReturnValue(
      new Promise<typeof latestMeasurement>((resolve) => {
        resolveLatest = resolve;
      })
    );
    const screen = await render(<AddMeasurementScreen />);

    expect(screen.getByText(appStrings.progress.loading)).toBeTruthy();
    expect(screen.queryByLabelText(appStrings.progress.weight)).toBeNull();

    await act(async () => resolveLatest(latestMeasurement));
    await waitFor(() =>
      expect(screen.getByLabelText(appStrings.progress.weight)).toHaveProp(
        'value',
        '112,4'
      )
    );
  });

  it('opens a new measurement from the latest persisted weight', async () => {
    const screen = await render(<AddMeasurementScreen />);
    const field = await waitFor(() =>
      screen.getByLabelText(appStrings.progress.weight)
    );

    expect(field).toHaveProp('value', '112,4');
    await fireEvent(field, 'focus');
    expect(screen.getByLabelText('Kilonu Seç tam kilogram')).toHaveProp(
      'accessibilityValue',
      { text: '112 kilogram' }
    );
    expect(screen.getByLabelText('Kilonu Seç ondalık')).toHaveProp(
      'accessibilityValue',
      { text: '4 ondalık' }
    );
  });

  it('uses profile weight only when no measurement exists', async () => {
    mockGetLatestMeasurement.mockResolvedValue(null);
    const screen = await render(<AddMeasurementScreen />);

    await waitFor(() =>
      expect(screen.getByLabelText(appStrings.progress.weight)).toHaveProp(
        'value',
        '119,6'
      )
    );
  });

  it('keeps current and target weight sources isolated in body settings', async () => {
    const screen = await render(<BodySettingsScreen />);

    await waitFor(() => {
      expect(screen.getByText('112,4 kg')).toBeTruthy();
      expect(screen.getByLabelText('Hedef Kilo')).toHaveProp('value', '99,9');
    });
    expect(
      screen.queryByLabelText(appStrings.progress.startingWeight)
    ).toBeNull();
  });

  it('saves one new measurement from the latest-weight draft and closes after success', async () => {
    const screen = await render(<AddMeasurementScreen />);
    const weight = await waitFor(() =>
      screen.getByLabelText(appStrings.progress.weight)
    );
    await fireEvent.changeText(weight, '111,8');
    await fireEvent.press(screen.getByRole('button', { name: 'Kaydet' }));

    await waitFor(() => expect(mockCreateMeasurement).toHaveBeenCalledTimes(1));
    expect(mockCreateMeasurement).toHaveBeenCalledWith(
      expect.objectContaining({ weightKg: 111.8 })
    );
    expect(mockRouter.replace).toHaveBeenCalledWith('/progress');
  });

  it('updates only the target draft while keeping current weight read-only', async () => {
    const screen = await render(<BodySettingsScreen />);
    const target = await waitFor(() => screen.getByLabelText('Hedef Kilo'));
    await fireEvent.changeText(target, '95,5');
    await fireEvent.press(screen.getByRole('button', { name: 'Kaydet' }));

    await waitFor(() =>
      expect(mockUpdateTargetWeight).toHaveBeenCalledWith(95.5)
    );
    expect(mockUpdateTargetWeight).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByLabelText(appStrings.progress.startingWeight)
    ).toBeNull();
    expect(mockRouter.replace).toHaveBeenCalledWith('/progress');
  });

  it('preserves the target draft after a failed save', async () => {
    mockUpdateTargetWeight.mockRejectedValueOnce(new Error('controlled'));
    const screen = await render(<BodySettingsScreen />);
    const target = await waitFor(() => screen.getByLabelText('Hedef Kilo'));
    await fireEvent.changeText(target, '95,5');
    await fireEvent.press(screen.getByRole('button', { name: 'Kaydet' }));

    await waitFor(() =>
      expect(screen.getByText(appStrings.progress.saveError)).toBeTruthy()
    );
    expect(screen.getByLabelText('Hedef Kilo')).toHaveProp('value', '95,5');
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

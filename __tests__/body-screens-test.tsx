import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { appStrings } from '@/constants/strings';
import { BodyMeasurementForm } from '@/features/body/components/body-measurement-form';
import type { BodyOverview } from '@/features/body/hooks/use-body-overview';
import { ProgressScreen } from '@/features/progress/progress-screen';

const mockRouter = { navigate: jest.fn(), push: jest.fn() };
const mockCreateProfile = jest.fn();
type MockOverview = {
  data: BodyOverview;
  error: boolean;
  loading: boolean;
  retry: jest.Mock;
};

let mockOverview: MockOverview;

function createEmptyOverview(): MockOverview {
  return {
    data: {
      latest: null,
      measurements: [],
      previous: null,
      profile: null,
      progress: null,
    },
    error: false,
    loading: false,
    retry: jest.fn(),
  };
}

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));
jest.mock('@/features/body/hooks/use-body-overview', () => ({
  useBodyOverview: () => mockOverview,
}));
jest.mock('@/features/body/data/body-profile-repository', () => ({
  createBodyProfileRepository: () => ({
    createProfileWithInitialMeasurement: mockCreateProfile,
  }),
}));

describe('body progress screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOverview = createEmptyOverview();
  });

  it('renders profile setup when no profile exists', async () => {
    const { getByLabelText, getByText } = await render(<ProgressScreen />);

    expect(getByText(appStrings.progress.setupTitle)).toBeTruthy();
    expect(getByLabelText(appStrings.progress.startingWeight)).toBeTruthy();
    expect(getByLabelText(appStrings.progress.targetWeight)).toBeTruthy();
  });

  it('renders a real summary and truthful single-measurement history', async () => {
    const measurement = {
      chestCm: null,
      createdAt: '2026-08-01T10:00:00.000Z',
      hipCm: null,
      id: 1,
      measuredAt: '2026-08-01T10:00:00.000Z',
      note: null,
      thighCm: null,
      upperArmCm: null,
      updatedAt: '2026-08-01T10:00:00.000Z',
      waistCm: null,
      weightKg: 75,
    };
    mockOverview = {
      ...createEmptyOverview(),
      data: {
        latest: measurement,
        measurements: [measurement],
        previous: null,
        profile: {
          createdAt: measurement.createdAt,
          id: 1,
          startingWeightKg: 80,
          targetWeightKg: 70,
          updatedAt: measurement.updatedAt,
        },
        progress: {
          changeFromPreviousKg: null,
          currentWeightKg: 75,
          direction: 'loss' as const,
          progress: 0.5,
          progressPercentage: 50,
          remainingWeightKg: 5,
          targetReached: false,
          totalChangeKg: -5,
        },
      },
    };

    const { getAllByText, getByText } = await render(<ProgressScreen />);

    expect(getAllByText('75 kg').length).toBeGreaterThan(0);
    expect(getByText('%50')).toBeTruthy();
    expect(getByText(appStrings.progress.noExtraMeasurement)).toBeTruthy();
    expect(getByText(appStrings.progress.noPreviousChange)).toBeTruthy();
  });

  it('validates required weight in the measurement form', async () => {
    const onSubmit = jest.fn();
    const { getByRole, getByText } = await render(
      <BodyMeasurementForm
        onSubmit={onSubmit}
        pending={false}
        submitLabel={appStrings.progress.saveMeasurement}
      />
    );

    fireEvent.press(
      getByRole('button', { name: appStrings.progress.saveMeasurement })
    );

    await waitFor(() => {
      expect(getByText(appStrings.progress.invalidWeight)).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

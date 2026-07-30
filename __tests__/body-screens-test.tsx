import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { appStrings } from '@/constants/strings';
import { BodyMeasurementForm } from '@/features/body/components/body-measurement-form';
import type {
  BodyMeasurement,
  BodyProfile,
} from '@/features/body/domain/models';
import type { BodyOverview } from '@/features/body/hooks/use-body-overview';
import { createBodyWeightSummary } from '@/features/body/utils/body-values';
import { ProgressScreen } from '@/features/progress/progress-screen';

const mockRouter = { navigate: jest.fn(), push: jest.fn() };
const mockCreateProfile = jest.fn();
const mockLoadMore = jest.fn();
type MockOverview = {
  data: BodyOverview;
  error: boolean;
  hasMore: boolean;
  loadMore: jest.Mock;
  loading: boolean;
  retry: jest.Mock;
};

let mockOverview: MockOverview;

const profile: BodyProfile = {
  createdAt: '2026-07-01T10:00:00.000Z',
  id: 1,
  startingWeightKg: 80,
  targetWeightKg: 70,
  updatedAt: '2026-07-01T10:00:00.000Z',
};

const measurement = (
  id: number,
  weightKg: number,
  measuredAt: string
): BodyMeasurement => ({
  chestCm: null,
  createdAt: measuredAt,
  hipCm: null,
  id,
  measuredAt,
  note: null,
  thighCm: null,
  upperArmCm: null,
  updatedAt: measuredAt,
  waistCm: null,
  weightKg,
});

function createEmptyOverview(): MockOverview {
  return {
    data: {
      latest: null,
      measurementCount: 0,
      measurements: [],
      previous: null,
      profile: null,
      progress: null,
      summary: null,
    },
    error: false,
    hasMore: false,
    loadMore: mockLoadMore,
    loading: false,
    retry: jest.fn(),
  };
}

function createLoadedOverview(measurements: BodyMeasurement[]): MockOverview {
  const summary = createBodyWeightSummary(
    profile,
    measurements,
    measurements.length
  )!;
  return {
    ...createEmptyOverview(),
    data: {
      latest: measurements[0] ?? null,
      measurementCount: measurements.length,
      measurements,
      previous: measurements[1] ?? null,
      profile,
      progress: summary.progress,
      summary,
    },
  };
}

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));
jest.mock('@/features/body/hooks/use-body-overview', () => ({
  useBodyOverview: () => mockOverview,
}));
jest.mock('@/features/body/data/body-profile-repository', () => {
  const actual = jest.requireActual(
    '@/features/body/data/body-profile-repository'
  );
  return {
    ...actual,
    createBodyProfileRepository: () => ({
      createProfileWithInitialMeasurement: mockCreateProfile,
    }),
  };
});

describe('body progress screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOverview = createEmptyOverview();
    mockCreateProfile.mockResolvedValue(undefined);
  });

  it('renders a truthful profile setup without fake body values', async () => {
    const { getByLabelText, getByText, queryByText } = await render(
      <ProgressScreen />
    );

    expect(getByText('Gelişimini Takip Et')).toBeTruthy();
    expect(getByLabelText(appStrings.progress.startingWeight)).toBeTruthy();
    expect(getByLabelText(appStrings.progress.targetWeight)).toBeTruthy();
    expect(queryByText(/70 kg/)).toBeNull();
  });

  it.each([
    ['119,6', '99,9', 119.6, 99.9],
    ['110.0', '120.0', 110, 120],
  ])(
    'submits comma and period profile values as numbers',
    async (startingInput, targetInput, starting, target) => {
      const { getByLabelText, getByRole } = await render(<ProgressScreen />);
      await fireEvent.changeText(
        getByLabelText(appStrings.progress.startingWeight),
        startingInput
      );
      await fireEvent.changeText(
        getByLabelText(appStrings.progress.targetWeight),
        targetInput
      );
      await fireEvent.press(
        getByRole('button', { name: appStrings.progress.saveGoal })
      );
      await waitFor(() =>
        expect(mockCreateProfile).toHaveBeenCalledWith(starting, target)
      );
    }
  );

  it('renders loading without current, target, or fallback numbers', async () => {
    mockOverview = { ...createEmptyOverview(), loading: true };
    const { getByText, queryByText } = await render(<ProgressScreen />);

    expect(getByText('Verilerin hazırlanıyor')).toBeTruthy();
    expect(queryByText(/70|0 kg|— kg/)).toBeNull();
  });

  it('renders the dominant current weight, rail, statistics, and newest-first rows', async () => {
    const newest = measurement(2, 75, '2026-08-01T10:00:00.000Z');
    const oldest = measurement(1, 76, '2026-07-01T10:00:00.000Z');
    mockOverview = createLoadedOverview([newest, oldest]);
    const screen = await render(<ProgressScreen />);

    expect(screen.getAllByText('75 kg').length).toBeGreaterThan(0);
    expect(screen.getByText('Başlangıçtan')).toBeTruthy();
    expect(screen.getAllByText('Hedefe Kalan').length).toBeGreaterThan(0);
    expect(screen.getByText('Ölçüm Sayısı')).toBeTruthy();
    expect(screen.getAllByText('Son Ölçüm').length).toBeGreaterThan(0);
    expect(screen.getByText('Önceki ölçüme göre -1 kg')).toBeTruthy();
    expect(screen.getByText('İlk ölçüm')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain('"horizontal":true');
  });

  it('uses profile weight as a clearly labelled fallback when measurements are absent', async () => {
    mockOverview = createLoadedOverview([]);
    const { getAllByText, getByText } = await render(<ProgressScreen />);

    expect(getAllByText('80 kg').length).toBeGreaterThan(0);
    expect(
      getByText('Profil başlangıç değeri · Henüz ölçüm değil')
    ).toBeTruthy();
    expect(getAllByText('Henüz ölçüm eklenmedi').length).toBeGreaterThan(0);
  });

  it('opens new-measurement and target modal routes from the primary actions', async () => {
    mockOverview = createLoadedOverview([
      measurement(1, 75, '2026-08-01T10:00:00.000Z'),
    ]);
    const { getByRole } = await render(<ProgressScreen />);

    await fireEvent.press(getByRole('button', { name: 'Yeni Ölçüm' }));
    await fireEvent.press(getByRole('button', { name: 'Hedefi Düzenle' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/progress/add');
    expect(mockRouter.push).toHaveBeenCalledWith('/progress/settings');
  });

  it('keeps repository errors truthful and retryable', async () => {
    mockOverview = { ...createEmptyOverview(), error: true };
    const { getByRole, getByText } = await render(<ProgressScreen />);

    expect(getByText(appStrings.progress.loadError)).toBeTruthy();
    await fireEvent.press(
      getByRole('button', { name: appStrings.progress.retry })
    );
    expect(mockOverview.retry).toHaveBeenCalledTimes(1);
  });

  it('validates required weight and blocks rapid duplicate measurement form submissions', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const screen = await render(
      <BodyMeasurementForm
        onSubmit={onSubmit}
        pending={false}
        submitLabel="Kaydet"
      />
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Kaydet' }));
    expect(screen.getByText(appStrings.progress.invalidWeight)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders only schema-supported measurement fields and reports dirty drafts', async () => {
    const onCancel = jest.fn();
    const onDirtyChange = jest.fn();
    const screen = await render(
      <BodyMeasurementForm
        initialWeightKg={75}
        onCancel={onCancel}
        onDirtyChange={onDirtyChange}
        onSubmit={jest.fn()}
        pending={false}
        submitLabel="Kaydet"
      />
    );

    expect(screen.getByLabelText('Bel Çevresi (cm)')).toBeTruthy();
    expect(screen.getByLabelText('Göğüs Çevresi (cm)')).toBeTruthy();
    expect(screen.getByLabelText('Üst Kol Çevresi (cm)')).toBeTruthy();
    expect(screen.getByLabelText('Kalça Çevresi (cm)')).toBeTruthy();
    expect(screen.getByLabelText('Uyluk Çevresi (cm)')).toBeTruthy();
    expect(screen.queryByText(/BMI|Yağ Oranı/i)).toBeNull();
    await fireEvent.changeText(
      screen.getByLabelText('Bel Çevresi (cm)'),
      '82,5'
    );
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Kapat' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('allows only one pending measurement submission', async () => {
    let finish: (() => void) | undefined;
    const onSubmit = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const screen = await render(
      <BodyMeasurementForm
        initialWeightKg={75}
        onSubmit={onSubmit}
        pending={false}
        submitLabel="Kaydet"
      />
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Kaydet' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Kaydet' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    finish?.();
  });
});

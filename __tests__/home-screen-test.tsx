import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type {
  BodyMeasurement,
  BodyProfile,
} from '@/features/body/domain/models';
import type { BodyOverview } from '@/features/body/hooks/use-body-overview';
import { createBodyWeightSummary } from '@/features/body/utils/body-values';
import { HomeScreen } from '@/features/home/home-screen';
import type {
  CompletedWorkoutSummary,
  WorkoutDayDetails,
  WorkoutPlan,
  WorkoutSession,
} from '@/features/workouts/domain/models';

const mockRouter = { navigate: jest.fn(), push: jest.fn() };
const mockStartSession = jest.fn();

const scheduledWorkout: WorkoutDayDetails = {
  exerciseCount: 7,
  exercisePreview: ['Lat Pulldown'],
  exercises: [],
  id: 1,
  name: 'Sırt + Biceps',
  scheduleWeekdays: [1, 4],
  sortOrder: 1,
  totalSetCount: 21,
  subtitle: 'Sırt ve kol',
};
const plan: WorkoutPlan = {
  days: [scheduledWorkout],
  description: 'Başlangıç programı',
  id: 1,
  name: 'Titan Programı',
};

const emptyBodyData: BodyOverview = {
  latest: null,
  measurementCount: 0,
  measurements: [],
  previous: null,
  profile: null,
  progress: null,
  summary: null,
};

let mockBodyOverview = {
  data: emptyBodyData,
  error: false,
  hasMore: false,
  loadMore: jest.fn(),
  loading: false,
  retry: jest.fn(),
};
let mockOverview = {
  data: {
    activeSession: null as WorkoutSession | null,
    completedSessionCount: 0,
    plan: plan as WorkoutPlan | null,
    recentSessions: [] as CompletedWorkoutSummary[],
    scheduledWorkout: scheduledWorkout as WorkoutDayDetails | null,
  },
  error: false,
  errors: { core: false, recent: false, statistics: false },
  loading: false,
  retry: jest.fn(),
};

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));
jest.mock('@/features/workouts/hooks/use-workout-overview', () => ({
  useWorkoutOverview: () => mockOverview,
}));
jest.mock('@/features/body/hooks/use-body-overview', () => ({
  useBodyOverview: () => mockBodyOverview,
}));
jest.mock('@/features/workouts/data/workout-session-repository', () => ({
  createWorkoutSessionRepository: () => ({
    startSessionFromWorkoutDay: mockStartSession,
  }),
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartSession.mockResolvedValue({ id: 88 });
    mockBodyOverview = {
      data: emptyBodyData,
      error: false,
      hasMore: false,
      loadMore: jest.fn(),
      loading: false,
      retry: jest.fn(),
    };
    mockOverview = {
      data: {
        activeSession: null,
        completedSessionCount: 0,
        plan,
        recentSessions: [],
        scheduledWorkout,
      },
      error: false,
      errors: { core: false, recent: false, statistics: false },
      loading: false,
      retry: jest.fn(),
    };
  });

  it('prioritizes an active workout over the scheduled workout', async () => {
    mockOverview.data.activeSession = {
      cancelledAt: null,
      completedAt: null,
      exercises: [
        {
          exerciseId: 11,
          id: 101,
          muscleGroup: 'Sırt',
          name: 'Lat Pulldown',
          sets: [
            {
              actualReps: 12,
              completedAt: '2026-07-30T10:05:00.000Z',
              id: 1,
              isCompleted: true,
              setNumber: 1,
              targetReps: 12,
              weightKg: 50,
            },
            {
              actualReps: null,
              completedAt: null,
              id: 2,
              isCompleted: false,
              setNumber: 2,
              targetReps: 12,
              weightKg: 50,
            },
          ],
          sortOrder: 1,
          weightMode: 'total',
        },
      ],
      id: 9,
      startedAt: '2026-07-30T10:00:00.000Z',
      status: 'active',
      workoutDayId: 1,
      workoutName: 'Aktif Sırt',
    };
    const screen = await render(<HomeScreen />);

    expect(screen.getByText('Aktif Sırt')).toBeTruthy();
    expect(screen.getByText('1 / 2 set tamamlandı')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Antrenmana Devam Et' })
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Antrenmanı Başlat' })
    ).toBeNull();
  });

  it('shows and starts the scheduled workout when no session is active', async () => {
    const { getByRole, getByText } = await render(<HomeScreen />);
    expect(getByText('7 hareket · 21 set')).toBeTruthy();

    await fireEvent.press(getByRole('button', { name: 'Antrenmanı Başlat' }));
    await waitFor(() => {
      expect(mockStartSession).toHaveBeenCalledWith(1);
      expect(mockRouter.navigate).toHaveBeenCalledWith('/workout/session/88');
    });
  });

  it('shows a truthful no-schedule state when a program exists', async () => {
    mockOverview.data.scheduledWorkout = null;
    const screen = await render(<HomeScreen />);
    expect(screen.getByText('Planlanmış antrenman yok')).toBeTruthy();
  });

  it('shows a compact setup action when no program exists', async () => {
    mockOverview.data.scheduledWorkout = null;
    mockOverview.data.plan = null;
    const noProgram = await render(<HomeScreen />);
    expect(noProgram.getByText('Program henüz hazır değil')).toBeTruthy();
    expect(
      noProgram.getByRole('button', { name: 'Programı Düzenle' })
    ).toBeTruthy();
  });

  it('renders a persisted progress snapshot without fake metrics', async () => {
    const profile: BodyProfile = {
      createdAt: '2026-07-01T10:00:00.000Z',
      id: 1,
      startingWeightKg: 80,
      targetWeightKg: 70,
      updatedAt: '2026-07-01T10:00:00.000Z',
    };
    const latest: BodyMeasurement = {
      chestCm: null,
      createdAt: '2026-07-30T10:00:00.000Z',
      hipCm: null,
      id: 2,
      measuredAt: '2026-07-30T10:00:00.000Z',
      note: null,
      thighCm: null,
      upperArmCm: null,
      updatedAt: '2026-07-30T10:00:00.000Z',
      waistCm: null,
      weightKg: 75,
    };
    const summary = createBodyWeightSummary(profile, [latest], 1)!;
    mockBodyOverview = {
      ...mockBodyOverview,
      data: {
        latest,
        measurementCount: 1,
        measurements: [latest],
        previous: null,
        profile,
        progress: summary.progress,
        summary,
      },
    };
    const screen = await render(<HomeScreen />);

    expect(screen.getAllByText('75 kg').length).toBeGreaterThan(0);
    expect(screen.getByText('70 kg')).toBeTruthy();
    expect(screen.queryByText(/0 kg.*Son Hacim/)).toBeNull();
  });

  it('keeps the workout action visible when the body summary fails', async () => {
    mockBodyOverview = { ...mockBodyOverview, error: true };
    const screen = await render(<HomeScreen />);

    expect(
      screen.getByRole('button', { name: 'Antrenmanı Başlat' })
    ).toBeTruthy();
    expect(screen.getByText('Gelişim özeti yüklenemedi')).toBeTruthy();
  });

  it('keeps active workout visible when recent activity fails', async () => {
    mockOverview.errors.recent = true;
    const screen = await render(<HomeScreen />);

    expect(screen.getByText('Sırt + Biceps')).toBeTruthy();
    expect(
      screen.getByText('Son antrenman bilgisi şu anda yüklenemedi.')
    ).toBeTruthy();
  });

  it('opens the latest completed workout and renders only three quick actions', async () => {
    const latestWorkout: CompletedWorkoutSummary = {
      completedAt: '2026-07-28T19:12:00.000Z',
      completedSetCount: 19,
      durationMinutes: 72,
      exerciseNames: ['Lat Pulldown'],
      id: 77,
      startedAt: '2026-07-28T18:00:00.000Z',
      totalRepetitions: 228,
      totalVolume: 8640,
      workoutDayId: 1,
      workoutName: 'Sırt + Biceps',
    };
    mockOverview.data.recentSessions = [latestWorkout];
    const screen = await render(<HomeScreen />);

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Antrenman ayrıntılarını aç: Sırt + Biceps',
      })
    );
    expect(mockRouter.navigate).toHaveBeenCalledWith('/workout/history/77');
    expect(screen.getByRole('button', { name: 'Program' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Geçmiş' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ölçüm Ekle' })).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toContain('"horizontal":true');
  });
});

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockSchedule = jest.fn();
const mockCancel = jest.fn();
const mockSetChannel = jest.fn();
const mockHaptic = jest.fn();

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancel(...args),
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissions(...args),
  requestPermissionsAsync: (...args: unknown[]) =>
    mockRequestPermissions(...args),
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetChannel(...args),
}));
jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  notificationAsync: (...args: unknown[]) => mockHaptic(...args),
}));

import {
  cancelRestTimerNotification,
  emitWorkoutHaptic,
  scheduleRestTimerNotification,
} from '@/features/workouts/services/workout-feedback';

describe('workout feedback safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-08-05T10:00:00.000Z'));
    mockSetChannel.mockResolvedValue(null);
    mockSchedule.mockResolvedValue('timer-notification');
    mockCancel.mockResolvedValue(undefined);
    mockHaptic.mockResolvedValue(undefined);
  });

  afterEach(() => jest.useRealTimers());

  it('keeps the timer usable when notification permission is denied', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false });
    mockRequestPermissions.mockResolvedValue({ granted: false });

    await expect(
      scheduleRestTimerNotification('2026-08-05T10:01:30.000Z')
    ).resolves.toBeNull();
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('schedules one private local notification on the workout channel', async () => {
    mockGetPermissions.mockResolvedValue({ granted: true });

    await expect(
      scheduleRestTimerNotification('2026-08-05T10:01:30.000Z')
    ).resolves.toBe('timer-notification');
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        content: {
          body: 'Sıradaki sete hazırsın.',
          data: { category: 'workout_rest_timer' },
          sound: 'default',
          title: 'Dinlenme tamamlandı',
        },
        trigger: expect.objectContaining({
          channelId: 'workout-rest-timer',
        }),
      })
    );
    expect(JSON.stringify(mockSchedule.mock.calls)).not.toMatch(
      /exercise|egzersiz|account|token/i
    );
  });

  it('cancels scheduled feedback and tolerates unavailable haptics', async () => {
    mockHaptic.mockRejectedValue(new Error('unavailable'));

    await expect(emitWorkoutHaptic('set_completed')).resolves.toBeUndefined();
    await expect(
      cancelRestTimerNotification('timer-notification')
    ).resolves.toBeUndefined();
    await emitWorkoutHaptic('set_completed', false);

    expect(mockHaptic).toHaveBeenCalledTimes(1);
    expect(mockCancel).toHaveBeenCalledWith('timer-notification');
  });
});

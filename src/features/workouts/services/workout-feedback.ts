import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REST_CHANNEL_ID = 'workout-rest-timer';

export type WorkoutFeedbackKind =
  'set_completed' | 'set_undone' | 'timer_finished' | 'workout_completed';

let channelReady = false;

async function ensureRestChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;
  await Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
    importance: Notifications.AndroidImportance.HIGH,
    name: 'Dinlenme zamanlayıcısı',
    vibrationPattern: [0, 180, 120, 180],
  });
  channelReady = true;
}

export async function requestWorkoutNotificationPermission(): Promise<boolean> {
  try {
    await ensureRestChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

export async function scheduleRestTimerNotification(
  deadline: string
): Promise<string | null> {
  try {
    if (!(await requestWorkoutNotificationPermission())) return null;
    const date = new Date(deadline);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
      return null;
    return await Notifications.scheduleNotificationAsync({
      content: {
        body: 'Sıradaki sete hazırsın.',
        data: { category: 'workout_rest_timer' },
        sound: 'default',
        title: 'Dinlenme tamamlandı',
      },
      trigger: {
        channelId: REST_CHANNEL_ID,
        date,
        type: Notifications.SchedulableTriggerInputTypes.DATE,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelRestTimerNotification(
  identifier: string | null | undefined
): Promise<void> {
  if (!identifier) return;
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(
    () => undefined
  );
}

export async function emitWorkoutHaptic(
  kind: WorkoutFeedbackKind,
  enabled = true
): Promise<void> {
  if (!enabled) return;
  const feedback =
    kind === 'workout_completed'
      ? Haptics.NotificationFeedbackType.Success
      : kind === 'set_undone'
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success;
  await Haptics.notificationAsync(feedback).catch(() => undefined);
}

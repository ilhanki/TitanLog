import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppText } from '@/components/app-text';
import { ProgressBar } from '@/components/progress-bar';
import { InlineNumericWheelField } from '@/features/workouts/components/inline-numeric-wheel-field';
import {
  REST_TIMER_PRESETS,
  getRestTimerProgress,
  getRestTimerRemainingSeconds,
} from '@/features/workouts/domain/rest-timer';
import type { RestTimerState } from '@/features/workouts/domain/models';
import { workoutTheme } from '@/features/workouts/workout-theme';
import { theme } from '@/theme/tokens';

type RestTimerCardProps = {
  exerciseName?: string;
  now: number;
  onAdjust: (seconds: number) => void;
  onCancel: () => void;
  onStart: (seconds: number) => void;
  pending?: boolean;
  timer: RestTimerState | null;
};

function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function RestTimerCard({
  exerciseName,
  now,
  onAdjust,
  onCancel,
  onStart,
  pending = false,
  timer,
}: RestTimerCardProps) {
  const [customSeconds, setCustomSeconds] = useState('90');
  const remaining = timer ? getRestTimerRemainingSeconds(timer, now) : 0;
  const accessibilitySummary = timer
    ? `Dinlenme zamanı, ${remaining} saniye kaldı${exerciseName ? `, ${exerciseName}` : ''}.`
    : 'Dinlenme zamanlayıcısı hazır.';

  return (
    <View
      accessibilityLabel={accessibilitySummary}
      accessibilityLiveRegion="polite"
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.copy}>
          <AppText tone="primary" variant="label">
            Dinlenme
          </AppText>
          <AppText style={styles.timer} variant="metric">
            {timer ? formatTimer(remaining) : 'Hazır'}
          </AppText>
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {timer
              ? (exerciseName ?? 'Sıradaki sete hazırlan')
              : 'Setten sonra otomatik başlayabilir'}
          </AppText>
        </View>
        {timer ? (
          <AppButton
            disabled={pending}
            label="Atla"
            onPress={onCancel}
            style={styles.skip}
            variant="ghost"
          />
        ) : null}
      </View>
      {timer ? (
        <>
          <ProgressBar
            accessibilityLabel={`Dinlenme süresi: ${remaining} saniye kaldı`}
            progress={getRestTimerProgress(timer, now)}
          />
          <View style={styles.actions}>
            <AppButton
              disabled={pending}
              label="−15 sn"
              onPress={() => onAdjust(-15)}
              style={styles.action}
              variant="secondary"
            />
            <AppButton
              disabled={pending}
              label="+15 sn"
              onPress={() => onAdjust(15)}
              style={styles.action}
              variant="secondary"
            />
            <AppButton
              disabled={pending}
              label="Baştan"
              onPress={() => onStart(timer.durationSeconds)}
              style={styles.action}
              variant="secondary"
            />
          </View>
        </>
      ) : (
        <>
          <View style={styles.presets}>
            {REST_TIMER_PRESETS.map((seconds) => (
              <Pressable
                accessibilityLabel={`${seconds} saniye dinlenme başlat`}
                accessibilityRole="button"
                disabled={pending}
                key={seconds}
                onPress={() => onStart(seconds)}
                style={({ pressed }) => [
                  styles.preset,
                  pressed && styles.pressed,
                ]}
              >
                <AppText variant="button">{seconds}</AppText>
              </Pressable>
            ))}
          </View>
          <View style={styles.customRow}>
            <InlineNumericWheelField
              accessibilityLabel="Özel dinlenme süresi"
              disabled={pending}
              formatValue={String}
              inputMode="numeric"
              keyboardType="number-pad"
              max={1800}
              min={15}
              onChangeText={setCustomSeconds}
              parseValue={(value) => {
                const parsed = Number(value);
                return Number.isSafeInteger(parsed) &&
                  parsed >= 15 &&
                  parsed <= 1800
                  ? parsed
                  : null;
              }}
              step={15}
              unit="saniye"
              value={customSeconds}
            />
            <AppButton
              disabled={
                pending ||
                !Number.isSafeInteger(Number(customSeconds)) ||
                Number(customSeconds) < 15 ||
                Number(customSeconds) > 1800
              }
              label="Özel süreyi başlat"
              onPress={() => onStart(Number(customSeconds))}
              style={styles.customAction}
              variant="secondary"
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  action: { flex: 1, minHeight: theme.layout.compactTouchTarget },
  actions: { flexDirection: 'row', gap: theme.spacing.sm },
  card: {
    backgroundColor: workoutTheme.surfaceActive,
    borderColor: theme.colors.primary,
    borderRadius: theme.radii.lg,
    borderWidth: theme.borders.thin,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  copy: { flex: 1, gap: theme.spacing.xxs },
  customAction: { flex: 1 },
  customRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  header: { alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md },
  preset: {
    alignItems: 'center',
    backgroundColor: workoutTheme.input,
    borderRadius: theme.radii.sm,
    flex: 1,
    justifyContent: 'center',
    minHeight: theme.layout.touchTarget,
  },
  presets: { flexDirection: 'row', gap: theme.spacing.xs },
  pressed: { opacity: 0.72 },
  skip: { minWidth: 72 },
  timer: { fontVariant: ['tabular-nums'] },
});

import { useRouter, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppHeader } from '@/components/app-header';
import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { appStrings } from '@/constants/strings';
import { useBodyOverview } from '@/features/body/hooks/use-body-overview';
import { GoalCard } from '@/features/home/goal-card';
import { LastWorkoutCard } from '@/features/home/last-workout-card';
import { TodayWorkoutCard } from '@/features/home/today-workout-card';
import { createWorkoutSessionRepository } from '@/features/workouts/data/workout-session-repository';
import { useWorkoutOverview } from '@/features/workouts/hooks/use-workout-overview';
import { decideWorkoutStart } from '@/features/workouts/utils/workout-navigation';
import { theme } from '@/theme/tokens';

const formatHomeDate = (date: Date) =>
  new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'long',
  }).format(date);

export function HomeScreen() {
  const database = useSQLiteContext();
  const router = useRouter();
  const now = new Date();
  const { data, error, errors, loading, retry } = useWorkoutOverview(now, 1);
  const bodyOverview = useBodyOverview();
  const [starting, setStarting] = useState(false);
  const latestWorkout = data.recentSessions[0] ?? null;
  const activeCompletedSets =
    data.activeSession?.exercises.reduce(
      (total, exercise) =>
        total + exercise.sets.filter((set) => set.isCompleted).length,
      0
    ) ?? 0;
  const activeTotalSets =
    data.activeSession?.exercises.reduce(
      (total, exercise) => total + exercise.sets.length,
      0
    ) ?? 0;

  const handleWorkoutAction = async () => {
    if (error) {
      retry();
      return;
    }
    const decision = decideWorkoutStart(
      data.activeSession,
      data.scheduledWorkout
    );
    if (decision.kind === 'resume') {
      router.navigate(`/workout/session/${decision.sessionId}` as Href);
      return;
    }
    if (decision.kind === 'rest' || !data.plan) {
      router.navigate('/workout/program');
      return;
    }
    if (data.scheduledWorkout?.exerciseCount === 0) {
      router.navigate('/workout/program');
      return;
    }
    if (starting) return;
    setStarting(true);
    try {
      const session = await createWorkoutSessionRepository(
        database
      ).startSessionFromWorkoutDay(decision.dayId);
      router.navigate(`/workout/session/${session.id}` as Href);
    } catch {
      router.navigate('/workout');
    } finally {
      setStarting(false);
    }
  };

  const todayState = loading
    ? {
        action: 'Yükleniyor…',
        eyebrow: 'Bugün',
        summary: 'Antrenman durumun hazırlanıyor.',
        title: 'Program yükleniyor',
      }
    : error
      ? {
          action: 'Tekrar Dene',
          eyebrow: 'Antrenman',
          summary: 'Antrenman durumuna şu anda ulaşılamadı.',
          title: 'Veri yüklenemedi',
        }
      : data.activeSession
        ? {
            action: 'Antrenmana Devam Et',
            eyebrow: 'Aktif Antrenman',
            summary: `${activeCompletedSets} / ${activeTotalSets} set tamamlandı`,
            title: data.activeSession.workoutName,
          }
        : data.scheduledWorkout
          ? {
              action: 'Antrenmanı Başlat',
              eyebrow: 'Bugün',
              summary: `${data.scheduledWorkout.exerciseCount} hareket · ${data.scheduledWorkout.totalSetCount} set`,
              title: data.scheduledWorkout.name,
            }
          : data.plan
            ? {
                action: 'Programı Gör',
                eyebrow: 'Bugün',
                summary: 'Bugün için programlanmış bir antrenman bulunmuyor.',
                title: 'Planlanmış antrenman yok',
              }
            : {
                action: 'Programı Düzenle',
                eyebrow: 'Program',
                summary: 'Antrenmanlarına başlamak için programını hazırla.',
                title: 'Program henüz hazır değil',
              };

  return (
    <Screen>
      <AppHeader
        actionIcon="account-outline"
        actionLabel={appStrings.home.openProfile}
        brand={appStrings.brandName}
        onActionPress={() => router.navigate('/profile')}
      />
      <AppText selectable tone="muted" variant="caption">
        {formatHomeDate(now)}
      </AppText>

      <TodayWorkoutCard
        actionLabel={todayState.action}
        disabled={loading || starting}
        eyebrow={todayState.eyebrow}
        onPress={() => void handleWorkoutAction()}
        summary={todayState.summary}
        title={todayState.title}
      />

      <View style={styles.section}>
        <SectionHeader title="Gelişim" />
        {bodyOverview.loading ? (
          <AppCard style={styles.compactCard}>
            <AppText variant="bodyStrong">Gelişim verileri yükleniyor</AppText>
            <AppText tone="muted" variant="caption">
              Kayıtlı vücut değerlerin hazırlanıyor.
            </AppText>
          </AppCard>
        ) : bodyOverview.error ? (
          <AppCard style={styles.compactCard}>
            <AppText variant="bodyStrong">Gelişim özeti yüklenemedi</AppText>
            <AppText tone="muted" variant="caption">
              Antrenman eylemlerin kullanılmaya devam edebilir.
            </AppText>
            <AppButton
              label="Gelişimi Yeniden Yükle"
              onPress={bodyOverview.retry}
              variant="ghost"
            />
          </AppCard>
        ) : bodyOverview.data.summary ? (
          <GoalCard
            onPress={() => router.navigate('/progress')}
            summary={bodyOverview.data.summary}
          />
        ) : (
          <AppCard style={styles.compactCard}>
            <AppText variant="bodyStrong">Gelişimini Takip Et</AppText>
            <AppText tone="muted" variant="caption">
              Kilo hedefini oluşturduğunda özetin burada görünür.
            </AppText>
            <AppButton
              label="Hedef Belirle"
              onPress={() => router.navigate('/progress')}
              variant="secondary"
            />
          </AppCard>
        )}
      </View>

      {latestWorkout ? (
        <LastWorkoutCard
          onOpen={() =>
            router.navigate(`/workout/history/${latestWorkout.id}` as Href)
          }
          workout={latestWorkout}
        />
      ) : errors?.recent ? (
        <AppText tone="muted" variant="caption">
          Son antrenman bilgisi şu anda yüklenemedi.
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  compactCard: { gap: theme.spacing.md },
  section: { gap: theme.spacing.md },
});

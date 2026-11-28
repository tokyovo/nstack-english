import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLearner } from '@/account/use-learner';
import { BackLink } from '@/components/back-link';
import { ListRow } from '@/components/list-row';
import { PremiumTag } from '@/components/premium-tag';
import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxContentWidth, Space } from '@/constants/theme';
import { levels, tracks, unitsOf, type Track, type UnitSummary } from '@/content';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import type { Plan } from '@/premium';
import { usePlan } from '@/premium/use-premium';
import { isLessonCompleted } from '@/progress';
import { useProgress, type ProgressState } from '@/progress/use-progress';

function isTrack(value: unknown): value is Track {
  return tracks.some((track) => track === value);
}

function rowLabel(unit: UnitSummary, status: string | null, locked: boolean): string {
  const { number, title } = unit;
  if (locked) return t('unit.rowLabelLocked', { number, title });
  if (unit.access === 'premium') {
    return status ? t('unit.rowLabelPremium', { number, title, status }) : t('unit.rowLabelPremiumLoading', { number, title });
  }
  return status ? t('unit.rowLabel', { number, title, status }) : t('unit.rowLabelLoading', { number, title });
}

function UnitRow({ unit, progress, plan }: { unit: UnitSummary; progress: ProgressState; plan: Plan }) {
  const theme = useTheme();
  const number = t('unit.number', { number: unit.number });
  // Unknown (loading, offline) opens the lesson, which asks the server or uses the device copy.
  const locked = unit.access === 'premium' && plan.kind === 'free';
  const completed = progress.status === 'ready' && isLessonCompleted(progress.progress, unit.id);
  const status =
    progress.status === 'ready' && !locked ? t(completed ? 'unit.completed' : 'unit.notStarted') : null;

  return (
    <ListRow
      href={locked ? '/premium' : `/lesson/${unit.id}`}
      testID={`unit-${unit.id}`}
      accessibilityLabel={rowLabel(unit, status, locked)}>
      <View style={styles.rowTop}>
        <ThemedText type="meta">{number}</ThemedText>
        {unit.access === 'premium' && <PremiumTag locked={locked} />}
      </View>
      <ThemedText type="label">{unit.title}</ThemedText>
      {status && (
        <ThemedText type="meta" style={completed && [styles.completed, { color: theme.success }]}>
          {status}
        </ThemedText>
      )}
    </ListRow>
  );
}

function TrackUnits({ track }: { track: Track }) {
  const learner = useLearner();
  const progress = useProgress(learner.status === 'ready' ? learner.progressId : undefined);
  const plan = usePlan();
  const units = unitsOf(track);
  const byLevel = levels
    .map((level) => ({ level, units: units.filter((unit) => unit.level === level) }))
    .filter((group) => group.units.length > 0);

  return (
    <>
      {progress.status === 'error' && <ThemedText role="alert">{t('track.progressError')}</ThemedText>}
      {byLevel.length === 0 && <ThemedText>{t('track.empty')}</ThemedText>}
      {byLevel.map((group) => (
        <View key={group.level} style={styles.list}>
          <ThemedText type="heading" role="heading" aria-level={2}>
            {t(`level.${group.level}`)}
          </ThemedText>
          {group.units.map((unit) => (
            <UnitRow key={unit.id} unit={unit} progress={progress} plan={plan} />
          ))}
        </View>
      ))}
    </>
  );
}

export default function TrackScreen() {
  const theme = useTheme();
  const { track } = useLocalSearchParams<{ track: string }>();
  const title = isTrack(track) ? t(`track.${track}.name`) : t('track.notFound');

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <BackLink href="/" label={t('track.back')} />
          <ThemedText type="title" role="heading" aria-level={1}>
            {title}
          </ThemedText>
          {isTrack(track) && <TrackUnits track={track} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Space.xl,
    paddingTop: Space.xl,
    paddingBottom: Space.xxxl,
    gap: Space.xl,
  },
  list: {
    gap: Space.md,
  },
  completed: {
    fontFamily: Fonts.semiBold,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.md,
  },
});

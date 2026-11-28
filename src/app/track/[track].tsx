import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLearner } from '@/account/use-learner';
import { BackLink } from '@/components/back-link';
import { ListRow } from '@/components/list-row';
import { ThemedText } from '@/components/themed-text';
import { Fonts, MaxContentWidth, Space } from '@/constants/theme';
import { levels, tracks, unitsOf, type Track, type UnitSummary } from '@/content';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { isLessonCompleted } from '@/progress';
import { useProgress, type ProgressState } from '@/progress/use-progress';

function isTrack(value: unknown): value is Track {
  return tracks.some((track) => track === value);
}

function UnitRow({ unit, progress }: { unit: UnitSummary; progress: ProgressState }) {
  const theme = useTheme();
  const number = t('unit.number', { number: unit.number });
  const completed = progress.status === 'ready' && isLessonCompleted(progress.progress, unit.id);
  const status =
    progress.status === 'ready' ? t(completed ? 'unit.completed' : 'unit.notStarted') : null;
  const label = status
    ? t('unit.rowLabel', { number: unit.number, title: unit.title, status })
    : t('unit.rowLabelLoading', { number: unit.number, title: unit.title });

  return (
    <ListRow href={`/lesson/${unit.id}`} testID={`unit-${unit.id}`} accessibilityLabel={label}>
      <ThemedText type="meta">{number}</ThemedText>
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
            <UnitRow key={unit.id} unit={unit} progress={progress} />
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
});

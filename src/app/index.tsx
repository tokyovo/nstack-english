import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListRow } from '@/components/list-row';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Space } from '@/constants/theme';
import { tracks, unitsOf, type Track } from '@/content';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { isLessonCompleted } from '@/progress';
import { useProgress, type ProgressState } from '@/progress/use-progress';

/** "Đã học xong 1/5 bài" once progress is read; nothing while it loads or when it cannot be read. */
function progressLine(track: Track, state: ProgressState): string | null {
  const units = unitsOf(track);
  if (units.length === 0) return t('track.comingSoon');
  if (state.status !== 'ready') return null;
  const done = units.filter((unit) => isLessonCompleted(state.progress, unit.id)).length;
  return t('track.progress', { done, total: units.length });
}

export default function HomeScreen() {
  const theme = useTheme();
  const progress = useProgress();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <View style={styles.intro}>
            <ThemedText type="title" role="heading" aria-level={1}>
              {t('app.name')}
            </ThemedText>
            <ThemedText type="lead">{t('home.tagline')}</ThemedText>
          </View>

          <View style={styles.list}>
            <ThemedText type="heading" role="heading" aria-level={2}>
              {t('home.chooseTrack')}
            </ThemedText>
            {tracks.map((track) => {
              const name = t(`track.${track}.name`);
              const description = t(`track.${track}.description`);
              const line = progressLine(track, progress);
              return (
                <ListRow
                  key={track}
                  href={`/track/${track}`}
                  testID={`track-${track}`}
                  accessibilityLabel={
                    line
                      ? t('track.rowLabel', { name, description, progress: line })
                      : t('track.rowLabelLoading', { name, description })
                  }>
                  <ThemedText type="label">{name}</ThemedText>
                  <ThemedText>{description}</ThemedText>
                  {line && <ThemedText type="meta">{line}</ThemedText>}
                </ListRow>
              );
            })}
          </View>
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
    paddingVertical: Space.xxxl,
    gap: Space.xxl,
  },
  intro: {
    gap: Space.md,
  },
  list: {
    gap: Space.md,
  },
});

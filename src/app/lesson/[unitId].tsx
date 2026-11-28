import { Link, Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLearner } from '@/account/use-learner';
import { BackLink } from '@/components/back-link';
import { ActionButton } from '@/components/lesson/action-button';
import { LessonPlayer } from '@/components/lesson/lesson-player';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Space } from '@/constants/theme';
import { getUnit, unitSummary, type Unit } from '@/content';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { usePremiumUnit } from '@/premium/use-premium';
import { createProgressStore } from '@/progress';

const store = createProgressStore();

function Lesson({ unit }: { unit: Unit }) {
  const learner = useLearner();
  return (
    <>
      {/* Answers are saved as they are given, so leaving mid-lesson loses none. */}
      <BackLink
        href={`/track/${unit.track}`}
        label={t('lesson.leave')}
        accessibilityLabel={t('lesson.leaveLabel', { track: t(`track.${unit.track}.name`) })}
      />
      {/* A new unit or learner starts a new lesson, never the previous one's steps. */}
      {learner.status === 'ready' && (
        <LessonPlayer key={`${learner.progressId} ${unit.id}`} unit={unit} store={store} profileId={learner.progressId} />
      )}
    </>
  );
}

function Missing({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.missing}>
      {onRetry ? (
        <ThemedText role="alert">{message}</ThemedText>
      ) : (
        <ThemedText type="heading" role="heading" aria-level={1}>
          {message}
        </ThemedText>
      )}
      {onRetry && <ActionButton label={t('lesson.retryLoad')} onPress={onRetry} testID="retry-load" />}
      <Link href="/" asChild>
        <ActionButton label={t('lesson.home')} kind={onRetry ? 'secondary' : 'primary'} testID="home" />
      </Link>
    </View>
  );
}

/** A premium unit: the server sends it to a Premium learner; anyone else is shown /premium. */
function PremiumLesson({ unitId }: { unitId: string }) {
  const [state, retry] = usePremiumUnit(unitId);
  switch (state.status) {
    case 'loading':
      return <ThemedText>{t('lesson.loading')}</ThemedText>;
    case 'locked':
      return <Redirect href="/premium" />;
    case 'offline':
      return <Missing message={t('lesson.offline')} onRetry={retry} />;
    case 'error':
      return <Missing message={t('lesson.loadError')} onRetry={retry} />;
    case 'ready':
      return <Lesson unit={state.unit} />;
  }
}

export default function LessonScreen() {
  const theme = useTheme();
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const summary = typeof unitId === 'string' ? unitSummary(unitId) : undefined;
  const bundled = summary && getUnit(summary.id);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: summary ? summary.title : t('lesson.notFound') }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          {bundled ? (
            <Lesson unit={bundled} />
          ) : summary?.access === 'premium' ? (
            <PremiumLesson key={summary.id} unitId={summary.id} />
          ) : (
            <Missing message={t('lesson.notFound')} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center' },
  column: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Space.xl,
    paddingTop: Space.md,
    paddingBottom: Space.xxl,
    gap: Space.md,
  },
  missing: { gap: Space.xl },
});

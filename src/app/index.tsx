import { Link } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type AccountState } from '@/account';
import { useAccount } from '@/account/use-account';
import { ActionButton } from '@/components/lesson/action-button';
import { ListRow } from '@/components/list-row';
import { nothingDueHint } from '@/components/review/review-session';
import { ThemedText } from '@/components/themed-text';
import { Border, MaxContentWidth, Radius, Space } from '@/constants/theme';
import { tracks, units, unitsOf, type Track } from '@/content';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { isLessonCompleted } from '@/progress';
import { useProgress, type ProgressState } from '@/progress/use-progress';
import { dueWords, whyNothingDue } from '@/review/schedule';

/** "Đã học xong 1/5 bài" once progress is read; nothing while it loads or when it cannot be read. */
function progressLine(track: Track, state: ProgressState): string | null {
  const units = unitsOf(track);
  if (units.length === 0) return t('track.comingSoon');
  if (state.status !== 'ready') return null;
  const done = units.filter((unit) => isLessonCompleted(state.progress, unit.id)).length;
  return t('track.progress', { done, total: units.length });
}

/** "Đã đăng nhập: lan@example.com", an invitation when signed out, nothing while it loads. */
function accountLine(account: AccountState): string | null {
  if (account.status === 'signedIn') return t('home.signedIn', { email: account.user.email });
  if (account.status === 'signedOut') return t('home.signedOut');
  return null;
}

function AccountRow() {
  const [account] = useAccount();
  const title = t('home.account');
  const line = accountLine(account);
  return (
    <ListRow
      href="/account"
      testID="home-account"
      accessibilityLabel={line ? t('home.accountLabel', { title, state: line }) : title}>
      <ThemedText type="label">{title}</ThemedText>
      {line && <ThemedText type="meta">{line}</ThemedText>}
    </ListRow>
  );
}

/** How many words are due now, or why there are none; nothing until progress is read. */
function ReviewPanel({ state }: { state: ProgressState }) {
  const theme = useTheme();
  if (state.status !== 'ready') return null;
  const due = dueWords(state.progress, units, new Date()).length;

  return (
    <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.line }]} testID="review-panel">
      <ThemedText type="heading" role="heading" aria-level={2}>
        {t('review.title')}
      </ThemedText>
      {due > 0 ? (
        <>
          <ThemedText type="label" testID="due-count" style={styles.count}>
            {t('review.dueCount', { count: due })}
          </ThemedText>
          <Link href="/review" asChild>
            <ActionButton label={t('review.start')} testID="review-start" />
          </Link>
        </>
      ) : (
        <>
          <ThemedText type="label">{t('review.none')}</ThemedText>
          <ThemedText>{t(nothingDueHint[whyNothingDue(state.progress, units)])}</ThemedText>
        </>
      )}
    </View>
  );
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

          <ReviewPanel state={progress} />

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

          <AccountRow />
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
  panel: {
    borderWidth: Border,
    borderRadius: Radius.card,
    padding: Space.lg,
    gap: Space.sm,
  },
  count: {
    fontVariant: ['tabular-nums'],
    marginBottom: Space.sm,
  },
});

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type AccountState, type Profile } from '@/account';
import { useAccount } from '@/account/use-account';
import { useLearner } from '@/account/use-learner';
import { ListRow } from '@/components/list-row';
import { ThemedText } from '@/components/themed-text';
import { FontSize, MaxContentWidth, Space } from '@/constants/theme';
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

/** "Đã đăng nhập: lan@example.com", an invitation when signed out, nothing while it loads. */
function accountLine(account: AccountState): string | null {
  if (account.status === 'signedIn') return t('home.signedIn', { email: account.user.email });
  if (account.status === 'signedOut') return t('home.signedOut');
  return null;
}

/** A child learning sees the kids track first; everyone else the tracks in their usual order. */
function tracksFor(child: Profile | null): readonly Track[] {
  return child ? [...tracks].sort((a, b) => Number(b === 'kids') - Number(a === 'kids')) : tracks;
}

/** The way to the account; while a child is learning it is marked for the parent (the gate is behind it). */
function AccountRow({ child }: { child: Profile | null }) {
  const [account] = useAccount();
  const title = child ? t('home.parentArea') : t('home.account');
  const line = child ? t('home.parentAreaHint') : accountLine(account);
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

export default function HomeScreen() {
  const theme = useTheme();
  const learner = useLearner();
  const child = learner.status === 'ready' ? learner.child : null;
  const progress = useProgress(learner.status === 'ready' ? learner.progressId : undefined);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <View style={styles.intro}>
            <ThemedText type="title" role="heading" aria-level={1}>
              {t('app.name')}
            </ThemedText>
            <ThemedText type="lead">{t('home.tagline')}</ThemedText>
            {child && (
              <View style={styles.greeting}>
                {child.picture && (
                  <Text style={styles.picture} aria-hidden>
                    {child.picture}
                  </Text>
                )}
                <ThemedText type="heading">{t('home.greeting', { name: child.name })}</ThemedText>
              </View>
            )}
          </View>

          <View style={styles.list}>
            <ThemedText type="heading" role="heading" aria-level={2}>
              {t('home.chooseTrack')}
            </ThemedText>
            {tracksFor(child).map((track) => {
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

          <AccountRow child={child} />
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
  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  picture: {
    fontSize: FontSize.title,
    lineHeight: 44,
  },
  list: {
    gap: Space.md,
  },
});

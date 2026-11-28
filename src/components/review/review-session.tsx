import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/components/lesson/action-button';
import { ExerciseStep } from '@/components/lesson/exercise-step';
import { StepBar } from '@/components/step-bar';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { bundledUnits } from '@/content';
import { useTheme } from '@/hooks/use-theme';
import { t, type MessageKey } from '@/i18n';
import { type createProgressStore } from '@/progress';
import { useAnswerSaver } from '@/progress/use-answer-saver';
import { whyNothingDue, type NothingDue } from '@/review/schedule';
import { reviewSession, type ReviewItem } from '@/review/session';
import { canRecognise } from '@/speech/recognition';

type ProgressStore = ReturnType<typeof createProgressStore>;

type Phase =
  | { kind: 'loading' }
  | { kind: 'loadFailed' }
  | { kind: 'nothing'; why: NothingDue }
  | { kind: 'step'; items: ReviewItem[]; index: number }
  | { kind: 'saving'; total: number }
  | { kind: 'saveFailed'; total: number }
  | { kind: 'result'; total: number };

const systemClock = () => new Date();

type Props = {
  store: ProgressStore;
  /** The device copy of progress reviewed and answered into (src/account useLearner). */
  profileId: string;
  now?: () => Date;
  random?: () => number;
};

function HomeButton() {
  return (
    <Link href="/" asChild>
      <ActionButton label={t('lesson.home')} testID="home" />
    </Link>
  );
}

/** What to do when nothing is due, shown here and on home. */
export const nothingDueHint: Record<NothingDue, MessageKey> = {
  notLearned: 'review.noneHint',
  firstReviewSoon: 'review.firstSoon',
  allReviewed: 'review.allDone',
};

function Nothing({ why }: { why: NothingDue }) {
  return (
    <View style={styles.fill}>
      <View style={styles.section}>
        <ThemedText type="title" role="heading" aria-level={1}>
          {t('review.none')}
        </ThemedText>
        <ThemedText>{t(nothingDueHint[why])}</ThemedText>
      </View>
      <View style={styles.footer}>
        <HomeButton />
      </View>
    </View>
  );
}

function Result({ correct, total }: { correct: number; total: number }) {
  return (
    <View style={styles.fill}>
      <View style={styles.section}>
        <ThemedText type="title" role="heading" aria-level={1}>
          {t('review.resultTitle')}
        </ThemedText>
        <ThemedText type="lead" testID="score">
          {t('review.resultScore', { correct, total })}
        </ThemedText>
        <ThemedText>{t('review.resultNext')}</ThemedText>
      </View>
      <View style={styles.footer}>
        <HomeButton />
      </View>
    </View>
  );
}

/** A review of the words due now, from the first exercise to the result. Answers go under each word id. */
export function ReviewSession({ store, profileId, now = systemClock, random = Math.random }: Props) {
  const theme = useTheme();
  const saver = useAnswerSaver(store, profileId);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [correct, setCorrect] = useState(0);

  // Built once, when the progress is read, so the answers given during the review do not reshuffle it.
  useEffect(() => {
    let current = true;
    store.load(profileId).then(
      (progress) => {
        if (!current) return;
        const items = reviewSession(progress, bundledUnits, now(), random, { speak: canRecognise() });
        setPhase(
          items.length > 0
            ? { kind: 'step', items, index: 0 }
            : { kind: 'nothing', why: whyNothingDue(progress, bundledUnits) }
        );
      },
      () => current && setPhase({ kind: 'loadFailed' })
    );
    return () => {
      current = false;
    };
  }, [store, profileId, now, random]);

  async function finish(total: number) {
    setPhase({ kind: 'saving', total });
    try {
      await saver.flush();
      setPhase({ kind: 'result', total });
    } catch {
      setPhase({ kind: 'saveFailed', total });
    }
  }

  function onAnswer(item: ReviewItem, isCorrect: boolean) {
    if (isCorrect) setCorrect((n) => n + 1);
    saver.record({ itemId: item.wordId, correct: isCorrect });
  }

  switch (phase.kind) {
    case 'loading':
      return <ThemedText role="status">{t('review.loading')}</ThemedText>;
    case 'loadFailed':
      return (
        <View style={styles.fill}>
          <ThemedText role="alert" style={{ color: theme.danger }}>
            {t('review.loadError')}
          </ThemedText>
          <View style={styles.footer}>
            <HomeButton />
          </View>
        </View>
      );
    case 'nothing':
      return <Nothing why={phase.why} />;
    case 'step': {
      const { items, index } = phase;
      const item = items[index];
      return (
        <View style={styles.fill}>
          <StepBar
            label={t('review.step', { current: index + 1, total: items.length })}
            current={index + 1}
            total={items.length}
          />
          <ExerciseStep
            key={item.wordId}
            exercise={item.exercise}
            onAnswer={(isCorrect) => onAnswer(item, isCorrect)}
            onContinue={() =>
              index + 1 < items.length ? setPhase({ ...phase, index: index + 1 }) : finish(items.length)
            }
          />
        </View>
      );
    }
    case 'saving':
      return <ThemedText role="status">{t('lesson.saving')}</ThemedText>;
    case 'saveFailed':
      return (
        <View style={styles.fill}>
          <ThemedText role="alert" style={{ color: theme.danger }}>
            {t('lesson.saveError')}
          </ThemedText>
          <View style={styles.footer}>
            <ActionButton label={t('lesson.retrySave')} onPress={() => finish(phase.total)} testID="retry-save" />
          </View>
        </View>
      );
    case 'result':
      return <Result correct={correct} total={phase.total} />;
  }
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1, gap: Space.xl },
  section: { gap: Space.sm },
  footer: { marginTop: 'auto', gap: Space.md, paddingTop: Space.lg },
});

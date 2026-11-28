import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/components/lesson/action-button';
import { ExerciseStep } from '@/components/lesson/exercise-step';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { units } from '@/content';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { LOCAL_PROFILE_ID, type Answer, type createProgressStore } from '@/progress';
import { reviewSession, type ReviewItem } from '@/review/session';
import { canRecognise } from '@/speech/recognition';

type ProgressStore = ReturnType<typeof createProgressStore>;

type Phase =
  | { kind: 'loading' }
  | { kind: 'loadFailed' }
  /** Nothing due; `learned` tells whether any lesson has been finished. */
  | { kind: 'nothing'; learned: boolean }
  | { kind: 'step'; items: ReviewItem[]; index: number }
  | { kind: 'saving'; total: number }
  | { kind: 'saveFailed'; total: number }
  | { kind: 'result'; total: number };

const systemClock = () => new Date();

type Props = {
  store: ProgressStore;
  now?: () => Date;
  random?: () => number;
};

/** Saves each answer as it is given; one that fails is kept and saved again when the review ends. */
function useAnswerSaver(store: ProgressStore) {
  const writes = useRef<Promise<void>[]>([]);
  const unsaved = useRef<Answer[]>([]);

  function record(answer: Answer) {
    const write = store.recordAnswer(LOCAL_PROFILE_ID, answer).then(
      () => undefined,
      () => {
        unsaved.current.push(answer);
      }
    );
    writes.current.push(write);
  }

  async function flush() {
    await Promise.all(writes.current);
    writes.current = [];
    while (unsaved.current.length > 0) {
      await store.recordAnswer(LOCAL_PROFILE_ID, unsaved.current[0]);
      unsaved.current.shift();
    }
  }

  return { record, flush };
}

function HomeButton() {
  return (
    <Link href="/" asChild>
      <ActionButton label={t('lesson.home')} testID="home" />
    </Link>
  );
}

function Nothing({ learned }: { learned: boolean }) {
  return (
    <View style={styles.fill}>
      <View style={styles.section}>
        <ThemedText type="title" role="heading" aria-level={1}>
          {t('review.none')}
        </ThemedText>
        <ThemedText>{t(learned ? 'review.allDone' : 'review.noneHint')}</ThemedText>
      </View>
      <View style={styles.footer}>
        <HomeButton />
      </View>
    </View>
  );
}

function StepBar({ current, total }: { current: number; total: number }) {
  const theme = useTheme();
  return (
    <View style={styles.stepBar}>
      <ThemedText type="meta">{t('review.step', { current, total })}</ThemedText>
      <View style={[styles.track, { backgroundColor: theme.line }]} aria-hidden>
        <View style={[styles.bar, { backgroundColor: theme.accent, width: `${(current / total) * 100}%` }]} />
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
export function ReviewSession({ store, now = systemClock, random = Math.random }: Props) {
  const theme = useTheme();
  const saver = useAnswerSaver(store);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [correct, setCorrect] = useState(0);

  // Built once, when the progress is read, so the answers given during the review do not reshuffle it.
  useEffect(() => {
    let current = true;
    store.load(LOCAL_PROFILE_ID).then(
      (progress) => {
        if (!current) return;
        const items = reviewSession(progress, units, now(), random, { speak: canRecognise() });
        setPhase(
          items.length > 0
            ? { kind: 'step', items, index: 0 }
            : { kind: 'nothing', learned: Object.keys(progress.lessons).length > 0 }
        );
      },
      () => current && setPhase({ kind: 'loadFailed' })
    );
    return () => {
      current = false;
    };
  }, [store, now, random]);

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
      return <Nothing learned={phase.learned} />;
    case 'step': {
      const { items, index } = phase;
      const item = items[index];
      return (
        <View style={styles.fill}>
          <StepBar current={index + 1} total={items.length} />
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
  stepBar: { gap: Space.xs },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },
});

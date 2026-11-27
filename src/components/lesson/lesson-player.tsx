import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/components/lesson/action-button';
import { ExerciseStep } from '@/components/lesson/exercise-step';
import { WordCard } from '@/components/lesson/word-card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/theme';
import { unitsOf, type Exercise, type Unit, type Word } from '@/content';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { isLessonCompleted, LOCAL_PROFILE_ID, type Answer, type createProgressStore } from '@/progress';

type ProgressStore = ReturnType<typeof createProgressStore>;

type Step = { kind: 'word'; word: Word } | { kind: 'exercise'; exercise: Exercise };

type Phase =
  | { kind: 'intro' }
  | { kind: 'step'; index: number }
  | { kind: 'saving' }
  | { kind: 'saveFailed' }
  | { kind: 'result' };

/** New words first, each on its own card, then the exercises in the unit's order. */
function stepsOf(unit: Unit): Step[] {
  return [
    ...unit.words.map((word): Step => ({ kind: 'word', word })),
    ...unit.exercises.map((exercise): Step => ({ kind: 'exercise', exercise })),
  ];
}

function nextUnitAfter(unit: Unit): Unit | undefined {
  const track = unitsOf(unit.track);
  return track[track.findIndex((u) => u.id === unit.id) + 1];
}

/**
 * Saves each answer as it is given. An answer that fails to save is kept and saved again
 * with the completion, so "Thử lại" loses nothing.
 */
function useLessonSaver(store: ProgressStore, unit: Unit) {
  const writes = useRef<Promise<void>[]>([]);
  const unsaved = useRef<Answer[]>([]);

  function recordAnswer(answer: Answer) {
    const write = store.recordAnswer(LOCAL_PROFILE_ID, answer).then(
      () => undefined,
      () => {
        unsaved.current.push(answer);
      }
    );
    writes.current.push(write);
  }

  async function complete(correct: number) {
    await Promise.all(writes.current);
    writes.current = [];
    while (unsaved.current.length > 0) {
      await store.recordAnswer(LOCAL_PROFILE_ID, unsaved.current[0]);
      unsaved.current.shift();
    }
    await store.completeLesson(LOCAL_PROFILE_ID, { unitId: unit.id, correct, total: unit.exercises.length });
  }

  return { recordAnswer, complete };
}

function useCompleted(store: ProgressStore, unitId: string): boolean {
  const [completed, setCompleted] = useState(false);
  useEffect(() => {
    let current = true;
    store
      .load(LOCAL_PROFILE_ID)
      .then((progress) => {
        if (current) setCompleted(isLessonCompleted(progress, unitId));
      })
      // Unknown completion shows the lesson as not yet done; it can still be played.
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [store, unitId]);
  return completed;
}

function Intro({ unit, completed, onStart }: { unit: Unit; completed: boolean; onStart: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.fill}>
      <View style={styles.section}>
        <ThemedText type="label">{t('lesson.unitNumber', { number: unit.number })}</ThemedText>
        <ThemedText type="title" role="heading" aria-level={1}>
          {unit.title}
        </ThemedText>
        <ThemedText type="label">
          {t('lesson.size', { words: unit.words.length, exercises: unit.exercises.length })}
        </ThemedText>
        {completed ? (
          <ThemedText style={[styles.done, { color: theme.success, borderColor: theme.success }]} testID="completed">
            {t('lesson.completed')}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.section}>
        <ThemedText type="heading" role="heading" aria-level={2}>
          {t('lesson.goals')}
        </ThemedText>
        {unit.goals.map((goal) => (
          <ThemedText key={goal}>{goal}</ThemedText>
        ))}
      </View>
      {unit.note_vi ? (
        <View style={[styles.note, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <ThemedText type="heading" role="heading" aria-level={2}>
            {t('lesson.note')}
          </ThemedText>
          <ThemedText>{unit.note_vi}</ThemedText>
        </View>
      ) : null}
      <View style={styles.footer}>
        <ActionButton label={completed ? t('lesson.again') : t('lesson.start')} onPress={onStart} testID="start" />
      </View>
    </View>
  );
}

function StepBar({ current, total }: { current: number; total: number }) {
  const theme = useTheme();
  return (
    <View style={styles.stepBar}>
      <ThemedText type="label">{t('lesson.step', { current, total })}</ThemedText>
      <View style={[styles.track, { backgroundColor: theme.line }]} aria-hidden>
        <View style={[styles.bar, { backgroundColor: theme.accent, width: `${(current / total) * 100}%` }]} />
      </View>
    </View>
  );
}

function Result({ unit, correct }: { unit: Unit; correct: number }) {
  const total = unit.exercises.length;
  const next = nextUnitAfter(unit);
  return (
    <View style={styles.fill}>
      <View style={styles.section}>
        <ThemedText type="title" role="heading" aria-level={1}>
          {t('lesson.resultTitle')}
        </ThemedText>
        <ThemedText type="lead" testID="score">
          {t('lesson.resultScore', { correct, total })}
        </ThemedText>
        <ThemedText>{correct === total ? t('lesson.resultPerfect') : t('lesson.resultKeepGoing')}</ThemedText>
      </View>
      <View style={styles.footer}>
        {next ? (
          <Link href={`/lesson/${next.id}`} asChild>
            <ActionButton label={t('lesson.nextUnit', { title: next.title })} testID="next-unit" />
          </Link>
        ) : null}
        <Link href={`/track/${unit.track}`} asChild>
          <ActionButton
            label={t('lesson.backToTrack')}
            kind={next ? 'secondary' : 'primary'}
            testID="back-to-track"
          />
        </Link>
      </View>
    </View>
  );
}

/** One lesson from intro to result; answers and completion go to the progress store. */
export function LessonPlayer({ unit, store }: { unit: Unit; store: ProgressStore }) {
  const theme = useTheme();
  const steps = stepsOf(unit);
  const completed = useCompleted(store, unit.id);
  const saver = useLessonSaver(store, unit);
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const [correct, setCorrect] = useState(0);

  async function finish() {
    setPhase({ kind: 'saving' });
    try {
      await saver.complete(correct);
      setPhase({ kind: 'result' });
    } catch {
      setPhase({ kind: 'saveFailed' });
    }
  }

  function advance(index: number) {
    if (index + 1 < steps.length) setPhase({ kind: 'step', index: index + 1 });
    else finish();
  }

  function onAnswer(exercise: Exercise, isCorrect: boolean) {
    if (isCorrect) setCorrect((n) => n + 1);
    saver.recordAnswer({ itemId: exercise.id, correct: isCorrect });
  }

  switch (phase.kind) {
    case 'intro':
      return (
        <Intro
          unit={unit}
          completed={completed}
          onStart={() => {
            setCorrect(0);
            setPhase({ kind: 'step', index: 0 });
          }}
        />
      );
    case 'step': {
      const step = steps[phase.index];
      return (
        <View style={styles.fill}>
          <StepBar current={phase.index + 1} total={steps.length} />
          {step.kind === 'word' ? (
            <View style={styles.fill}>
              <WordCard key={step.word.id} word={step.word} />
              <View style={styles.footer}>
                <ActionButton label={t('lesson.continue')} onPress={() => advance(phase.index)} testID="continue" />
              </View>
            </View>
          ) : (
            <ExerciseStep
              key={step.exercise.id}
              exercise={step.exercise}
              onAnswer={(isCorrect) => onAnswer(step.exercise, isCorrect)}
              onContinue={() => advance(phase.index)}
            />
          )}
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
            <ActionButton label={t('lesson.retrySave')} onPress={finish} testID="retry-save" />
          </View>
        </View>
      );
    case 'result':
      return <Result unit={unit} correct={correct} />;
  }
}

const styles = StyleSheet.create({
  fill: { flexGrow: 1, gap: Space.xl },
  section: { gap: Space.sm },
  footer: { marginTop: 'auto', gap: Space.md, paddingTop: Space.lg },
  done: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    marginTop: Space.sm,
  },
  note: { borderWidth: 1, borderRadius: Radius.card, padding: Space.lg, gap: Space.sm },
  stepBar: { gap: Space.xs },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },
});

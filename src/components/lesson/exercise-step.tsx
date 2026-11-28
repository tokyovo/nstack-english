import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { GridCard } from '@/components/grid-card';
import { ActionButton } from '@/components/lesson/action-button';
import { BuildSentence } from '@/components/lesson/build-sentence';
import { ChoiceList } from '@/components/lesson/choice-list';
import { ListenButton } from '@/components/lesson/listen-button';
import { SpeakAnswer } from '@/components/lesson/speak-answer';
import { TypeAnswer } from '@/components/lesson/type-answer';
import { EnglishText, ThemedText } from '@/components/themed-text';
import { Radius, Space } from '@/constants/theme';
import type { Exercise, Word } from '@/content';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { rightAnswer } from '@/lesson/answers';
import { useCanSpeak } from '@/lesson/speech';

type Props = {
  exercise: Exercise;
  /** The words a choose_meaning prompt names by id: the unit's, or the review's. */
  words: readonly Word[];
  /** Called once, when the learner commits an answer. */
  onAnswer: (correct: boolean) => void;
  onContinue: () => void;
  /** Orders the choice options; Math.random unless a test passes a seeded source. */
  random?: () => number;
};

/** Vietnamese text the learner translates, shown large in plain text colour. */
function VietnamesePrompt({ text }: { text: string }) {
  return <ThemedText type="heading">{text}</ThemedText>;
}

function EnglishPrompt({ text, testID }: { text: string; testID?: string }) {
  return (
    <GridCard testID={testID}>
      <EnglishText type="word">{text}</EnglishText>
    </GridCard>
  );
}

function Feedback({ exercise, correct }: { exercise: Exercise; correct: boolean }) {
  const theme = useTheme();
  const colour = correct ? theme.success : theme.danger;

  return (
    <View
      style={[styles.feedback, { borderColor: colour, backgroundColor: theme.surface }]}
      role="status"
      aria-live="polite"
      accessibilityLiveRegion="polite"
      testID="feedback">
      <ThemedText type="heading" style={{ color: colour }}>
        {correct ? t('lesson.correct') : t('lesson.wrong')}
      </ThemedText>
      {correct ? null : <ThemedText>{t('lesson.rightAnswer', { answer: rightAnswer(exercise) })}</ThemedText>}
      {!correct && exercise.hint_vi ? <ThemedText>{exercise.hint_vi}</ThemedText> : null}
    </View>
  );
}

/** One exercise: instruction, prompt, the answer control, then feedback and "Tiếp tục". */
export function ExerciseStep({ exercise, words, onAnswer, onContinue, random }: Props) {
  const canSpeak = useCanSpeak();
  const [correct, setCorrect] = useState<boolean | null>(null);
  const answered = correct !== null;

  function check(isCorrect: boolean) {
    if (answered) return;
    setCorrect(isCorrect);
    onAnswer(isCorrect);
  }

  let instruction: string;
  let prompt: ReactNode;
  let control: ReactNode;
  switch (exercise.type) {
    case 'choose_meaning':
      instruction = t('lesson.chooseMeaning');
      prompt = <EnglishPrompt text={words.find((word) => word.id === exercise.prompt)?.en ?? exercise.prompt} />;
      control = <ChoiceList options={exercise.options} answer={exercise.answer} english={false} onCheck={check} random={random} />;
      break;
    case 'choose_english':
      instruction = t('lesson.chooseEnglish');
      prompt = <VietnamesePrompt text={exercise.prompt} />;
      control = <ChoiceList options={exercise.options} answer={exercise.answer} english onCheck={check} random={random} />;
      break;
    case 'listen_choose':
      instruction = canSpeak ? t('lesson.listenChoose') : t('lesson.readChoose');
      prompt = canSpeak ? (
        <GridCard>
          <ListenButton text={exercise.audio} testID="listen-exercise" />
        </GridCard>
      ) : (
        <EnglishPrompt text={exercise.audio} testID="listen-text" />
      );
      control = <ChoiceList options={exercise.options} answer={exercise.answer} english onCheck={check} random={random} />;
      break;
    case 'build_sentence':
      instruction = t('lesson.buildSentence');
      prompt = <VietnamesePrompt text={exercise.prompt} />;
      control = <BuildSentence exercise={exercise} answered={answered} onCheck={check} />;
      break;
    case 'type_answer':
      instruction = t('lesson.typeAnswer');
      prompt = <VietnamesePrompt text={exercise.prompt} />;
      control = <TypeAnswer exercise={exercise} answered={answered} onCheck={check} />;
      break;
    case 'speak':
      instruction = t('lesson.speak');
      prompt = (
        <GridCard>
          <EnglishText type="word">{exercise.text}</EnglishText>
          <ThemedText>{exercise.vi}</ThemedText>
          {canSpeak ? <ListenButton text={exercise.text} testID="listen-exercise" /> : null}
        </GridCard>
      );
      control = <SpeakAnswer exercise={exercise} canListen={canSpeak} answered={answered} onCheck={check} />;
      break;
  }

  return (
    <View style={styles.step}>
      <View style={styles.body}>
        <ThemedText type="lead" role="heading" aria-level={2}>
          {instruction}
        </ThemedText>
        {prompt}
        {control}
      </View>
      {answered ? (
        <View style={styles.footer}>
          <Feedback exercise={exercise} correct={correct} />
          <ActionButton label={t('lesson.continue')} onPress={onContinue} testID="continue" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexGrow: 1, gap: Space.xl },
  body: { gap: Space.xl },
  footer: { marginTop: 'auto', gap: Space.lg },
  feedback: { borderWidth: 2, borderRadius: Radius.card, padding: Space.lg, gap: Space.xs },
});


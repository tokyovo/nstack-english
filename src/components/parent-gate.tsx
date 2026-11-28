import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import type { Profile } from '@/account';
import { ActionButton } from '@/components/lesson/action-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { t } from '@/i18n';
import { isGateAnswer, newGateQuestion, type GateQuestion } from '@/profiles/parent-gate';
import { leaveChildProfile } from '@/sync';

function questionText({ a, b }: GateQuestion): string {
  return t('gate.question', { a: t(`gate.number.${a}`), b: t(`gate.number.${b}`) });
}

/**
 * Stands in front of a parent's screen while `child` is learning. A right answer returns the
 * device to the parent (the child's progress is saved first) and the screen behind it shows;
 * a wrong one asks a new question and the child stays where they are.
 */
export function ParentGate({ child }: { child: Profile }) {
  const [question, setQuestion] = useState(() => newGateQuestion());
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const input = useRef<TextInputInstance>(null);
  const canSubmit = answer.trim() !== '' && !leaving;

  async function submit() {
    if (!canSubmit) return;
    if (!isGateAnswer(question, answer)) {
      setQuestion(newGateQuestion());
      setAnswer('');
      setWrong(true);
      input.current?.focus();
      return;
    }
    setLeaving(true);
    await leaveChildProfile();
  }

  return (
    <View style={styles.gate}>
      <ThemedText type="heading" role="heading" aria-level={2}>
        {t('gate.heading')}
      </ThemedText>
      <ThemedText>{t('gate.intro', { name: child.name })}</ThemedText>
      <TextField
        ref={input}
        nativeID="parent-gate-answer"
        label={questionText(question)}
        hint={t('gate.hint')}
        error={wrong ? t('gate.wrong') : undefined}
        value={answer}
        onChangeText={setAnswer}
        onSubmitEditing={submit}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={2}
        autoComplete="off"
        autoCorrect={false}
        returnKeyType="done"
        submitBehavior="submit"
        testID="parent-gate-answer"
      />
      <ActionButton
        label={leaving ? t('gate.leaving') : t('gate.submit')}
        disabled={!canSubmit}
        onPress={submit}
        testID="parent-gate-submit"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gate: { gap: Space.lg },
});

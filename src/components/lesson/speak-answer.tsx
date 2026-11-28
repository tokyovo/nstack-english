import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/components/lesson/action-button';
import { EnglishText, ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import type { Exercise } from '@/content';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { askForMicrophone, canRecognise, listenForEnglish, microphonePermission } from '@/speech/recognition';
import { judgeSpeech } from '@/speech/score';

type Props = {
  exercise: Extract<Exercise, { type: 'speak' }>;
  /** Whether "Nghe" is on screen, so self-check can point to it. */
  canListen: boolean;
  answered: boolean;
  onCheck: (correct: boolean) => void;
};

/** Why the learner marks themselves; "unsupported" and "declined" need no explanation. */
type SelfCheckReason = 'unsupported' | 'declined' | 'denied' | 'failed';

type Phase =
  | { kind: 'ready'; heardNothing: boolean }
  /** Why the microphone is needed, before the system dialog. */
  | { kind: 'explain' }
  | { kind: 'listening' }
  | { kind: 'heard'; transcript: string }
  | { kind: 'selfCheck'; reason: SelfCheckReason };

const notices: Partial<Record<SelfCheckReason, string>> = {
  denied: t('lesson.micDenied'),
  failed: t('lesson.recognitionFailed'),
};

/**
 * The learner says the English. With a recogniser, "Nói" listens and the speech is judged
 * forgivingly; without one, or when the microphone is refused, they repeat aloud and mark themselves.
 */
export function SpeakAnswer({ exercise, canListen, answered, onCheck }: Props) {
  const theme = useTheme();
  const [phase, setPhase] = useState<Phase>(() =>
    canRecognise() ? { kind: 'ready', heardNothing: false } : { kind: 'selfCheck', reason: 'unsupported' }
  );
  const stopListening = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  /** Set from the first tap until listening ends, so a quick second tap cannot start a second recogniser. */
  const busy = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopListening.current?.();
    };
  }, []);

  /** Resolves when the recogniser ends; callers do not wait for it. */
  async function listen() {
    setPhase({ kind: 'listening' });
    const listening = listenForEnglish();
    stopListening.current = listening.stop;
    const hearing = await listening.heard;
    stopListening.current = null;
    busy.current = false;
    if (!mounted.current) return;
    switch (hearing.kind) {
      case 'heard': {
        const judged = judgeSpeech(exercise.text, hearing.transcripts);
        setPhase({ kind: 'heard', transcript: judged.heard });
        onCheck(judged.passed);
        return;
      }
      case 'nothing':
        setPhase({ kind: 'ready', heardNothing: true });
        return;
      case 'denied':
      case 'failed':
        setPhase({ kind: 'selfCheck', reason: hearing.kind });
    }
  }

  async function speak() {
    if (busy.current) return;
    busy.current = true;
    const permission = await microphonePermission();
    if (!mounted.current) return;
    if (permission === 'granted') {
      void listen();
      return;
    }
    busy.current = false;
    if (permission === 'ask') setPhase({ kind: 'explain' });
    else setPhase({ kind: 'selfCheck', reason: 'denied' });
  }

  async function allow() {
    if (busy.current) return;
    busy.current = true;
    const granted = await askForMicrophone();
    if (!mounted.current) return;
    if (granted) {
      void listen();
      return;
    }
    busy.current = false;
    setPhase({ kind: 'selfCheck', reason: 'denied' });
  }

  const decline = (
    <ActionButton
      label={t('lesson.micDecline')}
      kind="secondary"
      onPress={() => setPhase({ kind: 'selfCheck', reason: 'declined' })}
      testID="mic-decline"
    />
  );

  switch (phase.kind) {
    case 'ready':
      return (
        <View style={styles.body}>
          {phase.heardNothing ? (
            <ThemedText role="alert" style={{ color: theme.danger }}>
              {t('lesson.heardNothing')}
            </ThemedText>
          ) : null}
          <ActionButton
            label={t('lesson.speakButton')}
            accessibilityHint={t('lesson.speakHint')}
            onPress={speak}
            testID="speak"
          />
          {phase.heardNothing ? decline : null}
        </View>
      );
    case 'explain':
      return (
        <View style={styles.body}>
          <ThemedText>{t('lesson.micWhy')}</ThemedText>
          <ActionButton label={t('lesson.micAllow')} onPress={allow} testID="mic-allow" />
          {decline}
        </View>
      );
    case 'listening':
      return (
        <View style={styles.body}>
          <ThemedText role="status" aria-live="polite" accessibilityLiveRegion="polite">
            {t('lesson.listening')}
          </ThemedText>
          <ActionButton
            label={t('lesson.stopListening')}
            kind="secondary"
            onPress={() => stopListening.current?.()}
            testID="stop-listening"
          />
        </View>
      );
    case 'heard':
      return (
        <View style={styles.heard}>
          <ThemedText type="meta">{t('lesson.heard')}</ThemedText>
          <EnglishText type="lead" testID="heard">
            {phase.transcript}
          </EnglishText>
        </View>
      );
    case 'selfCheck': {
      // Once marked, the feedback below says all there is to say.
      if (answered) return null;
      const notice = notices[phase.reason];
      return (
        <View style={styles.body}>
          {notice ? <ThemedText role="alert">{notice}</ThemedText> : null}
          <ThemedText>{canListen ? t('lesson.selfCheckListen') : t('lesson.selfCheckRead')}</ThemedText>
          <ActionButton label={t('lesson.selfPass')} onPress={() => onCheck(true)} testID="self-pass" />
          <ActionButton label={t('lesson.selfFail')} kind="secondary" onPress={() => onCheck(false)} testID="self-fail" />
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  body: { gap: Space.lg },
  heard: { gap: Space.xs },
});

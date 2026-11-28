import { StyleSheet, View } from 'react-native';

import { GridCard } from '@/components/grid-card';
import { ListenButton } from '@/components/lesson/listen-button';
import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import type { Word } from '@/content';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { useCanSpeak } from '@/lesson/speech';

/** A new word on the notebook grid: the English in purple ink, the Vietnamese below it. */
export function WordCard({ word }: { word: Word }) {
  const canSpeak = useCanSpeak();
  const theme = useTheme();

  return (
    <View style={styles.step}>
      <ThemedText type="heading" role="heading" aria-level={2}>
        {t('lesson.newWord')}
      </ThemedText>
      <GridCard testID="word-card">
        {word.picture ? (
          <ThemedText style={styles.picture} aria-hidden>
            {word.picture}
          </ThemedText>
        ) : null}
        <ThemedText type="word" accessibilityLanguage="en">
          {word.en}
        </ThemedText>
        <ThemedText type="lead">{word.vi}</ThemedText>
        {canSpeak ? <ListenButton text={word.audio ?? word.en} testID="listen-word" /> : null}
      </GridCard>
      {word.example ? (
        <View style={[styles.example, { borderColor: theme.line }]}>
          <ThemedText type="meta">{t('lesson.example')}</ThemedText>
          <ThemedText style={{ color: theme.accent }} accessibilityLanguage="en">
            {word.example.en}
          </ThemedText>
          <ThemedText>{word.example.vi}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: Space.lg },
  picture: { fontSize: 56, lineHeight: 68 },
  example: { gap: Space.xs, paddingTop: Space.md, borderTopWidth: 1 },
});

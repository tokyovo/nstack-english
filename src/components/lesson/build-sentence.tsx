import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionButton } from '@/components/lesson/action-button';
import { EnglishText, ThemedText } from '@/components/themed-text';
import { Border, MinTouchTarget, Radius, Space } from '@/constants/theme';
import type { Exercise } from '@/content';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { isSentenceCorrect } from '@/lesson/answers';

type Props = {
  exercise: Extract<Exercise, { type: 'build_sentence' }>;
  answered: boolean;
  onCheck: (correct: boolean) => void;
};

type TileProps = {
  text: string;
  placed: boolean;
  disabled: boolean;
  onPress: () => void;
  testID: string;
};

function Tile({ text, placed, disabled, onPress, testID }: TileProps) {
  const theme = useTheme();
  const label = placed ? t('lesson.removeTile', { tile: text }) : undefined;

  return (
    <Pressable
      role="button"
      accessibilityRole="button"
      aria-label={label}
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={(state) => [
        styles.tile,
        {
          backgroundColor: theme.surface,
          borderColor: placed ? theme.accent : theme.line,
          opacity: state.pressed ? 0.85 : 1,
        },
        'focused' in state && state.focused ? { outlineColor: theme.accent, outlineWidth: 2, outlineOffset: 2 } : null,
      ]}>
      <EnglishText type="lead" style={{ color: theme.accent }}>
        {text}
      </EnglishText>
    </Pressable>
  );
}

/** Tap tiles to place them in order; tap a placed tile to take it back. */
export function BuildSentence({ exercise, answered, onCheck }: Props) {
  const theme = useTheme();
  // Indexes into exercise.tiles, so a repeated word stays two separate tiles.
  const [placed, setPlaced] = useState<number[]>([]);

  const tile = (index: number, isPlaced: boolean) => (
    <Tile
      key={index}
      text={exercise.tiles[index]}
      placed={isPlaced}
      disabled={answered}
      onPress={() => setPlaced(isPlaced ? placed.filter((i) => i !== index) : [...placed, index])}
      testID={`${isPlaced ? 'placed' : 'tile'}-${index}`}
    />
  );

  return (
    <View style={styles.body}>
      <View style={[styles.line, { borderColor: theme.line }]} testID="sentence-line">
        {placed.length === 0 ? (
          <ThemedText type="meta">{t('lesson.buildEmpty')}</ThemedText>
        ) : (
          placed.map((index) => tile(index, true))
        )}
      </View>
      <View style={styles.bank}>
        {exercise.tiles.map((_, index) => (placed.includes(index) ? null : tile(index, false)))}
      </View>
      {answered ? null : (
        <ActionButton
          label={t('lesson.check')}
          disabled={placed.length === 0}
          onPress={() => onCheck(isSentenceCorrect(exercise, placed.map((i) => exercise.tiles[i])))}
          testID="check"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: Space.xl },
  line: {
    minHeight: MinTouchTarget + Space.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: Space.sm,
    borderBottomWidth: 2,
  },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  tile: {
    minHeight: MinTouchTarget,
    minWidth: MinTouchTarget,
    borderWidth: Border,
    borderRadius: Radius.control,
    paddingHorizontal: Space.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

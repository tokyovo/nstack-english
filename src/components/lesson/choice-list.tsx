import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Border, MinTouchTarget, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  options: string[];
  answer: string;
  /** The options are English (choose_english, listen_choose) or Vietnamese (choose_meaning). */
  english: boolean;
  onCheck: (correct: boolean) => void;
};

/** Options as bordered rows; the first tap is the answer, then the right one is marked. */
export function ChoiceList({ options, answer, english, onCheck }: Props) {
  const theme = useTheme();
  const [chosen, setChosen] = useState<string | null>(null);

  function choose(option: string) {
    if (chosen !== null) return;
    setChosen(option);
    onCheck(option === answer);
  }

  function colourOf(option: string) {
    if (chosen === null) return theme.line;
    if (option === answer) return theme.success;
    return option === chosen ? theme.danger : theme.line;
  }

  return (
    <View style={styles.list}>
      {options.map((option, index) => (
        <Pressable
          key={option}
          role="button"
          accessibilityRole="button"
          accessibilityState={{ disabled: chosen !== null }}
          disabled={chosen !== null}
          onPress={() => choose(option)}
          testID={`option-${index}`}
          style={(state) => [
            styles.option,
            {
              backgroundColor: theme.surface,
              borderColor: colourOf(option),
              borderWidth: chosen !== null && colourOf(option) !== theme.line ? 2 : Border,
              opacity: state.pressed ? 0.85 : 1,
            },
            'focused' in state && state.focused ? { outlineColor: theme.accent, outlineWidth: 2, outlineOffset: 2 } : null,
          ]}>
          <ThemedText
            type="lead"
            accessibilityLanguage={english ? 'en' : 'vi'}
            style={chosen !== null && option === answer ? { color: theme.success } : null}>
            {option}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Space.md },
  option: {
    minHeight: MinTouchTarget + Space.sm,
    borderRadius: Radius.control,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    justifyContent: 'center',
  },
});

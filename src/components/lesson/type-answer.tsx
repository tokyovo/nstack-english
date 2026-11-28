import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ActionButton } from '@/components/lesson/action-button';
import { Border, Fonts, FontSize, MinTouchTarget, Radius, Space } from '@/constants/theme';
import type { Exercise } from '@/content';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { isTypedAnswerCorrect } from '@/lesson/answers';

type Props = {
  exercise: Extract<Exercise, { type: 'type_answer' }>;
  answered: boolean;
  onCheck: (correct: boolean) => void;
};

/** The learner types the English; Enter on the keyboard checks it, like the button. */
export function TypeAnswer({ exercise, answered, onCheck }: Props) {
  const theme = useTheme();
  const [typed, setTyped] = useState('');
  const [focused, setFocused] = useState(false);
  const empty = typed.trim() === '';

  function check() {
    if (empty || answered) return;
    onCheck(isTypedAnswerCorrect(exercise, typed));
  }

  return (
    <View style={styles.body}>
      <TextInput
        value={typed}
        onChangeText={setTyped}
        onSubmitEditing={check}
        editable={!answered}
        accessibilityLabel={t('lesson.typeLabel')}
        aria-label={t('lesson.typeLabel')}
        placeholder={t('lesson.typePlaceholder')}
        placeholderTextColor={theme.muted}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        returnKeyType="done"
        submitBehavior="submit"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        testID="answer-input"
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: focused ? theme.accent : theme.line,
            borderWidth: focused ? 2 : Border,
          },
        ]}
      />
      {answered ? null : (
        <ActionButton label={t('lesson.check')} disabled={empty} onPress={check} testID="check" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: Space.xl },
  input: {
    minHeight: MinTouchTarget + Space.sm,
    borderRadius: Radius.control,
    paddingHorizontal: Space.lg,
    fontFamily: Fonts.regular,
    fontSize: FontSize.large,
  },
});

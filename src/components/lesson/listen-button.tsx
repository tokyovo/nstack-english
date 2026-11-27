import { StyleSheet } from 'react-native';

import { ActionButton } from '@/components/lesson/action-button';
import { t } from '@/i18n';
import { speakEnglish } from '@/lesson/speech';

/** Speaks the English text. Render it only when useCanSpeak() is true. */
export function ListenButton({ text, testID }: { text: string; testID?: string }) {
  return (
    <ActionButton
      kind="secondary"
      label={t('lesson.listen')}
      accessibilityHint={t('lesson.listenHint')}
      onPress={() => speakEnglish(text)}
      testID={testID}
      style={styles.listen}
    />
  );
}

const styles = StyleSheet.create({
  listen: { alignSelf: 'flex-start', minWidth: 120 },
});

import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Border, MaxContentWidth, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { useSyncState } from '@/sync/use-sync';

/**
 * A quiet bar above every screen while a signed-in learner's progress cannot reach the server:
 * the device is offline, or the server refused it (the app tries again on the next screen).
 * The status region is always there, so screen readers announce the notice when it appears.
 */
export function OfflineNotice() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const state = useSyncState();
  const message = state === 'offline' ? t('sync.offline') : state === 'failed' ? t('sync.failed') : undefined;

  return (
    <View
      role="status"
      style={
        message !== undefined && [
          styles.bar,
          { paddingTop: insets.top + Space.sm, backgroundColor: theme.surface, borderColor: theme.line },
        ]
      }>
      {message !== undefined && (
        <ThemedText style={styles.text} testID="offline-notice">
          {message}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: Border,
    paddingBottom: Space.sm,
    alignItems: 'center',
  },
  // Lines up with the screens' content column below it.
  text: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Space.xl,
  },
});

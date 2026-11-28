import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackLink } from '@/components/back-link';
import { ReviewSession } from '@/components/review/review-session';
import { MaxContentWidth, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { createProgressStore } from '@/progress';

const store = createProgressStore();

export default function ReviewScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: t('review.title') }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          {/* Answers are saved as they are given, so leaving mid-review loses none. */}
          <BackLink href="/" label={t('review.leave')} accessibilityLabel={t('review.leaveLabel')} />
          <ReviewSession store={store} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center' },
  column: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Space.xl,
    paddingTop: Space.md,
    paddingBottom: Space.xxl,
    gap: Space.md,
  },
});

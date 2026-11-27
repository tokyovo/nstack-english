import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/lesson/action-button';
import { LessonPlayer } from '@/components/lesson/lesson-player';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Space } from '@/constants/theme';
import { getUnit } from '@/content';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { createProgressStore } from '@/progress';

const store = createProgressStore();

export default function LessonScreen() {
  const theme = useTheme();
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const unit = typeof unitId === 'string' ? getUnit(unitId) : undefined;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: unit ? unit.title : t('lesson.notFound') }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          {unit ? (
            // A new unit starts a new lesson, never the previous one's steps.
            <LessonPlayer key={unit.id} unit={unit} store={store} />
          ) : (
            <View style={styles.missing}>
              <ThemedText type="heading" role="heading" aria-level={1}>
                {t('lesson.notFound')}
              </ThemedText>
              <Link href="/" asChild>
                <ActionButton label={t('lesson.home')} testID="home" />
              </Link>
            </View>
          )}
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
    paddingVertical: Space.xxl,
  },
  missing: { gap: Space.xl },
});

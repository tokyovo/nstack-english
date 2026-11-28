import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GridCard } from '@/components/grid-card';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

export default function WelcomeScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={styles.column}>
        <View style={styles.intro}>
          <ThemedText type="title" role="heading" aria-level={1}>
            {t('app.name')}
          </ThemedText>
          <ThemedText type="lead">{t('welcome.tagline')}</ThemedText>
        </View>

        <GridCard testID="word-card">
          <ThemedText type="word" accessibilityLanguage="en">
            {t('welcome.sampleWord')}
          </ThemedText>
          <ThemedText>{t('welcome.sampleMeaning')}</ThemedText>
        </GridCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    justifyContent: 'center',
    paddingHorizontal: Space.xl,
    paddingVertical: Space.xxxl,
    gap: Space.xxl,
  },
  intro: {
    gap: Space.md,
  },
});

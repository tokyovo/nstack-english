import { Link, Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccount } from '@/account/use-account';
import { useLearner } from '@/account/use-learner';
import { BackLink } from '@/components/back-link';
import { ParentGate } from '@/components/parent-gate';
import { ThemedText } from '@/components/themed-text';
import { Fonts, FontSize, MaxContentWidth, MinTouchTarget, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t, type MessageKey } from '@/i18n';
import { usePlan } from '@/premium/use-premium';

const includes: MessageKey[] = [
  'premium.includes.units',
  'premium.includes.new',
  'premium.includes.family',
  'premium.includes.offline',
];

const dateFormat = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** What Premium is and how to get it; payment is not connected yet, and the screen says so. */
function About() {
  const theme = useTheme();
  const plan = usePlan();
  const [account] = useAccount();

  return (
    <>
      <View style={styles.section}>
        <ThemedText type="heading" role="heading" aria-level={2}>
          {t('premium.includesHeading')}
        </ThemedText>
        <View role="list" style={styles.list}>
          {includes.map((key) => (
            <View key={key} role="listitem" style={styles.item}>
              <View style={[styles.bullet, { backgroundColor: theme.accent }]} />
              <ThemedText style={styles.itemText}>{t(key)}</ThemedText>
            </View>
          ))}
        </View>
        <ThemedText type="label">{t('premium.price')}</ThemedText>
        <ThemedText>{t('premium.paymentNotYet')}</ThemedText>
      </View>
      <View style={styles.section}>
        <ThemedText type="heading" role="heading" aria-level={2}>
          {t('premium.howHeading')}
        </ThemedText>
        {plan.kind === 'premium' ? (
          <ThemedText type="label">{t('premium.active', { date: dateFormat.format(plan.until) })}</ThemedText>
        ) : (
          <ThemedText>{t('premium.how')}</ThemedText>
        )}
        {account.status === 'signedOut' && (
          <Link href="/account" style={[styles.link, { color: theme.accent }]}>
            {t('premium.signIn')}
          </Link>
        )}
      </View>
    </>
  );
}

export default function PremiumScreen() {
  const theme = useTheme();
  const learner = useLearner();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: t('premium.title') }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <BackLink href="/" label={t('premium.back')} />
          <View style={styles.section}>
            <ThemedText type="title" role="heading" aria-level={1}>
              {t('premium.title')}
            </ThemedText>
            <ThemedText>{t('premium.intro')}</ThemedText>
          </View>
          {/* Plans and payment are for the parent; a child sees the gate. */}
          {learner.status === 'ready' && (learner.child ? <ParentGate child={learner.child} /> : <About />)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center' },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.xxxl,
    gap: Space.xxl,
  },
  section: { gap: Space.lg },
  list: { gap: Space.md },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.md },
  bullet: { width: Space.sm, height: Space.sm, marginTop: Space.sm, borderRadius: 2 },
  itemText: { flex: 1, minWidth: 0 },
  link: {
    alignSelf: 'flex-start',
    minHeight: MinTouchTarget,
    paddingVertical: Space.md,
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.body,
  },
});

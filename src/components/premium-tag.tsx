import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/** A padlock drawn in the accent ink (design.md: no emoji icons); its row says "locked" in words. */
function Lock({ color }: { color: string }) {
  return (
    <View style={styles.lock} testID="premium-lock">
      <View style={[styles.shackle, { borderColor: color }]} />
      <View style={[styles.body, { backgroundColor: color }]} />
    </View>
  );
}

/** "Premium" on a unit that needs it, with a lock while the learner does not have Premium. */
export function PremiumTag({ locked }: { locked: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.tag, { borderColor: theme.accent }]}>
      {locked && <Lock color={theme.accent} />}
      <ThemedText type="meta" style={[styles.text, { color: theme.accent }]}>
        {t('unit.premium')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
  },
  text: { fontFamily: Fonts.semiBold },
  lock: { width: 12, height: 14, alignItems: 'center' },
  shackle: {
    width: 8,
    height: 7,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  body: { width: 12, height: 7, borderRadius: 2 },
});

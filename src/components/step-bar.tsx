import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Where the learner is in a lesson or review: `label` above a bar filled to current/total. */
export function StepBar({ label, current, total }: { label: string; current: number; total: number }) {
  const theme = useTheme();
  return (
    <View style={styles.stepBar}>
      <ThemedText type="meta">{label}</ThemedText>
      <View style={[styles.track, { backgroundColor: theme.line }]} aria-hidden>
        <View style={[styles.bar, { backgroundColor: theme.accent, width: `${(current / total) * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepBar: { gap: Space.xs },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },
});

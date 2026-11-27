import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewProps } from 'react-native';

import { Border, GridCell, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Size = { width: number; height: number };

function offsets(length: number): number[] {
  return Array.from({ length: Math.floor(length / GridCell) }, (_, index) => (index + 1) * GridCell);
}

/** The "vở ô ly" signature: a card on a faint squared notebook grid, for English being taught. */
export function GridCard({ style, children, ...rest }: ViewProps) {
  const theme = useTheme();
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  function onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }

  const line = { backgroundColor: theme.line };

  return (
    <View
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }, style]}
      onLayout={onLayout}
      {...rest}>
      <View style={styles.grid} pointerEvents="none" aria-hidden importantForAccessibility="no-hide-descendants">
        {offsets(size.width).map((left) => (
          <View key={`v${left}`} style={[styles.vertical, line, { left }]} />
        ))}
        {offsets(size.height).map((top) => (
          <View key={`h${top}`} style={[styles.horizontal, line, { top }]} />
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: Border,
    borderRadius: Radius.card,
    overflow: 'hidden',
    padding: Space.xxl,
    gap: Space.sm,
  },
  grid: {
    ...StyleSheet.absoluteFill,
    opacity: 0.5,
  },
  vertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: Border,
  },
  horizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: Border,
  },
});

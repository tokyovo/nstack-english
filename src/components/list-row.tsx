import { Link, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Border, MinTouchTarget, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListRowProps = {
  href: Href;
  /** The whole row is read as one link with this name. */
  accessibilityLabel: string;
  testID?: string;
  children: ReactNode;
};

/** A bordered row that opens another screen; the list rows of design.md (no shadows). */
export function ListRow({ href, accessibilityLabel, testID, children }: ListRowProps) {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={href} asChild>
      <Pressable
        role="link"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: theme.surface,
            borderColor: hovered || pressed ? theme.accent : theme.line,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        {children}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MinTouchTarget,
    borderWidth: Border,
    borderRadius: Radius.card,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.lg,
    gap: Space.xs,
  },
});

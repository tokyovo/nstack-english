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
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <Link href={href} asChild>
      <Pressable
        role="link"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // One flat style object: Link's asChild on web drops style functions and breaks on nested arrays.
        style={StyleSheet.flatten([
          styles.row,
          {
            backgroundColor: theme.surface,
            borderColor: hovered || pressed ? theme.accent : theme.line,
            opacity: pressed ? 0.85 : 1,
          },
          focused && styles.focused,
          focused && { outlineColor: theme.accent },
        ])}>
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
  focused: {
    outlineStyle: 'solid',
    outlineWidth: 2,
    outlineOffset: 2,
  },
});

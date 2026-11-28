import { Link, type Href } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Fonts, FontSize, MinTouchTarget, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  href: Href;
  label: string;
  /** A fuller name for screen readers; it must contain the visible label. */
  accessibilityLabel?: string;
};

/** A quiet text link at the top of a screen that leaves it for the one above. */
export function BackLink({ href, label, accessibilityLabel }: Props) {
  const theme = useTheme();
  return (
    <Link
      href={href}
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
      style={[styles.back, { color: theme.accent }]}>
      {label}
    </Link>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    minHeight: MinTouchTarget,
    paddingVertical: Space.md,
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.body,
  },
});

import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { Border, Fonts, FontSize, MinTouchTarget, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  /** One primary action per screen; the others are secondary. `danger` confirms a deletion. */
  kind?: 'primary' | 'secondary' | 'danger';
};

/**
 * A full-width button with its pressed, focus and disabled states drawn from the tokens.
 * Inside `<Link asChild>` it receives role "link" and an href, so it navigates like a link.
 */
export function ActionButton({ label, kind = 'primary', disabled, style, role = 'button', ...rest }: Props) {
  const theme = useTheme();
  const filled = kind === 'secondary' ? null : kind === 'danger' ? theme.danger : theme.accent;

  return (
    <Pressable
      role={role}
      accessibilityRole={role === 'link' ? 'link' : 'button'}
      aria-disabled={disabled ?? undefined}
      accessibilityState={{ disabled: disabled ?? false }}
      disabled={disabled}
      style={(state) => [
        styles.button,
        {
          backgroundColor: filled ?? theme.surface,
          borderColor: filled ?? theme.line,
          opacity: disabled ? 0.45 : state.pressed ? 0.85 : 1,
        },
        // react-native-web passes `focused` for keyboard focus; native ignores it.
        'focused' in state && state.focused ? { outlineColor: theme.text, outlineWidth: 2, outlineOffset: 2 } : null,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <Text style={[styles.label, { color: filled ? theme.surface : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MinTouchTarget,
    borderWidth: Border,
    borderRadius: Radius.control,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.body,
    lineHeight: 24,
    textAlign: 'center',
  },
});

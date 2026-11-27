import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { Border, Fonts, FontSize, MinTouchTarget, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  /** One primary action per screen; the others are secondary. */
  kind?: 'primary' | 'secondary';
};

/** A full-width button with its pressed, focus and disabled states drawn from the tokens. */
export function ActionButton({ label, kind = 'primary', disabled, style, ...rest }: Props) {
  const theme = useTheme();
  const primary = kind === 'primary';

  return (
    <Pressable
      role="button"
      accessibilityRole="button"
      aria-disabled={disabled ?? undefined}
      accessibilityState={{ disabled: disabled ?? false }}
      disabled={disabled}
      style={(state) => [
        styles.button,
        {
          backgroundColor: primary ? theme.accent : theme.surface,
          borderColor: primary ? theme.accent : theme.line,
          opacity: disabled ? 0.45 : state.pressed ? 0.85 : 1,
        },
        // react-native-web passes `focused` for keyboard focus; native ignores it.
        'focused' in state && state.focused ? { outlineColor: theme.text, outlineWidth: 2, outlineOffset: 2 } : null,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <Text style={[styles.label, { color: primary ? theme.surface : theme.text }]}>{label}</Text>
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

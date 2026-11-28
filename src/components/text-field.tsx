import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Border, Fonts, FontSize, MinTouchTarget, Radius, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = Omit<TextInputProps, 'style' | 'accessibilityLabel' | 'aria-label'> & {
  /** Visible above the input and its accessible name. */
  label: string;
  /** Short help under the label, such as a password rule. */
  hint?: string;
  /** Shown under the input in the danger colour; the input is then marked invalid. */
  error?: string;
  /** The input's id; its error text gets `<nativeID>-error`, its hint `<nativeID>-hint`. */
  nativeID: string;
};

/** A labelled text input with its hint and error next to it, drawn from the tokens. */
export const TextField = forwardRef<TextInputInstance, Props>(function TextField(
  { label, hint, error, nativeID, onFocus, onBlur, ...rest },
  ref
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const hintId = `${nativeID}-hint`;
  const errorId = `${nativeID}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  const borderColor = error ? theme.danger : focused ? theme.accent : theme.line;

  return (
    <View style={styles.field}>
      <ThemedText type="label">
        {label}
      </ThemedText>
      {hint && (
        <ThemedText type="meta" nativeID={hintId}>
          {hint}
        </ThemedText>
      )}
      <TextInput
        ref={ref}
        nativeID={nativeID}
        accessibilityLabel={label}
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        placeholderTextColor={theme.muted}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor,
            borderWidth: focused || error ? 2 : Border,
          },
        ]}
        {...rest}
      />
      {error && (
        <ThemedText nativeID={errorId} style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: Space.sm },
  input: {
    minHeight: MinTouchTarget + Space.sm,
    borderRadius: Radius.control,
    paddingHorizontal: Space.lg,
    fontFamily: Fonts.regular,
    fontSize: FontSize.large,
  },
});

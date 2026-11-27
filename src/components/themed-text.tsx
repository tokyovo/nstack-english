import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'body' | 'lead' | 'title' | 'word';
};

export function ThemedText({ style, type = 'body', ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const color = type === 'word' ? theme.accent : theme.text;

  return <Text style={[{ color }, styles[type], style]} {...rest} />;
}

// Line heights are generous so Vietnamese stacked diacritics never clip.
const styles = StyleSheet.create({
  body: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.body,
    lineHeight: 24,
  },
  lead: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.large,
    lineHeight: 29,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.title,
    lineHeight: 44,
  },
  word: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.word,
    lineHeight: 52,
  },
});

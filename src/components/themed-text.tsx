import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, FontSize, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'body' | 'lead' | 'title' | 'heading' | 'label' | 'meta' | 'word';
};

/** Every type is in the text colour except the English being taught (accent) and metadata (muted). */
function colorOf(type: NonNullable<ThemedTextProps['type']>, theme: ThemeColors): string {
  if (type === 'word') return theme.accent;
  if (type === 'meta') return theme.muted;
  return theme.text;
}

export function ThemedText({ style, type = 'body', ...rest }: ThemedTextProps) {
  const theme = useTheme();
  return <Text style={[{ color: colorOf(type, theme) }, styles[type], style]} {...rest} />;
}

// react-native-web renders `lang` on the DOM node; React Native's types do not list it.
const english = { accessibilityLanguage: 'en', lang: 'en' };

/**
 * The English being taught. Screen readers pronounce it as English, on native through
 * accessibilityLanguage and on web (page lang "vi") through lang="en".
 */
export function EnglishText(props: Omit<ThemedTextProps, 'accessibilityLanguage'>) {
  return <ThemedText {...props} {...english} />;
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
  heading: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.h3,
    lineHeight: 32,
  },
  label: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.large,
    lineHeight: 28,
  },
  meta: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.body,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  word: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.word,
    lineHeight: 52,
  },
});

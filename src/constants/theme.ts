// Design tokens from .nstack/design.md. Components use these, never raw values.

export const Colors = {
  light: {
    background: '#F3F6F4',
    surface: '#FFFFFF',
    text: '#1B2A26',
    muted: '#5A6B66',
    accent: '#5B3FA8',
    success: '#1E7A4C',
    danger: '#B3261E',
    line: '#D6DED9',
  },
  dark: {
    background: '#121816',
    surface: '#1C2421',
    text: '#E8EFEC',
    muted: '#A3B2AD',
    accent: '#B9A6F2',
    success: '#6FD3A0',
    danger: '#F2A49E',
    line: '#2E3A36',
  },
} as const;

export type ThemeColors = (typeof Colors)[keyof typeof Colors];

/** Be Vietnam Pro, one family name per loaded weight (Android ignores fontWeight on custom fonts). */
export const Fonts = {
  regular: 'BeVietnamPro_400Regular',
  semiBold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
} as const;

/** Type scale, ratio 1.2 from 16 px; `word` is the English word on a card. */
export const FontSize = {
  small: 13.3,
  body: 16,
  large: 19.2,
  h3: 23,
  h2: 27.6,
  title: 33.2,
  word: 40,
} as const;

export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = { control: 12, card: 16 } as const;

export const Border = 1;

/** Side of one square of the "vở ô ly" notebook grid. */
export const GridCell = 16;

export const MinTouchTarget = 48;

/** Web shows the app as a centred phone-width column. */
export const MaxContentWidth = 480;

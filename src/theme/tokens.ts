import { StyleSheet } from 'react-native';

export const colors = {
  background: '#0E0F11',
  backgroundElevated: '#141619',
  surface: '#17191C',
  surfaceRaised: '#202328',
  surfaceInteractive: '#25292E',
  surfaceMuted: '#141619',
  surfacePressed: '#25292E',
  border: '#2B2F35',
  borderStrong: '#3A3F46',
  primary: '#E58A3B',
  primaryPressed: '#C96F25',
  primarySoft: 'rgba(229, 138, 59, 0.12)',
  accent: '#F09A4A',
  accentOnColor: '#111214',
  text: '#F2F3F5',
  textMuted: '#A7ADB7',
  textSubtle: '#717782',
  textDisabled: '#565B63',
  success: '#45A56A',
  successSoft: 'rgba(69, 165, 106, 0.12)',
  warning: '#D9A441',
  warningSoft: 'rgba(217, 164, 65, 0.12)',
  danger: '#E05252',
  dangerSoft: 'rgba(224, 82, 82, 0.12)',
  information: '#78909C',
  informationSoft: 'rgba(120, 144, 156, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.72)',
  transparent: 'transparent',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const borders = {
  hairline: StyleSheet.hairlineWidth,
  thin: 1,
  strong: 2,
} as const;

export const shadows = {
  card: '0 8px 20px rgba(0, 0, 0, 0.18)',
  raised: '0 10px 24px rgba(0, 0, 0, 0.22)',
} as const;

export const iconSizes = {
  sm: 18,
  md: 22,
  lg: 26,
  xl: 32,
  hero: 44,
} as const;

export const layout = {
  compactWidth: 380,
  contentMaxWidth: 720,
  contentPadding: 20,
  contentPaddingCompact: 16,
  compactTouchTarget: 44,
  touchTarget: 48,
  tabBarContentHeight: 64,
} as const;

export const typography = {
  size: {
    caption: 12,
    label: 13,
    body: 15,
    bodyLarge: 17,
    heading: 20,
    title: 26,
    display: 32,
    metric: 24,
    brand: 19,
  },
  lineHeight: {
    caption: 16,
    label: 18,
    body: 22,
    bodyLarge: 25,
    heading: 27,
    title: 33,
    display: 38,
    metric: 30,
    brand: 24,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    black: '800',
  },
  letterSpacing: {
    label: 1.2,
    brand: 0.3,
    metric: -0.4,
  },
} as const;

export const theme = {
  borders,
  colors,
  iconSizes,
  layout,
  radii,
  shadows,
  spacing,
  typography,
} as const;

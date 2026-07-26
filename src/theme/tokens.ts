import { StyleSheet } from 'react-native';

export const colors = {
  background: '#050914',
  backgroundElevated: '#080E1C',
  surface: '#0D1424',
  surfaceRaised: '#121C30',
  surfaceInteractive: '#17233A',
  border: '#202D43',
  borderStrong: '#31445F',
  primary: '#2F80FF',
  primaryPressed: '#1D65D8',
  primarySoft: '#112C59',
  accent: '#65D8FF',
  text: '#F7F9FC',
  textMuted: '#A8B3C7',
  textSubtle: '#71809A',
  success: '#4ED7A8',
  warning: '#FFCA65',
  danger: '#FF7285',
  overlay: 'rgba(5, 9, 20, 0.72)',
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
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const borders = {
  hairline: StyleSheet.hairlineWidth,
  thin: 1,
  strong: 2,
} as const;

export const shadows = {
  card: '0 12px 30px rgba(0, 0, 0, 0.24)',
  accent: '0 10px 28px rgba(47, 128, 255, 0.2)',
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
    display: 34,
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
    display: 40,
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

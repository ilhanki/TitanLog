export const colors = {
  background: '#090B10',
  surface: '#11141C',
  surfaceElevated: '#181C26',
  border: '#292E3B',
  primary: '#C7FF4A',
  primaryMuted: '#28351A',
  text: '#F7F8FA',
  textMuted: '#A3A9B8',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 16,
  pill: 999,
} as const;

export const typography = {
  size: {
    caption: 12,
    body: 16,
    heading: 38,
    brand: 18,
  },
  lineHeight: {
    caption: 16,
    body: 24,
    heading: 44,
    brand: 24,
  },
  weight: {
    medium: '500',
    semibold: '600',
    bold: '700',
    black: '900',
  },
  letterSpacing: {
    label: 1.6,
    brand: 0.4,
  },
} as const;

export const theme = {
  colors,
  radii,
  spacing,
  typography,
} as const;

import { Platform } from 'react-native';

export const Colors = {
  red:    '#C8102E',
  green:  '#007A33',
  gold:   '#F4C430',

  bg:      '#0D0D0D',
  surface: '#1A1A2E',
  card:    '#16213E',

  textPrimary:   '#FFFFFF',
  textSecondary: '#A0A0B0',

  success: '#00C853',
  warning: '#FFD600',
  error:   '#FF1744',
  overlay: 'rgba(0,0,0,0.6)',

  indicatorOff:  '#3A3A4A',
  indicatorWarn: '#FFD600',
  indicatorOk:   '#00C853',
} as const;

const mono = Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' });
const sans = Platform.select({ ios: 'System',      android: 'sans-serif', default: 'sans-serif' });

export const Typography = {
  display:  { fontFamily: sans,  fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  title:    { fontFamily: sans,  fontSize: 22, fontWeight: '700' as const },
  subtitle: { fontFamily: sans,  fontSize: 16, fontWeight: '600' as const },
  body:     { fontFamily: sans,  fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption:  { fontFamily: sans,  fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  code:     { fontFamily: mono,  fontSize: 14, fontWeight: '400' as const, letterSpacing: 0.5 },
  codeL:    { fontFamily: mono,  fontSize: 20, fontWeight: '700' as const, letterSpacing: 1 },
} as const;

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const Radius  = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 } as const;

export const Animation = {
  fast:        150,
  normal:      300,
  slow:        500,
  spring:      { damping: 20, stiffness: 90 },
  springSnappy:{ damping: 15, stiffness: 120 },
} as const;

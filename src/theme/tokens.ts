// design tokens for layout, corner radii, fonts, and colors for light and dark modes
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radii = {
  sm: 4,
  md: 8,
  lg: 16,
  full: 9999,
};

export const typography = {
  display: {
    fontSize: 32,
    fontWeight: '700' as const,
  },
  h1: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  h2: {
    fontSize: 20,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  small: {
    fontSize: 13,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 11,
    fontWeight: '400' as const,
  },
};

export const colors = {
  light: {
    primary: '#4f46e5',
    secondary: '#06b6d4',
    background: '#f9fafb',
    surface: '#ffffff',
    text: '#111827',
    textMuted: '#6b7280',
    border: '#e5e7eb',
    danger: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
  },
  dark: {
    primary: '#818cf8',
    secondary: '#22d3ee',
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    border: '#334155',
    danger: '#f87171',
    success: '#34d399',
    warning: '#fbbf24',
  },
};

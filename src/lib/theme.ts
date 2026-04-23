import type { AppearanceSetting, ResolvedTheme } from './types'

export function getSystemResolvedTheme(): ResolvedTheme {
  if (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }

  return 'light'
}

export function resolveTheme(appearance: AppearanceSetting): ResolvedTheme {
  return appearance === 'system' ? getSystemResolvedTheme() : appearance
}

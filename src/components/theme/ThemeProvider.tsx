import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'

import { applySavedPalette } from '@/utils/palette'

type ThemeProviderProps = {
  children: ReactNode
}

function PaletteThemeSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    applySavedPalette(resolvedTheme === 'dark' ? 'dark' : 'light')
  }, [resolvedTheme])

  return null
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <PaletteThemeSync />
      {children}
    </NextThemesProvider>
  )
}

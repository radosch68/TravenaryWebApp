import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { ThemeProvider } from '@/components/theme/ThemeProvider'
import '@/i18n'
import { applySavedPalette } from '@/utils/palette'

import './index.css'
import App from './App.tsx'

applySavedPalette()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)

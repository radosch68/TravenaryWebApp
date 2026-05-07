import type { CSSProperties, ReactElement } from 'react'
import { useState } from 'react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'

import { AppShell } from '@/components/layout/AppShell'
import {
  PALETTES,
  applyPaletteById,
  getSavedPaletteId,
  savePaletteId,
  type PaletteDefinition,
  type PaletteId,
} from '@/utils/palette'

import styles from './SettingsPage.module.css'

const CHIP_TOKENS: ReadonlyArray<{ key: string; label: string }> = [
  { key: '--primary', label: 'P' },
  { key: '--secondary', label: 'S' },
  { key: '--accent', label: 'A' },
  { key: '--destructive', label: 'D' },
  { key: '--background', label: 'BG' },
  { key: '--foreground', label: 'FG' },
]

function palettePreviewStyle(palette: PaletteDefinition): CSSProperties {
  return palette.tokens as CSSProperties
}

export function SettingsPage(): ReactElement {
  const { t } = useTranslation('common')
  const { resolvedTheme } = useTheme()
  const [selectedPalette, setSelectedPalette] = useState<PaletteId>(getSavedPaletteId())

  function onSelectPalette(paletteId: PaletteId): void {
    setSelectedPalette(paletteId)
    applyPaletteById(paletteId, resolvedTheme === 'dark' ? 'dark' : 'light')
    savePaletteId(paletteId)
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <section className={styles.heroCard}>
          <p className={styles.kicker}>{t('navigation.settings')}</p>
          <h1 className={styles.title}>{t('settings.title')}</h1>
          <p className={styles.subtitle}>{t('settings.subtitle')}</p>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>{t('settings.palette.title')}</h2>
          <p className={styles.sectionDescription}>{t('settings.palette.description')}</p>

          <div className={styles.paletteGrid}>
            {PALETTES.map((palette) => {
              const isSelected = palette.id === selectedPalette
              return (
                <button
                  key={palette.id}
                  type="button"
                  className={styles.paletteCard}
                  style={palettePreviewStyle(palette)}
                  data-selected={isSelected ? 'true' : 'false'}
                  onClick={() => onSelectPalette(palette.id)}
                  aria-pressed={isSelected}
                  aria-label={t(palette.labelKey)}
                >
                  <div className={styles.paletteHeader}>
                    <p className={styles.paletteName}>{t(palette.labelKey)}</p>
                    {isSelected ? <span className={styles.selectedPill}>{t('settings.palette.selected')}</span> : null}
                  </div>
                  <p className={styles.paletteDescription}>{t(palette.descriptionKey)}</p>
                  <div className={styles.chipRow}>
                    {CHIP_TOKENS.map((token) => (
                      <span
                        key={token.key}
                        className={styles.colorChip}
                        style={{ background: `var(${token.key})` }}
                        title={token.key}
                        aria-hidden="true"
                      >
                        {token.label}
                      </span>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
import type { FormEvent, ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import {
  fetchAvailableModels,
  getAiGenerationHistoryDetail,
  startAiGeneration,
  type ModelInfo,
} from '@/services/ai-generation-service'

import styles from './AiGenerationStartPage.module.css'

type FormState = {
  prompt: string
  model: string
  draftCount: 1 | 2 | 3
  languageMode: 'auto' | 'curated' | 'other'
  languageCode: 'en' | 'cs-CZ' | 'de' | 'fr' | 'es' | 'it' | 'pt-BR'
  languageOther: string
  departureFrom: string
  timing:
    | ''
    | 'thisWeekend'
    | 'nextWeek'
    | 'nextMonth'
    | 'summerHoliday'
    | 'winterHoliday'
    | 'customDates'
    | 'flexible'
    | 'other'
  timingOther: string
  timingDateFrom: string
  timingDateTo: string
  travelerProfile: '' | 'solo' | 'couple' | 'familyWithKids' | 'friendsGroup' | 'business' | 'other'
  travelerProfileOther: string
  budgetProfile: '' | 'budget' | 'midRange' | 'premium' | 'luxury' | 'other'
  budgetProfileOther: string
  refinementMode: 'balanced' | 'strict'
}

const CURATED_LANGUAGE_CODES = ['en', 'cs-CZ', 'de', 'fr', 'es', 'it', 'pt-BR'] as const
const TIMING_VALUES = [
  'thisWeekend',
  'nextWeek',
  'nextMonth',
  'summerHoliday',
  'winterHoliday',
  'customDates',
  'flexible',
  'other',
] as const
const TRAVELER_VALUES = ['solo', 'couple', 'familyWithKids', 'friendsGroup', 'business', 'other'] as const
const BUDGET_VALUES = ['budget', 'midRange', 'premium', 'luxury', 'other'] as const

const DEFAULT_FORM: FormState = {
  prompt: '',
  model: 'gpt-4o',
  draftCount: 2,
  languageMode: 'auto',
  languageCode: 'en',
  languageOther: '',
  departureFrom: '',
  timing: '',
  timingOther: '',
  timingDateFrom: '',
  timingDateTo: '',
  travelerProfile: '',
  travelerProfileOther: '',
  budgetProfile: '',
  budgetProfileOther: '',
  refinementMode: 'balanced',
}

function trimOrUndefined(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function parseCustomDateRange(value: string | null): { dateFrom: string; dateTo: string } {
  if (!value) {
    return { dateFrom: '', dateTo: '' }
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:\s+to\s+(\d{4}-\d{2}-\d{2}))?$/)
  if (!match) {
    return { dateFrom: '', dateTo: '' }
  }

  return {
    dateFrom: match[1] ?? '',
    dateTo: match[2] ?? '',
  }
}

export function AiGenerationStartPage(): ReactElement {
  const { t } = useTranslation(['ai-generation', 'common'])
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sourceRequestId = searchParams.get('from')
  const sourceDraftId = searchParams.get('sourceDraftId')
  const isRefineMode = Boolean(sourceRequestId && sourceDraftId)

  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPrefilling, setIsPrefilling] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(true)
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    void fetchAvailableModels()
      .then((models) => {
        if (!isMounted || models.length === 0) {
          return
        }

        setAvailableModels(models)

        setForm((previous) => {
          const hasSelectedModel = models.some((model) => model.id === previous.model)
          if (hasSelectedModel) {
            return previous
          }

          const defaultModel = models.find((model) => model.id === 'gpt-4o') ?? models[0]
          return {
            ...previous,
            model: defaultModel.id,
          }
        })
      })
      .catch(() => {
        // If catalog fetch fails, generation still works with current model value.
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!sourceRequestId) {
      return
    }

    const requestId = sourceRequestId
    let isMounted = true

    async function prefillFromHistory(): Promise<void> {
      setIsPrefilling(true)
      setErrorMessage(null)

      try {
        const source = await getAiGenerationHistoryDetail(requestId)
        if (!isMounted) {
          return
        }

        const timingDates = parseCustomDateRange(source.context.timingOther)

        setForm((previous) => ({
          ...previous,
          prompt: isRefineMode ? '' : source.prompt,
          model: source.selectedModel || previous.model,
          draftCount:
            source.requestedDraftCount === 1 ||
            source.requestedDraftCount === 2 ||
            source.requestedDraftCount === 3
              ? source.requestedDraftCount
              : previous.draftCount,
          languageMode: source.context.languageMode ?? 'auto',
          languageCode: source.context.languageCode ?? 'en',
          languageOther: source.context.languageOther ?? '',
          departureFrom: source.context.departureFrom ?? '',
          timing: source.context.timing ?? '',
          timingOther: source.context.timing === 'other' ? source.context.timingOther ?? '' : '',
          timingDateFrom: source.context.timing === 'customDates' ? timingDates.dateFrom : '',
          timingDateTo: source.context.timing === 'customDates' ? timingDates.dateTo : '',
          travelerProfile: source.context.travelerProfile ?? '',
          travelerProfileOther: source.context.travelerProfileOther ?? '',
          budgetProfile: source.context.budgetProfile ?? '',
          budgetProfileOther: source.context.budgetProfileOther ?? '',
          refinementMode: source.refinementMode ?? 'balanced',
        }))
      } catch {
        if (!isMounted) {
          return
        }

        setErrorMessage(t('ai-generation:start.prefillLoadError'))
      } finally {
        if (isMounted) {
          setIsPrefilling(false)
        }
      }
    }

    void prefillFromHistory()

    return () => {
      isMounted = false
    }
  }, [isRefineMode, sourceRequestId, t])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  function languageSelectValue(): string {
    if (form.languageMode === 'curated') {
      return `curated:${form.languageCode}`
    }

    return form.languageMode
  }

  function handleLocateMe(): void {
    if (!navigator.geolocation) {
      return
    }

    setLocating(true)
    setGeoError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`,
          )

          if (response.ok) {
            const data = (await response.json()) as {
              address?: {
                city?: string
                town?: string
                village?: string
                country?: string
              }
            }

            const city = data.address?.city ?? data.address?.town ?? data.address?.village ?? ''
            const country = data.address?.country ?? ''
            const location = [city, country].filter(Boolean).join(', ')
            updateField('departureFrom', location || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`)
          }
        } catch {
          // Keep manual entry available when reverse-geocoding fails.
        }

        setLocating(false)
      },
      (error) => {
        setLocating(false)

        if (error.code === error.PERMISSION_DENIED) {
          setGeoError(t('ai-generation:start.locationDenied'))
        } else {
          setGeoError(t('ai-generation:start.locationFailed'))
        }
      },
      { timeout: 10000, enableHighAccuracy: false },
    )
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    const prompt = form.prompt.trim()
    const languageOther = form.languageOther.trim()
    const timingOther = form.timingOther.trim()
    const travelerProfileOther = form.travelerProfileOther.trim()
    const budgetProfileOther = form.budgetProfileOther.trim()

    if (prompt.length < 20) {
      setErrorMessage(t('ai-generation:start.promptTooShort'))
      return
    }

    if (form.languageMode === 'other' && languageOther.length === 0) {
      setErrorMessage(t('ai-generation:start.languageOtherRequired'))
      return
    }

    if (form.timing === 'other' && timingOther.length === 0) {
      setErrorMessage(t('ai-generation:start.timingOtherRequired'))
      return
    }

    if (form.timing === 'customDates' && form.timingDateFrom.length === 0) {
      setErrorMessage(t('ai-generation:start.timingCustomDatesRequired'))
      return
    }

    if (form.travelerProfile === 'other' && travelerProfileOther.length === 0) {
      setErrorMessage(t('ai-generation:start.travelerProfileOtherRequired'))
      return
    }

    if (form.budgetProfile === 'other' && budgetProfileOther.length === 0) {
      setErrorMessage(t('ai-generation:start.budgetProfileOtherRequired'))
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)

    const timingOtherPayload =
      form.timing === 'other'
        ? trimOrUndefined(form.timingOther)
        : form.timing === 'customDates' && form.timingDateFrom
          ? form.timingDateTo
            ? `${form.timingDateFrom} to ${form.timingDateTo}`
            : form.timingDateFrom
          : undefined

    try {
      const response = await startAiGeneration({
        prompt,
        ...(form.model ? { model: form.model } : {}),
        draftCount: form.draftCount,
        outputDepth: 'detailed',
        languageMode: form.languageMode,
        ...(form.languageMode === 'curated' ? { languageCode: form.languageCode } : {}),
        ...(form.languageMode === 'other' ? { languageOther } : {}),
        ...(trimOrUndefined(form.departureFrom) ? { departureFrom: trimOrUndefined(form.departureFrom) } : {}),
        ...(form.timing ? { timing: form.timing } : {}),
        ...(timingOtherPayload ? { timingOther: timingOtherPayload } : {}),
        ...(form.travelerProfile ? { travelerProfile: form.travelerProfile } : {}),
        ...(form.travelerProfile === 'other' && travelerProfileOther.length > 0
          ? { travelerProfileOther }
          : {}),
        ...(form.budgetProfile ? { budgetProfile: form.budgetProfile } : {}),
        ...(form.budgetProfile === 'other' && budgetProfileOther.length > 0
          ? { budgetProfileOther }
          : {}),
        ...(isRefineMode && sourceRequestId && sourceDraftId
          ? { sourceRequestId, sourceDraftId, refinementMode: form.refinementMode }
          : {}),
      })

      navigate(`/ai-drafts/${response.generationRequestId}`)
    } catch {
      setErrorMessage(t('ai-generation:start.submitError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <section className={styles.headerCard}>
          <div>
            <p className={styles.kicker}>{t('ai-generation:start.kicker')}</p>
            <h1 className={styles.title}>{t('ai-generation:start.title')}</h1>
            <p className={styles.subtitle}>
              {sourceRequestId
                ? isRefineMode
                  ? t('ai-generation:start.subtitleRefine')
                  : t('ai-generation:start.subtitlePrefilled')
                : t('ai-generation:start.subtitleDefault')}
            </p>
          </div>
          <div className={styles.headerActions}>
            <Button asChild variant="outline" size="sm">
              <Link to="/ai-drafts">{t('ai-generation:start.backToList')}</Link>
            </Button>
          </div>
        </section>

        <form className={styles.formCard} onSubmit={(event) => void onSubmit(event)}>
          <label className={styles.fieldWide}>
            <span>
              {isRefineMode
                ? t('ai-generation:start.refineInstructionLabel')
                : t('ai-generation:start.promptLabel')}
            </span>
            <textarea
              value={form.prompt}
              onChange={(event) => {
                updateField('prompt', event.target.value)
              }}
              rows={5}
              maxLength={5000}
              placeholder={
                isRefineMode
                  ? t('ai-generation:start.refineInstructionPlaceholder')
                  : t('ai-generation:start.promptPlaceholder')
              }
            />
          </label>

          {isRefineMode ? (
            <div className={styles.fieldWide}>
              <span>{t('ai-generation:start.refinementModeLabel')}</span>
              <div
                className={styles.segmentedControl}
                role="radiogroup"
                aria-label={t('ai-generation:start.refinementModeLabel')}
              >
                {(['balanced', 'strict'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={form.refinementMode === value}
                    className={`${styles.segmentedButton} ${form.refinementMode === value ? styles.segmentedButtonActive : ''}`}
                    onClick={() => {
                      updateField('refinementMode', value)
                    }}
                  >
                    {t(`ai-generation:start.refinementModeValues.${value}`)}
                  </button>
                ))}
              </div>
              <p className={styles.controlsHint}>
                {t(`ai-generation:start.refinementModeHints.${form.refinementMode}`)}
              </p>
            </div>
          ) : null}

          <details className={styles.promptGuidance}>
            <summary className={styles.promptGuidanceSummary}>
              {isRefineMode
                ? t('ai-generation:start.refineGuidanceTitle')
                : t('ai-generation:start.promptGuidanceTitle')}
            </summary>

            <div className={styles.promptGuidanceContent}>
              <p className={styles.promptGuidanceNote}>
                {isRefineMode
                  ? t('ai-generation:start.refineGuidanceNote')
                  : t('ai-generation:start.promptGuidanceNote')}
              </p>

              <p className={styles.promptExamplesTitle}>
                {isRefineMode
                  ? t('ai-generation:start.refineExamplesTitle')
                  : t('ai-generation:start.promptExamplesTitle')}
              </p>
              <ul className={styles.promptGuidanceList}>
                <li>
                  {isRefineMode
                    ? t('ai-generation:start.refineExample1')
                    : t('ai-generation:start.promptExample1')}
                </li>
                <li>
                  {isRefineMode
                    ? t('ai-generation:start.refineExample2')
                    : t('ai-generation:start.promptExample2')}
                </li>
                <li>
                  {isRefineMode
                    ? t('ai-generation:start.refineExample3')
                    : t('ai-generation:start.promptExample3')}
                </li>
              </ul>
            </div>
          </details>

          <div className={styles.fieldWide}>
            <span>{t('ai-generation:start.draftCountLabel')}</span>
            <div className={styles.segmentedControl} role="radiogroup" aria-label={t('ai-generation:start.draftCountLabel')}>
              {[1, 2, 3].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={form.draftCount === value}
                  className={`${styles.segmentedButton} ${form.draftCount === value ? styles.segmentedButtonActive : ''}`}
                  onClick={() => {
                    updateField('draftCount', value as FormState['draftCount'])
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className={styles.controlsHint}>{t('ai-generation:start.controlsHint')}</p>
          </div>

          <button
            type="button"
            className={styles.advancedToggle}
            onClick={() => {
              setShowAdvanced((previous) => !previous)
            }}
          >
            {t('ai-generation:start.advancedOptions')} {showAdvanced ? '▲' : '▼'}
          </button>

          {showAdvanced ? (
            <>
              <label className={styles.fieldWide}>
                <span>{t('ai-generation:start.languageLabel')}</span>
                <div className={styles.advancedRow}>
                  <select
                    value={languageSelectValue()}
                    onChange={(event) => {
                      const value = event.target.value

                      if (value === 'auto') {
                        updateField('languageMode', 'auto')
                      } else if (value === 'other') {
                        updateField('languageMode', 'other')
                      } else if (value.startsWith('curated:')) {
                        updateField('languageMode', 'curated')
                        updateField('languageCode', value.replace('curated:', '') as FormState['languageCode'])
                      }
                    }}
                  >
                    <option value="auto">{t('ai-generation:start.languageAuto')}</option>
                    {CURATED_LANGUAGE_CODES.map((code) => (
                      <option key={code} value={`curated:${code}`}>
                        {t(`ai-generation:start.languageCodes.${code}`)}
                      </option>
                    ))}
                    <option value="other">{t('ai-generation:start.languageOtherLabel')}</option>
                  </select>
                  {form.languageMode === 'other' ? (
                    <input
                      className={styles.fieldInput}
                      type="text"
                      value={form.languageOther}
                      onChange={(event) => {
                        updateField('languageOther', event.target.value)
                      }}
                      placeholder={t('ai-generation:start.languageOtherPlaceholder')}
                      maxLength={40}
                    />
                  ) : null}
                </div>
              </label>

              <label className={styles.fieldWide}>
                <span>{t('ai-generation:start.departureLabel')}</span>
                <div className={styles.departureGroup}>
                  <input
                    className={styles.fieldInput}
                    type="text"
                    value={form.departureFrom}
                    onChange={(event) => {
                      updateField('departureFrom', event.target.value)
                      setGeoError(null)
                    }}
                    placeholder={t('ai-generation:start.departurePlaceholder')}
                    maxLength={100}
                  />
                  {typeof navigator !== 'undefined' && 'geolocation' in navigator ? (
                    <button
                      type="button"
                      className={styles.locateButton}
                      onClick={handleLocateMe}
                      disabled={locating}
                      aria-label={t('ai-generation:start.locateMe')}
                      title={t('ai-generation:start.locateMe')}
                    >
                      {locating ? '…' : '📍'}
                    </button>
                  ) : null}
                </div>
                {geoError ? <p className={styles.geoError}>{geoError}</p> : null}
              </label>

              <label className={styles.fieldWide}>
                <span>{t('ai-generation:start.timingLabel')}</span>
                <div className={styles.advancedRow}>
                  <select
                    value={form.timing}
                    onChange={(event) => {
                      updateField('timing', event.target.value as FormState['timing'])
                    }}
                  >
                    <option value="">{t('ai-generation:start.timingNone')}</option>
                    {TIMING_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {t(`ai-generation:start.timingValues.${value}`)}
                      </option>
                    ))}
                  </select>
                  {form.timing === 'customDates' ? (
                    <div className={styles.dateRange}>
                      <input
                        className={styles.fieldInput}
                        type="date"
                        value={form.timingDateFrom}
                        onChange={(event) => {
                          updateField('timingDateFrom', event.target.value)
                        }}
                        aria-label={t('ai-generation:start.timingDateFrom')}
                      />
                      <span className={styles.dateSeparator}>-</span>
                      <input
                        className={styles.fieldInput}
                        type="date"
                        value={form.timingDateTo}
                        onChange={(event) => {
                          updateField('timingDateTo', event.target.value)
                        }}
                        min={form.timingDateFrom || undefined}
                        aria-label={t('ai-generation:start.timingDateTo')}
                      />
                    </div>
                  ) : null}
                  {form.timing === 'other' ? (
                    <input
                      className={styles.fieldInput}
                      type="text"
                      value={form.timingOther}
                      onChange={(event) => {
                        updateField('timingOther', event.target.value)
                      }}
                      placeholder={t('ai-generation:start.timingOtherPlaceholder')}
                      maxLength={60}
                    />
                  ) : null}
                </div>
              </label>

              <label className={styles.fieldWide}>
                <span>{t('ai-generation:start.travelerProfileLabel')}</span>
                <div className={styles.advancedRow}>
                  <select
                    value={form.travelerProfile}
                    onChange={(event) => {
                      updateField('travelerProfile', event.target.value as FormState['travelerProfile'])
                    }}
                  >
                    <option value="">{t('ai-generation:start.travelerProfileNone')}</option>
                    {TRAVELER_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {t(`ai-generation:start.travelerProfileValues.${value}`)}
                      </option>
                    ))}
                  </select>
                  {form.travelerProfile === 'other' ? (
                    <input
                      className={styles.fieldInput}
                      type="text"
                      value={form.travelerProfileOther}
                      onChange={(event) => {
                        updateField('travelerProfileOther', event.target.value)
                      }}
                      placeholder={t('ai-generation:start.travelerProfileOtherPlaceholder')}
                      maxLength={60}
                    />
                  ) : null}
                </div>
              </label>

              <label className={styles.fieldWide}>
                <span>{t('ai-generation:start.budgetProfileLabel')}</span>
                <div className={styles.advancedRow}>
                  <select
                    value={form.budgetProfile}
                    onChange={(event) => {
                      updateField('budgetProfile', event.target.value as FormState['budgetProfile'])
                    }}
                  >
                    <option value="">{t('ai-generation:start.budgetProfileNone')}</option>
                    {BUDGET_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {t(`ai-generation:start.budgetProfileValues.${value}`)}
                      </option>
                    ))}
                  </select>
                  {form.budgetProfile === 'other' ? (
                    <input
                      className={styles.fieldInput}
                      type="text"
                      value={form.budgetProfileOther}
                      onChange={(event) => {
                        updateField('budgetProfileOther', event.target.value)
                      }}
                      placeholder={t('ai-generation:start.budgetProfileOtherPlaceholder')}
                      maxLength={60}
                    />
                  ) : null}
                </div>
              </label>

              <label className={styles.fieldWide}>
                <span>{t('ai-generation:start.modelLabel')}</span>
                <select
                  value={form.model}
                  onChange={(event) => {
                    updateField('model', event.target.value)
                  }}
                >
                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}

          <div className={styles.footerActions}>
            <Button type="submit" size="sm" disabled={isSubmitting || isPrefilling}>
              {isSubmitting
                ? t('ai-generation:start.starting')
                : isPrefilling
                  ? t('ai-generation:start.prefilling')
                  : t('ai-generation:start.start')}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}

import type { ReactElement } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { DashboardPaginationBar } from '@/components/DashboardPaginationBar'
import { DraftReviewCarousel } from '@/components/itinerary/DraftReviewCarousel'
import type { DraftItinerary, ModelInfo, OutputDepth } from '@/services/ai-generation.service'
import {
  startGeneration,
  pollForDrafts,
  selectDraft,
  fetchAvailableModels,
  getTimeoutForModel,
  POLL_INTERVAL_MS,
} from '@/services/ai-generation.service'
import { ApiError } from '@/services/contracts'
import type {
  LanguageMode,
  CuratedLanguageCode,
  TimingValue,
  TravelerProfileValue,
  BudgetProfileValue,
  GenerationContextOptions,
} from '@/services/contracts'

const DEPTH_VALUES: OutputDepth[] = ['fast', 'balanced', 'detailed']

const CURATED_LANGUAGE_CODES: CuratedLanguageCode[] = ['en', 'cs-CZ', 'de', 'fr', 'es', 'it', 'pt-BR']
const TIMING_VALUES: TimingValue[] = ['weekend', 'weeklong', 'twoWeeksPlus', 'seasonal', 'holiday', 'other']
const TRAVELER_VALUES: TravelerProfileValue[] = ['solo', 'couple', 'familyWithKids', 'friendsGroup', 'business', 'other']
const BUDGET_VALUES: BudgetProfileValue[] = ['budget', 'midRange', 'premium', 'luxury', 'other']

type ModalStep =
  | 'input'
  | 'loading'
  | 'review'
  | 'saving'
  | 'error'

interface GenerationModalProps {
  onClose: () => void
  onFallback: () => void
}

const DEV_PROMPT_PRESET_IDS = [
  'springKyotoCulture',
  'summerCroatiaSailing',
  'autumnScotlandRoadtrip',
  'winterDolomitesSki',
  'verbosePeruAdventure',
  'eastAfricaSafari',
  'nepalHimalayaTrek',
  'thailandCambodiaTemplesAndIslands',
  'japanGoldenRouteMixedPace',
  'australiaCoastAndNature',
] as const

export function GenerationModal({ onClose, onFallback }: GenerationModalProps): ReactElement {
  const { t } = useTranslation(['ai-generation', 'common'])
  const navigate = useNavigate()

  const [step, setStep] = useState<ModalStep>('input')
  const [prompt, setPrompt] = useState('')
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedPromptPreset, setSelectedPromptPreset] = useState('')
  const [selectedDraftCount, setSelectedDraftCount] = useState<number>(2)
  const [selectedOutputDepth, setSelectedOutputDepth] = useState<OutputDepth>('balanced')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [languageMode, setLanguageMode] = useState<LanguageMode>('auto')
  const [languageCode, setLanguageCode] = useState<CuratedLanguageCode>('en')
  const [languageOther, setLanguageOther] = useState('')
  const [timing, setTiming] = useState<TimingValue | ''>('')
  const [timingOther, setTimingOther] = useState('')
  const [travelerProfile, setTravelerProfile] = useState<TravelerProfileValue | ''>('')
  const [travelerProfileOther, setTravelerProfileOther] = useState('')
  const [budgetProfile, setBudgetProfile] = useState<BudgetProfileValue | ''>('')
  const [budgetProfileOther, setBudgetProfileOther] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [generationRequestId, setGenerationRequestId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<DraftItinerary[]>([])
  const [draftIndex, setDraftIndex] = useState(0)
  const [aiModel, setAiModel] = useState<string | undefined>()
  const [aiResponseTimeMs, setAiResponseTimeMs] = useState<number | undefined>()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [pollCycleKey, setPollCycleKey] = useState(0)
  const [isPolling, setIsPolling] = useState(false)
  const abortRef = useRef<boolean>(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const pollTimerRef = useRef<number | null>(null)
  const countdownTimerRef = useRef<number | null>(null)
  const deadlineRef = useRef<number>(0)
  const isMountedRef = useRef(true)

  const clearTimers = useCallback((): void => {
    if (pollTimerRef.current != null) { window.clearTimeout(pollTimerRef.current); pollTimerRef.current = null }
    if (countdownTimerRef.current != null) { window.clearInterval(countdownTimerRef.current); countdownTimerRef.current = null }
  }, [])

  const handleCancel = useCallback((): void => {
    abortRef.current = true
    abortControllerRef.current?.abort()
    clearTimers()
    onClose()
  }, [onClose, clearTimers])

  const handlePollResult = useCallback((result: Awaited<ReturnType<typeof pollForDrafts>>): void => {
    if (!isMountedRef.current || abortRef.current) return

    if (result.status === 'completed' && result.drafts && result.drafts.length > 0) {
      clearTimers()
      setIsPolling(false)
      setDrafts(result.drafts)
      setDraftIndex(0)
      setAiModel(result.aiModel)
      setAiResponseTimeMs(result.aiResponseTimeMs)
      setStep('review')
    } else if (result.status === 'completed') {
      clearTimers()
      setIsPolling(false)
      setErrorMessage(t('ai-generation:modal.errorTitle'))
      setStep('error')
    } else if (result.status === 'failed') {
      clearTimers()
      setIsPolling(false)
      setErrorMessage(result.errorMessage ?? t('ai-generation:modal.errorTitle'))
      setStep('error')
    }
    // status === 'pending' → auto-poll timer will fire next
  }, [clearTimers, t])

  const schedulePollCycle = useCallback((reqId: string, signal: AbortSignal): void => {
    if (abortRef.current || signal.aborted) return

    // Check deadline
    if (Date.now() >= deadlineRef.current) {
      clearTimers()
      setErrorMessage(t('ai-generation:modal.timeoutError'))
      setStep('error')
      return
    }

    setCountdown(POLL_INTERVAL_MS / 1000)
    setIsPolling(false)
    setPollCycleKey(prev => prev + 1)

    // Countdown ticker (updates every second)
    countdownTimerRef.current = window.setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownTimerRef.current !== null) {
            window.clearInterval(countdownTimerRef.current)
            countdownTimerRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Auto-poll after POLL_INTERVAL_MS
    pollTimerRef.current = window.setTimeout(() => {
      void executePoll(reqId, signal)
    }, POLL_INTERVAL_MS)
  }, [clearTimers, t])

  const executePoll = useCallback(async (reqId: string, signal: AbortSignal): Promise<void> => {
    if (abortRef.current || signal.aborted || !isMountedRef.current) return

    clearTimers()
    setIsPolling(true)

    try {
      const result = await pollForDrafts(reqId, signal)
      if (!isMountedRef.current || abortRef.current) return
      handlePollResult(result)
      if (result.status === 'pending') {
        schedulePollCycle(reqId, signal)
      }
    } catch (err: unknown) {
      if (!isMountedRef.current || abortRef.current) return
      if (err instanceof ApiError && err.code === 'REQUEST_ABORTED') return
      clearTimers()
      setIsPolling(false)
      setErrorMessage(resolveErrorMessage(err, t))
      setStep('error')
    }
  }, [clearTimers, handlePollResult, schedulePollCycle, t])

  const handleCheckNow = useCallback((): void => {
    if (!generationRequestId || !abortControllerRef.current) return
    void executePoll(generationRequestId, abortControllerRef.current.signal)
  }, [generationRequestId, executePoll])

  useEffect(() => {
    isMountedRef.current = true

    fetchAvailableModels().then((models) => {
      if (isMountedRef.current && models.length > 0) {
        setAvailableModels(models)
        const defaultModel = models.find((m) => m.id === 'gpt-4o') ?? models[0]
        setSelectedModel(defaultModel.id)
      }
    }).catch(() => { /* fallback: dropdown stays empty, generation uses server default */ })

    return () => {
      isMountedRef.current = false
      abortRef.current = true
      abortControllerRef.current?.abort()
      clearTimers()
    }
  }, [clearTimers])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        handleCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCancel])

  const handleGenerate = async (): Promise<void> => {
    if (prompt.trim().length === 0) {
      onFallback()
      return
    }

    if (prompt.trim().length < 20) {
      setErrorMessage(t('ai-generation:modal.validationError'))
      return
    }

    setErrorMessage(null)
    setStep('loading')
    setCountdown(0)
    setPollCycleKey(0)
    setIsPolling(false)
    setGenerationRequestId(null)
    setDrafts([])
    setDraftIndex(0)
    setAiModel(undefined)
    setAiResponseTimeMs(undefined)
    setSaveError(null)
    abortRef.current = false
    abortControllerRef.current?.abort()
    clearTimers()
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    deadlineRef.current = Date.now() + getTimeoutForModel(selectedModel)

    try {
      const contextOptions: GenerationContextOptions = {
        languageMode,
        ...(languageMode === 'curated' ? { languageCode } : undefined),
        ...(languageMode === 'other' && languageOther.trim() ? { languageOther: languageOther.trim() } : undefined),
        ...(timing ? { timing } : undefined),
        ...(timing === 'other' && timingOther.trim() ? { timingOther: timingOther.trim() } : undefined),
        ...(travelerProfile ? { travelerProfile } : undefined),
        ...(travelerProfile === 'other' && travelerProfileOther.trim() ? { travelerProfileOther: travelerProfileOther.trim() } : undefined),
        ...(budgetProfile ? { budgetProfile } : undefined),
        ...(budgetProfile === 'other' && budgetProfileOther.trim() ? { budgetProfileOther: budgetProfileOther.trim() } : undefined),
      }

      const { generationRequestId: reqId } = await startGeneration(
        prompt,
        selectedModel,
        abortController.signal,
        selectedDraftCount,
        selectedOutputDepth,
        contextOptions,
      )

      if (!isMountedRef.current || abortController.signal.aborted) {
        return
      }

      setGenerationRequestId(reqId)

      // First poll after 1 second, then every POLL_INTERVAL_MS
      pollTimerRef.current = window.setTimeout(() => {
        void executePoll(reqId, abortController.signal)
      }, 1000)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'REQUEST_ABORTED') {
        if (isMountedRef.current) {
          setStep('input')
        }
        return
      }

      if (!isMountedRef.current) {
        return
      }

      const message = resolveErrorMessage(err, t)
      setErrorMessage(message)
      setStep('error')
    }
  }

  const handleSelectDraft = async (
    draftId: string,
    reqId: string,
    selectedPhotoUrl?: string,
  ): Promise<void> => {
    setStep('saving')
    setSaveError(null)

    try {
      const result = await selectDraft(draftId, reqId, selectedPhotoUrl)
      if (!isMountedRef.current) {
        return
      }
      navigate(`/itineraries/${result.itineraryId}`)
    } catch (err: unknown) {
      if (!isMountedRef.current) {
        return
      }
      const message = resolveErrorMessage(err, t)
      setSaveError(message)
      setStep('review')
    }
  }

  const handleSaveAll = async (
    selections: Array<{ draftId: string; generationRequestId: string; selectedPhotoUrl?: string }>,
  ): Promise<void> => {
    setStep('saving')
    setIsSavingAll(true)
    setSaveError(null)

    try {
      for (const sel of selections) {
        await selectDraft(sel.draftId, sel.generationRequestId, sel.selectedPhotoUrl)
        if (!isMountedRef.current) return
      }
      onClose()
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const message = resolveErrorMessage(err, t)
      setSaveError(message)
      setIsSavingAll(false)
      setStep('review')
    }
  }

  const handleRetry = (): void => {
    clearTimers()
    setCountdown(0)
    setPollCycleKey(0)
    setIsPolling(false)
    setGenerationRequestId(null)
    setErrorMessage(null)
    setStep('input')
  }

  return (
    <div
      className="generation-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('ai-generation:modal.title')}
    >
      <div className="generation-modal">
        <div className="generation-modal__header">
          <h2>{t('ai-generation:modal.title')}</h2>
          <button
            type="button"
            className="generation-modal__close"
            onClick={handleCancel}
            aria-label={t('ai-generation:modal.cancelButton')}
          >
            ×
          </button>
        </div>

        <div className="generation-modal__body">
          {(step === 'input' || (step === 'error' && !generationRequestId)) && (
            <>
              <label htmlFor="generation-prompt" className="generation-modal__label">
                {t('ai-generation:modal.promptLabel')}
              </label>
              <textarea
                id="generation-prompt"
                className="generation-modal__textarea"
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value)
                  setSelectedPromptPreset('')
                }}
                placeholder={t('ai-generation:modal.promptPlaceholder')}
                rows={4}
                maxLength={5000}
              />

              <div className="generation-modal__controls-row">
                <div className="generation-modal__control-group generation-modal__control-group--drafts">
                  <label className="generation-modal__label">
                    {t('ai-generation:modal.draftCountLabel')}
                  </label>
                  <div className="generation-modal__drafts-segmented" role="radiogroup" aria-label={t('ai-generation:modal.draftCountLabel')}>
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={n === selectedDraftCount}
                        className={`generation-modal__depth-seg${n === selectedDraftCount ? ' generation-modal__depth-seg--active' : ''}`}
                        onClick={() => setSelectedDraftCount(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="generation-modal__control-group generation-modal__control-group--depth">
                  <label className="generation-modal__label">
                    {t('ai-generation:modal.outputDepthLabel')}
                  </label>
                  <div className="generation-modal__depth-segmented" role="radiogroup" aria-label={t('ai-generation:modal.outputDepthLabel')}>
                    {DEPTH_VALUES.map((d) => (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={d === selectedOutputDepth}
                        className={`generation-modal__depth-seg${d === selectedOutputDepth ? ' generation-modal__depth-seg--active' : ''}`}
                        onClick={() => setSelectedOutputDepth(d)}
                      >
                        {t(`ai-generation:modal.outputDepth${d.charAt(0).toUpperCase() + d.slice(1)}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <p className="generation-modal__controls-hint">
                {t('ai-generation:modal.controlsHint')}
              </p>

              <button
                type="button"
                className="generation-modal__advanced-toggle"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {t('ai-generation:modal.advancedOptions')} {showAdvanced ? '▲' : '▼'}
              </button>

              {showAdvanced ? (
                <div className="generation-modal__advanced">
                  <div className="generation-modal__advanced-row">
                    <label htmlFor="generation-language" className="generation-modal__label">
                      {t('ai-generation:modal.languageLabel')}
                    </label>
                    <select
                      id="generation-language"
                      value={languageMode === 'curated' ? `curated:${languageCode}` : languageMode}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === 'auto') {
                          setLanguageMode('auto')
                        } else if (val === 'other') {
                          setLanguageMode('other')
                        } else if (val.startsWith('curated:')) {
                          setLanguageMode('curated')
                          setLanguageCode(val.replace('curated:', '') as CuratedLanguageCode)
                        }
                      }}
                    >
                      <option value="auto">{t('ai-generation:modal.languageAuto')}</option>
                      {CURATED_LANGUAGE_CODES.map((code) => (
                        <option key={code} value={`curated:${code}`}>
                          {t(`ai-generation:modal.languageCodes.${code}`)}
                        </option>
                      ))}
                      <option value="other">{t('ai-generation:modal.languageOtherLabel')}</option>
                    </select>
                    {languageMode === 'other' && (
                      <input
                        type="text"
                        className="generation-modal__other-input"
                        value={languageOther}
                        onChange={(e) => setLanguageOther(e.target.value)}
                        placeholder={t('ai-generation:modal.languageOtherPlaceholder')}
                        maxLength={40}
                      />
                    )}
                  </div>

                  <div className="generation-modal__advanced-row">
                    <label htmlFor="generation-timing" className="generation-modal__label">
                      {t('ai-generation:modal.timingLabel')}
                    </label>
                    <select
                      id="generation-timing"
                      value={timing}
                      onChange={(e) => setTiming(e.target.value as TimingValue | '')}
                    >
                      <option value="">{t('ai-generation:modal.timingNone')}</option>
                      {TIMING_VALUES.map((v) => (
                        <option key={v} value={v}>
                          {t(`ai-generation:modal.timingValues.${v}`)}
                        </option>
                      ))}
                    </select>
                    {timing === 'other' && (
                      <input
                        type="text"
                        className="generation-modal__other-input"
                        value={timingOther}
                        onChange={(e) => setTimingOther(e.target.value)}
                        placeholder={t('ai-generation:modal.timingOtherPlaceholder')}
                        maxLength={60}
                      />
                    )}
                  </div>

                  <div className="generation-modal__advanced-row">
                    <label htmlFor="generation-traveler" className="generation-modal__label">
                      {t('ai-generation:modal.travelerProfileLabel')}
                    </label>
                    <select
                      id="generation-traveler"
                      value={travelerProfile}
                      onChange={(e) => setTravelerProfile(e.target.value as TravelerProfileValue | '')}
                    >
                      <option value="">{t('ai-generation:modal.travelerProfileNone')}</option>
                      {TRAVELER_VALUES.map((v) => (
                        <option key={v} value={v}>
                          {t(`ai-generation:modal.travelerProfileValues.${v}`)}
                        </option>
                      ))}
                    </select>
                    {travelerProfile === 'other' && (
                      <input
                        type="text"
                        className="generation-modal__other-input"
                        value={travelerProfileOther}
                        onChange={(e) => setTravelerProfileOther(e.target.value)}
                        placeholder={t('ai-generation:modal.travelerProfileOtherPlaceholder')}
                        maxLength={60}
                      />
                    )}
                  </div>

                  <div className="generation-modal__advanced-row">
                    <label htmlFor="generation-budget" className="generation-modal__label">
                      {t('ai-generation:modal.budgetProfileLabel')}
                    </label>
                    <select
                      id="generation-budget"
                      value={budgetProfile}
                      onChange={(e) => setBudgetProfile(e.target.value as BudgetProfileValue | '')}
                    >
                      <option value="">{t('ai-generation:modal.budgetProfileNone')}</option>
                      {BUDGET_VALUES.map((v) => (
                        <option key={v} value={v}>
                          {t(`ai-generation:modal.budgetProfileValues.${v}`)}
                        </option>
                      ))}
                    </select>
                    {budgetProfile === 'other' && (
                      <input
                        type="text"
                        className="generation-modal__other-input"
                        value={budgetProfileOther}
                        onChange={(e) => setBudgetProfileOther(e.target.value)}
                        placeholder={t('ai-generation:modal.budgetProfileOtherPlaceholder')}
                        maxLength={60}
                      />
                    )}
                  </div>

                  <div className="generation-modal__advanced-row">
                    <label htmlFor="generation-model" className="generation-modal__label">
                      {t('ai-generation:modal.modelLabel')}
                    </label>
                    <select
                      id="generation-model"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                    >
                      {availableModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="generation-modal__advanced-row">
                    <label htmlFor="generation-prompt-preset" className="generation-modal__label">
                      {t('ai-generation:modal.devPromptPresetLabel')}
                    </label>
                    <select
                      id="generation-prompt-preset"
                      value={selectedPromptPreset}
                      onChange={(e) => {
                        const presetId = e.target.value
                        setSelectedPromptPreset(presetId)

                        if (!presetId) {
                          return
                        }

                        setPrompt(t(`ai-generation:modal.devPromptPresets.${presetId}.prompt`))
                        setErrorMessage(null)
                      }}
                    >
                      <option value="">{t('ai-generation:modal.devPromptPresetPlaceholder')}</option>
                      {DEV_PROMPT_PRESET_IDS.map((presetId) => (
                        <option key={presetId} value={presetId}>
                          {t(`ai-generation:modal.devPromptPresets.${presetId}.label`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {errorMessage ? (
                <p className="error generation-modal__error">{errorMessage}</p>
              ) : null}

              <div className="generation-modal__summary-row">
                <span className="generation-modal__summary-chip">
                  <strong>{t('ai-generation:modal.summaryLanguage')}:</strong>{' '}
                  {languageMode === 'auto'
                    ? t('ai-generation:modal.languageAuto')
                    : languageMode === 'curated'
                      ? t(`ai-generation:modal.languageCodes.${languageCode}`)
                      : languageOther.trim() || t('ai-generation:modal.languageOtherLabel')}
                </span>
                <span className="generation-modal__summary-chip">
                  <strong>{t('ai-generation:modal.summaryModel')}:</strong>{' '}
                  {availableModels.find((m) => m.id === selectedModel)?.label ?? selectedModel}
                </span>
                <span className="generation-modal__summary-chip">
                  <strong>{t('ai-generation:modal.summaryOutputScope')}:</strong>{' '}
                  {t(`ai-generation:modal.outputScope${selectedOutputDepth.charAt(0).toUpperCase() + selectedOutputDepth.slice(1)}`)}
                </span>
                {timing && timing !== 'other' && (
                  <span className="generation-modal__summary-chip">
                    <strong>{t('ai-generation:modal.summaryTiming')}:</strong>{' '}
                    {t(`ai-generation:modal.timingValues.${timing}`)}
                  </span>
                )}
                {timing === 'other' && timingOther.trim() && (
                  <span className="generation-modal__summary-chip">
                    <strong>{t('ai-generation:modal.summaryTiming')}:</strong> {timingOther.trim()}
                  </span>
                )}
                {travelerProfile && travelerProfile !== 'other' && (
                  <span className="generation-modal__summary-chip">
                    <strong>{t('ai-generation:modal.summaryTraveler')}:</strong>{' '}
                    {t(`ai-generation:modal.travelerProfileValues.${travelerProfile}`)}
                  </span>
                )}
                {travelerProfile === 'other' && travelerProfileOther.trim() && (
                  <span className="generation-modal__summary-chip">
                    <strong>{t('ai-generation:modal.summaryTraveler')}:</strong> {travelerProfileOther.trim()}
                  </span>
                )}
                {budgetProfile && budgetProfile !== 'other' && (
                  <span className="generation-modal__summary-chip">
                    <strong>{t('ai-generation:modal.summaryBudget')}:</strong>{' '}
                    {t(`ai-generation:modal.budgetProfileValues.${budgetProfile}`)}
                  </span>
                )}
                {budgetProfile === 'other' && budgetProfileOther.trim() && (
                  <span className="generation-modal__summary-chip">
                    <strong>{t('ai-generation:modal.summaryBudget')}:</strong> {budgetProfileOther.trim()}
                  </span>
                )}
              </div>

              <div className="generation-modal__actions">
                <button
                  type="button"
                  className="generation-modal__submit"
                  onClick={() => void handleGenerate()}
                >
                  {t('ai-generation:modal.generateButton')}
                </button>
                <button
                  type="button"
                  className="generation-modal__cancel"
                  onClick={handleCancel}
                >
                  {t('ai-generation:modal.cancelButton')}
                </button>
              </div>
            </>
          )}

          {step === 'loading' && (
            <div className="generation-modal__loading">
              <p className="generation-modal__loading-text">
                {t('ai-generation:modal.generating')}
              </p>
              <p className="generation-modal__loading-hint">
                {t(`ai-generation:modal.generatingHint_${selectedModel}`, {
                  keySeparator: false,
                  defaultValue: t('ai-generation:modal.generatingHint'),
                })}
              </p>
              <button
                type="button"
                className="generation-modal__check-now"
                onClick={handleCheckNow}
                disabled={isPolling}
              >
                {isPolling
                  ? t('ai-generation:modal.checking')
                  : countdown > 0
                    ? t('ai-generation:modal.checkNow', { seconds: countdown })
                    : t('ai-generation:modal.checkNowNoTimer')}
              </button>
              <p className="generation-modal__check-hint">
                {t('ai-generation:modal.checkNowHint')}
              </p>
            </div>
          )}

          {(step === 'review' || step === 'saving') && drafts.length > 0 && generationRequestId ? (
            <>
              <DashboardPaginationBar
                page={draftIndex + 1}
                totalPages={drafts.length}
                onSetPage={(p) => setDraftIndex(p - 1)}
                disabled={step === 'saving'}
                position="top"
                labelKey="ai-generation:carousel.draftOf"
                ariaLabelKey="ai-generation:carousel.navigationAriaLabel"
              />
              <DraftReviewCarousel
                drafts={drafts}
                generationRequestId={generationRequestId}
                onSelectDraft={(draftId, reqId, selectedPhotoUrl) =>
                  void handleSelectDraft(draftId, reqId, selectedPhotoUrl)
                }
                onSaveAll={(selections) => void handleSaveAll(selections)}
                isSaving={step === 'saving'}
                isSavingAll={isSavingAll}
                saveError={saveError}
                currentIndex={draftIndex}
                onIndexChange={setDraftIndex}
                aiModel={aiModel}
                aiResponseTimeMs={aiResponseTimeMs}
              />
              <DashboardPaginationBar
                page={draftIndex + 1}
                totalPages={drafts.length}
                onSetPage={(p) => setDraftIndex(p - 1)}
                disabled={step === 'saving'}
                position="bottom"
                labelKey="ai-generation:carousel.draftOf"
                ariaLabelKey="ai-generation:carousel.navigationAriaLabel"
              />
            </>
          ) : null}

          {step === 'error' && (
            <div className="generation-modal__error-state">
              <p className="error">{errorMessage ?? t('ai-generation:modal.errorTitle')}</p>
              <div className="generation-modal__actions">
                <button
                  type="button"
                  className="generation-modal__submit"
                  onClick={handleRetry}
                >
                  {t('ai-generation:modal.retryButton')}
                </button>
                <button
                  type="button"
                  className="generation-modal__cancel"
                  onClick={onFallback}
                >
                  {t('ai-generation:modal.useTemplateButton')}
                </button>
              </div>
            </div>
          )}
        </div>

        {step === 'loading' && pollCycleKey > 0 && (
          <div className="generation-modal__progress">
            <div
              key={pollCycleKey}
              className={`generation-modal__progress-bar ${pollCycleKey % 2 === 0 ? 'generation-modal__progress-bar--fill' : 'generation-modal__progress-bar--drain'}`}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function resolveErrorMessage(
  err: unknown,
  t: (key: string) => string,
): string {
  if (err instanceof ApiError) {
    if (err.status === 409) {
      return t('ai-generation:modal.conflictError')
    }
    if (err.code === 'GENERATION_TIMEOUT') {
      return t('ai-generation:modal.timeoutError')
    }
    if (err.status === 404) {
      return t('ai-generation:modal.notFoundError')
    }
    return err.message
  }
  if (err instanceof Error) {
    return err.message
  }
  return t('ai-generation:modal.networkError')
}

import type { ReactElement } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DashboardPaginationBar } from '@/components/DashboardPaginationBar'
import { DraftReviewCarousel } from '@/components/itinerary/DraftReviewCarousel'
import type { DraftItinerary } from '@/services/ai-generation.service'
import {
  startGeneration,
  pollUntilComplete,
  selectDraft,
} from '@/services/ai-generation.service'
import { ApiError } from '@/services/contracts'

type ModalStep =
  | 'input'
  | 'loading'
  | 'review'
  | 'saving'
  | 'success'
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

  const [step, setStep] = useState<ModalStep>('input')
  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState<'gpt-4o' | 'gpt-3.5-turbo'>('gpt-4o')
  const [selectedPromptPreset, setSelectedPromptPreset] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [generationRequestId, setGenerationRequestId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<DraftItinerary[]>([])
  const [draftIndex, setDraftIndex] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)
  const abortRef = useRef<boolean>(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(true)
  const successTimeoutRef = useRef<number | null>(null)

  const handleCancel = useCallback((): void => {
    abortRef.current = true
    abortControllerRef.current?.abort()
    onClose()
  }, [onClose])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      abortRef.current = true
      abortControllerRef.current?.abort()
      if (successTimeoutRef.current !== null) {
        window.clearTimeout(successTimeoutRef.current)
      }
    }
  }, [])

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
    abortRef.current = false
    abortControllerRef.current?.abort()
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const { generationRequestId: reqId } = await startGeneration(
        prompt,
        selectedModel,
        abortController.signal,
      )

      if (!isMountedRef.current || abortController.signal.aborted) {
        return
      }

      setGenerationRequestId(reqId)

      const result = await pollUntilComplete(reqId, () => {
        if (abortRef.current) {
          throw new ApiError(499, { code: 'REQUEST_ABORTED', message: 'Request was aborted' })
        }
      }, abortController.signal)

      if (!isMountedRef.current || abortController.signal.aborted) {
        return
      }

      if (result.status === 'completed' && result.drafts && result.drafts.length > 0) {
        setDrafts(result.drafts)
        setDraftIndex(0)
        setStep('review')
      } else {
        setErrorMessage(
          result.errorMessage ?? t('ai-generation:modal.errorTitle'),
        )
        setStep('error')
      }
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
      await selectDraft(draftId, reqId, selectedPhotoUrl)
      if (!isMountedRef.current) {
        return
      }
      setStep('success')
      successTimeoutRef.current = window.setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err: unknown) {
      if (!isMountedRef.current) {
        return
      }
      const message = resolveErrorMessage(err, t)
      setSaveError(message)
      setStep('review')
    }
  }

  const handleRetry = (): void => {
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

              <button
                type="button"
                className="generation-modal__advanced-toggle"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {t('ai-generation:modal.advancedOptions')} {showAdvanced ? '▲' : '▼'}
              </button>

              {showAdvanced ? (
                <div className="generation-modal__advanced">
                  <label htmlFor="generation-model" className="generation-modal__label">
                    {t('ai-generation:modal.modelLabel')}
                  </label>
                  <select
                    id="generation-model"
                    value={selectedModel}
                    onChange={(e) =>
                      setSelectedModel(e.target.value as 'gpt-4o' | 'gpt-3.5-turbo')
                    }
                  >
                    <option value="gpt-4o">
                      {t('ai-generation:modal.modelGpt4o')}
                    </option>
                    <option value="gpt-3.5-turbo">
                      {t('ai-generation:modal.modelGpt35')}
                    </option>
                  </select>

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
              ) : null}

              {errorMessage ? (
                <p className="error generation-modal__error">{errorMessage}</p>
              ) : null}

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
                {t('ai-generation:modal.generatingHint')}
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
                isSaving={step === 'saving'}
                saveError={saveError}
                currentIndex={draftIndex}
                onIndexChange={setDraftIndex}
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

          {step === 'success' && (
            <div className="generation-modal__success">
              <p>{t('ai-generation:carousel.saved')}</p>
            </div>
          )}

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

        {step === 'loading' && (
          <div className="generation-modal__progress">
            <div className="generation-modal__progress-bar" />
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

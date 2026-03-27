import type { ReactElement } from 'react'
import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
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

export function GenerationModal({ onClose, onFallback }: GenerationModalProps): ReactElement {
  const { t } = useTranslation(['ai-generation', 'common'])

  const [step, setStep] = useState<ModalStep>('input')
  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState<'gpt-4o' | 'gpt-3.5-turbo'>('gpt-4o')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [generationRequestId, setGenerationRequestId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<DraftItinerary[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const abortRef = useRef<boolean>(false)

  const handleGenerate = async (): Promise<void> => {
    if (prompt.trim().length < 20) {
      setErrorMessage(t('ai-generation:modal.validationError'))
      return
    }

    setErrorMessage(null)
    setStep('loading')
    abortRef.current = false

    try {
      const { generationRequestId: reqId } = await startGeneration(
        prompt,
        selectedModel,
      )

      setGenerationRequestId(reqId)

      const result = await pollUntilComplete(reqId, () => {
        if (abortRef.current) {
          throw new Error('aborted')
        }
      })

      if (result.status === 'completed' && result.drafts && result.drafts.length > 0) {
        setDrafts(result.drafts)
        setStep('review')
      } else {
        setErrorMessage(
          result.errorMessage ?? t('ai-generation:modal.errorTitle'),
        )
        setStep('error')
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'aborted') {
        setStep('input')
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
  ): Promise<void> => {
    setStep('saving')
    setSaveError(null)

    try {
      await selectDraft(draftId, reqId)
      setStep('success')
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err: unknown) {
      const message = resolveErrorMessage(err, t)
      setSaveError(message)
      setStep('review')
    }
  }

  const handleRetry = (): void => {
    setErrorMessage(null)
    setStep('input')
  }

  const handleCancel = (): void => {
    abortRef.current = true
    onClose()
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
                onChange={(e) => setPrompt(e.target.value)}
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
            <DraftReviewCarousel
              drafts={drafts}
              generationRequestId={generationRequestId}
              onSelectDraft={(draftId, reqId) => void handleSelectDraft(draftId, reqId)}
              isSaving={step === 'saving'}
              saveError={saveError}
            />
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
                  onClick={() => {
                    onClose()
                    onFallback()
                  }}
                >
                  {t('ai-generation:modal.useTemplateButton')}
                </button>
              </div>
            </div>
          )}
        </div>
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
    return err.message
  }
  if (err instanceof Error) {
    return err.message
  }
  return t('ai-generation:modal.networkError')
}

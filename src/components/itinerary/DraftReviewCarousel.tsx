import type { ReactElement } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DraftItinerary } from '@/services/ai-generation.service'
import { formatDateRange } from '@/utils/date-format'

interface DraftReviewCarouselProps {
  drafts: DraftItinerary[]
  generationRequestId: string
  onSelectDraft: (draftId: string, generationRequestId: string) => void
  isSaving: boolean
  saveError: string | null
}

export function DraftReviewCarousel({
  drafts,
  generationRequestId,
  onSelectDraft,
  isSaving,
  saveError,
}: DraftReviewCarouselProps): ReactElement {
  const { t, i18n } = useTranslation(['ai-generation'])
  const [currentIndex, setCurrentIndex] = useState(0)

  const draft = drafts[currentIndex]
  if (!draft) {
    return <p>{t('ai-generation:carousel.draftOf', { current: 1, total: drafts.length })}</p>
  }

  const dateLabel = formatDateRange(draft.startDate, draft.endDate, i18n.language)
  const preview = draft.activities.slice(0, 4)

  return (
    <div className="draft-carousel">
      <div className="draft-carousel__counter">
        {t('ai-generation:carousel.draftOf', { current: currentIndex + 1, total: drafts.length })}
      </div>

      <div className="draft-carousel__card">
        <h3 className="draft-carousel__title">{draft.title}</h3>

        {dateLabel ? (
          <p className="draft-carousel__dates">{dateLabel}</p>
        ) : null}

        {draft.description ? (
          <p className="draft-carousel__description">{draft.description}</p>
        ) : null}

        {preview.length > 0 ? (
          <div className="draft-carousel__activities">
            <p className="draft-carousel__section-label">
              {t('ai-generation:carousel.activityHighlights')}
            </p>
            <ul>
              {preview.map((activity, index) => (
                <li key={`${activity}-${index}`}>{activity}</li>
              ))}
              {draft.activities.length > 4 ? (
                <li>
                  +{draft.activities.length - 4}{' '}
                  {t('ai-generation:carousel.moreActivities', {
                    count: draft.activities.length - 4,
                  })}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {draft.tags.length > 0 ? (
          <div className="draft-carousel__tags" aria-label={t('ai-generation:carousel.tags')}>
            {draft.tags.map((tag) => (
              <span key={tag} className="draft-carousel__tag">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {saveError ? (
          <p className="error draft-carousel__error">{saveError}</p>
        ) : null}

        <button
          type="button"
          className="draft-carousel__select-button"
          disabled={isSaving}
          onClick={() => onSelectDraft(draft._id, generationRequestId)}
        >
          {isSaving
            ? t('ai-generation:carousel.saving')
            : t('ai-generation:carousel.selectButton')}
        </button>
      </div>

      <nav className="draft-carousel__nav" aria-label={t('ai-generation:carousel.navigationAriaLabel')}>
        <button
          type="button"
          disabled={currentIndex <= 0 || isSaving}
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        >
          {t('ai-generation:carousel.prevButton')}
        </button>

        <div className="draft-carousel__dots">
          {drafts.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`draft-carousel__dot${currentIndex === index ? ' draft-carousel__dot--active' : ''}`}
              disabled={isSaving}
              onClick={() => setCurrentIndex(index)}
              aria-label={t('ai-generation:carousel.draftDotAriaLabel', {
                current: index + 1,
                total: drafts.length,
              })}
            />
          ))}
        </div>

        <button
          type="button"
          disabled={currentIndex >= drafts.length - 1 || isSaving}
          onClick={() => setCurrentIndex((i) => Math.min(drafts.length - 1, i + 1))}
        >
          {t('ai-generation:carousel.nextButton')}
        </button>
      </nav>
    </div>
  )
}


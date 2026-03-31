import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DraftItinerary } from '@/services/ai-generation.service'
import { formatDateRange } from '@/utils/date-format'
import { unsplashUrl } from '@/utils/unsplash-url'

interface DraftReviewCarouselProps {
  drafts: DraftItinerary[]
  generationRequestId: string
  onSelectDraft: (draftId: string, generationRequestId: string, selectedPhotoUrl?: string) => void
  isSaving: boolean
  saveError: string | null
  currentIndex: number
  onIndexChange: (index: number) => void
}

export function DraftReviewCarousel({
  drafts,
  generationRequestId,
  onSelectDraft,
  isSaving,
  saveError,
  currentIndex,
  onIndexChange,
}: DraftReviewCarouselProps): ReactElement {
  const { t, i18n } = useTranslation(['ai-generation'])
  const [selectedPhotoIndexes, setSelectedPhotoIndexes] = useState<Record<string, number>>({})

  useEffect(() => {
    const handleArrowNavigation = (event: KeyboardEvent): void => {
      if (isSaving) {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onIndexChange(Math.max(0, currentIndex - 1))
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        onIndexChange(Math.min(drafts.length - 1, currentIndex + 1))
      }
    }

    window.addEventListener('keydown', handleArrowNavigation)
    return () => window.removeEventListener('keydown', handleArrowNavigation)
  }, [drafts.length, isSaving, currentIndex, onIndexChange])

  const draft = drafts[currentIndex]
  if (!draft) {
    return <p>{t('ai-generation:carousel.draftOf', { current: 1, total: drafts.length })}</p>
  }

  const dateLabel = formatDateRange(draft.startDate, draft.endDate, i18n.language)
  const preview = draft.activities.slice(0, 4)
  const legacyCoverPhoto = (draft as DraftItinerary & { coverPhoto?: { url: string; caption?: string | null } | null }).coverPhoto
  const photoOptions = draft.coverPhotoOptions ?? []
  const photoSelectionKey = `${generationRequestId}:${draft._id}`
  const selectedPhotoIndex = selectedPhotoIndexes[photoSelectionKey] ?? 0
  const selectedPhoto = photoOptions[selectedPhotoIndex] ?? photoOptions[0] ?? legacyCoverPhoto ?? null

  return (
    <div className="draft-carousel">
      <div className="draft-carousel__card">
        <h3 className="draft-carousel__title">{draft.title}</h3>

        {selectedPhoto?.url ? (
          <figure className="draft-carousel__media">
            <div className="draft-carousel__media-layout">
              {photoOptions.length > 0 ? (
                <div className="draft-photo-strip" role="group" aria-label={t('ai-generation:carousel.photoOptionsAriaLabel')}>
                  {photoOptions.map((photo, index) => (
                    <button
                      key={`${photo.url}-${index}`}
                      type="button"
                      className={`draft-photo-thumb${selectedPhotoIndex === index ? ' draft-photo-thumb--selected' : ''}`}
                      onClick={() =>
                        setSelectedPhotoIndexes((prev) => ({
                          ...prev,
                          [photoSelectionKey]: index,
                        }))
                      }
                      disabled={isSaving}
                      aria-label={photo.caption ?? draft.title}
                    >
                      <img src={unsplashUrl(photo.url, 120)} alt="" aria-hidden="true" loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : null}

              <img
                className="draft-carousel__image"
                src={unsplashUrl(selectedPhoto.url, 600)}
                alt={selectedPhoto.caption ?? draft.title}
                title={selectedPhoto.caption ?? draft.title}
                loading="lazy"
              />
            </div>
            {selectedPhoto.caption ? (
              <figcaption className="draft-carousel__caption">{selectedPhoto.caption}</figcaption>
            ) : null}
          </figure>
        ) : null}

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
            </ul>
            {draft.activities.length > 4 ? (
              <details className="draft-carousel__more-activities">
                <summary>
                  +{draft.activities.length - 4}{' '}
                  {t('ai-generation:carousel.moreActivities', {
                    count: draft.activities.length - 4,
                  })}
                </summary>
                <ul>
                  {draft.activities.slice(4).map((activity, index) => (
                    <li key={`${activity}-${index}`}>{activity}</li>
                  ))}
                </ul>
              </details>
            ) : null}
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
          onClick={() => onSelectDraft(draft._id, generationRequestId, selectedPhoto?.url)}
        >
          {isSaving
            ? t('ai-generation:carousel.saving')
            : t('ai-generation:carousel.selectButton')}
        </button>
      </div>
    </div>
  )
}


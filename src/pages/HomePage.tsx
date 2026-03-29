import type { ReactElement } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Header } from '@/components/Header'
import { Breadcrumb } from '@/components/Breadcrumb'
import { ItineraryList } from '@/components/itinerary/ItineraryList'
import { GenerationModal } from '@/components/itinerary/GenerationModal'
import { createItineraryFromTemplate, listItineraries } from '@/services/itinerary-service'
import type { ItinerarySummary } from '@/services/contracts'
import { useProfileStore } from '@/store/profile-store'

const ITINERARY_PAGE_SIZE = 4

export function HomePage(): ReactElement {
  const { t } = useTranslation(['common', 'ai-generation'])
  const profile = useProfileStore((state) => state.profile)
  const [items, setItems] = useState<ItinerarySummary[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [createState, setCreateState] = useState<'idle' | 'creating' | 'error'>('idle')
  const [isGenerationModalOpen, setIsGenerationModalOpen] = useState(false)
  const totalPages = Math.max(1, Math.ceil(total / ITINERARY_PAGE_SIZE))

  const fetchItems = useCallback(async (): Promise<void> => {
    setLoadState('loading')
    try {
      const response = await listItineraries({
        page,
        limit: ITINERARY_PAGE_SIZE,
        sortBy: 'plannedStartDate',
        sortOrder: 'asc',
      })
      setItems(response.items)
      setTotal(response.total)

      const computedTotalPages = Math.max(1, Math.ceil(response.total / response.limit))
      if (response.page > computedTotalPages) {
        setPage(computedTotalPages)
        return
      }

      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [page])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetchItems()
    }, 0)

    return () => window.clearTimeout(handle)
  }, [fetchItems])

  const handleCreate = async (): Promise<void> => {
    setCreateState('creating')
    try {
      await createItineraryFromTemplate()
    } catch {
      setCreateState('error')
      return
    }
    setCreateState('idle')
    await fetchItems()
  }

  return (
    <main className="app-shell">
      <Header />
      <Breadcrumb items={[{ icon: 'home', ariaLabel: t('common:navigation.dashboard') }]} />
      <section className="home-panel">
        <h1>{profile?.displayName || profile?.email}</h1>
        <div className="dashboard-actions">
          <h2 className="dashboard-actions__heading">
            {t('common:itinerary.itineraries', { count: total })}
          </h2>
          <button
            type="button"
            onClick={() => setIsGenerationModalOpen(true)}
            className="dashboard-actions__ai-button"
            aria-label={t('ai-generation:generateWithAi')}
          >
            <span aria-hidden="true">✨</span> {t('ai-generation:generateWithAi')}
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={createState === 'creating'}
            className="dashboard-actions__add-button"
            aria-label={t('common:createItinerary')}
          >
            {createState === 'creating' ? t('common:itinerary.creating') : '+'}
          </button>
        </div>
        {createState === 'error' ? (
          <p className="error">
            {t('common:itinerary.createError')}{' '}
            <button type="button" onClick={() => void handleCreate()}>
              {t('common:itinerary.retry')}
            </button>
          </p>
        ) : null}

        {loadState === 'loading' || loadState === 'idle' ? <p>{t('common:itinerary.loading')}</p> : null}

        {loadState === 'error' ? (
          <p className="error">
            {t('common:itinerary.loadError')}{' '}
            <button type="button" onClick={() => void fetchItems()}>
              {t('common:itinerary.retry')}
            </button>
          </p>
        ) : null}

        {loadState === 'ready' && items.length === 0 ? <p>{t('common:itinerary.empty')}</p> : null}

        {loadState === 'ready' && items.length > 0 ? <ItineraryList items={items} /> : null}

        {loadState === 'ready' && total > ITINERARY_PAGE_SIZE ? (
          <nav className="itinerary-pagination" aria-label={t('common:itinerary.pagination.ariaLabel')}>
            <button
              type="button"
              onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              disabled={page <= 1}
            >
              {t('common:itinerary.pagination.previous')}
            </button>
            <p>
              {t('common:itinerary.pagination.pageIndicator', {
                page,
                totalPages,
              })}
            </p>
            <button
              type="button"
              onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
              disabled={page >= totalPages}
            >
              {t('common:itinerary.pagination.next')}
            </button>
          </nav>
        ) : null}
      </section>

      {isGenerationModalOpen ? (
        <GenerationModal
          onClose={() => {
            setIsGenerationModalOpen(false)
            void fetchItems()
          }}
          onFallback={() => {
            setIsGenerationModalOpen(false)
            void handleCreate()
          }}
        />
      ) : null}
    </main>
  )
}

import type { ReactElement } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Header } from '@/components/Header'
import { ItineraryList } from '@/components/itinerary/ItineraryList'
import { createItineraryFromTemplate, listItineraries } from '@/services/itinerary-service'
import type { ItinerarySummary } from '@/services/contracts'
import { useProfileStore } from '@/store/profile-store'

export function HomePage(): ReactElement {
  const { t } = useTranslation(['common'])
  const profile = useProfileStore((state) => state.profile)
  const [items, setItems] = useState<ItinerarySummary[]>([])
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [createState, setCreateState] = useState<'idle' | 'creating' | 'error'>('idle')

  const fetchItems = useCallback(async (): Promise<void> => {
    setLoadState('loading')
    try {
      const response = await listItineraries({ sortBy: 'plannedStartDate', sortOrder: 'asc' })
      setItems(response.items)
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [])

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
      setCreateState('idle')
      await fetchItems()
    } catch {
      setCreateState('error')
    }
  }

  return (
    <main className="app-shell">
      <Header />
      <section className="home-panel">
        <h1>{profile?.displayName || profile?.email}</h1>
        <p>{t('common:homePlaceholder')}</p>
        <div className="dashboard-actions">
          <button type="button" onClick={() => void handleCreate()} disabled={createState === 'creating'}>
            {createState === 'creating' ? t('common:itinerary.creating') : t('common:createItinerary')}
          </button>
          {createState === 'error' ? (
            <p className="error">
              {t('common:itinerary.createError')}{' '}
              <button type="button" onClick={() => void handleCreate()}>
                {t('common:itinerary.retry')}
              </button>
            </p>
          ) : null}
        </div>

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
      </section>
    </main>
  )
}

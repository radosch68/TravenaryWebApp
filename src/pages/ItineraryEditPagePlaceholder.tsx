import { ArrowLeft } from 'lucide-react'
import type { ReactElement } from 'react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { updateLastOpenedItinerary } from '@/services/profile-service'
import { useProfileStore } from '@/store/profile-store'

import styles from './ItineraryViewPage.module.css'

export function ItineraryEditPagePlaceholder(): ReactElement {
  const navigate = useNavigate()
  const { itineraryId } = useParams<{ itineraryId: string }>()
  const { t } = useTranslation('common')
  const profileLastOpenedItineraryId = useProfileStore((state) => state.lastOpenedItinerary?.itineraryId ?? null)
  const setProfileStore = useProfileStore((state) => state.setProfile)

  useEffect(() => {
    if (!itineraryId) {
      return
    }

    if (profileLastOpenedItineraryId === itineraryId) {
      return
    }

    void updateLastOpenedItinerary(itineraryId)
      .then((updatedProfile) => {
        setProfileStore(
          updatedProfile.displayName ?? null,
          updatedProfile.email,
          updatedProfile.lastOpenedItinerary ?? null,
        )
      })
      .catch(() => {
        // Non-fatal: profile refresh will eventually re-sync persisted resume target.
      })
  }, [itineraryId, profileLastOpenedItineraryId, setProfileStore])

  return (
    <AppShell>
      <section className={styles.stateCard}>
        <p>{t('itineraryView.editPagePlaceholder')}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate(`/itineraries/${itineraryId ?? ''}`)}
        >
          <ArrowLeft aria-hidden="true" />
          {t('itineraryView.backToView')}
        </Button>
      </section>
    </AppShell>
  )
}

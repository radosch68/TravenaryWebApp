import { ArrowLeft } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'

import styles from './ItineraryViewPage.module.css'

export function ItineraryEditPagePlaceholder(): ReactElement {
  const navigate = useNavigate()
  const { itineraryId } = useParams<{ itineraryId: string }>()
  const { t } = useTranslation('common')

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

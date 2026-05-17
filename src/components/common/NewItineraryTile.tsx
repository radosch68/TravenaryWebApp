import { Plus, Sparkles } from 'lucide-react'
import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'

import styles from './NewItineraryTile.module.css'

type NewItineraryTileProps = {
  className?: string
  newItineraryLabel: string
  aiHref: string
  aiLabel: string
  manualHref?: string
  manualOnClick?: () => void
  manualDisabled?: boolean
  manualLabel: string
}

export function NewItineraryTile({
  className,
  newItineraryLabel,
  aiHref,
  aiLabel,
  manualHref,
  manualOnClick,
  manualDisabled,
  manualLabel,
}: NewItineraryTileProps): ReactElement {
  return (
    <section className={cn(styles.tile, className)} aria-label={newItineraryLabel}>
      <div className={styles.plusWrap} aria-hidden="true">
        <span className={styles.plusCircle}>
          <Plus className={styles.plusIcon} />
        </span>
      </div>

      <p className={styles.newItineraryLabel}>{newItineraryLabel}</p>

      <div className={styles.modeActions}>
        <Button asChild type="button" size="sm" className={styles.modeAction}>
          <Link to={aiHref}>
            <Sparkles aria-hidden="true" />
            {aiLabel}
          </Link>
        </Button>

        {manualOnClick ? (
          <Button
            type="button"
            size="sm"
            className={styles.modeAction}
            onClick={manualOnClick}
            disabled={manualDisabled}
          >
            {manualLabel}
          </Button>
        ) : (
          <Button asChild type="button" size="sm" className={styles.modeAction}>
            <Link to={manualHref ?? '/itineraries'}>{manualLabel}</Link>
          </Button>
        )}
      </div>
    </section>
  )
}

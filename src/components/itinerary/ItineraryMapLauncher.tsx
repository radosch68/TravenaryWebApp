import { Map } from 'lucide-react'
import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'

import type { LocationMapPin } from './location-map-pins'
import styles from './ItineraryMapLauncher.module.css'

interface ItineraryMapLauncherProps {
  pins: LocationMapPin[]
  title: string
  emptyLabel: string
  openLabel: string
  to: string | null
  className?: string
}

function getMapRouteLabel(pins: LocationMapPin[]): string {
  if (pins.length === 0) {
    return ''
  }

  const firstPin = pins[0]
  const lastPin = pins[pins.length - 1]
  const firstLabel = firstPin.locationLabel?.trim() || firstPin.activityTitle
  const lastLabel = lastPin.locationLabel?.trim() || lastPin.activityTitle

  return firstLabel === lastLabel ? firstLabel : `${firstLabel} → ${lastLabel}`
}

export function ItineraryMapLauncher({
  pins,
  title,
  emptyLabel,
  openLabel,
  to,
  className,
}: ItineraryMapLauncherProps): ReactElement {
  const routeLabel = getMapRouteLabel(pins)
  const rootClassName = `${styles.mapSection}${className ? ` ${className}` : ''}`
  const hasTarget = pins.length > 0 && Boolean(to)

  return (
    <section className={rootClassName} aria-label={title}>
      {hasTarget ? (
        <Link
          className={styles.mapLauncher}
          to={to ?? '#'}
          aria-label={openLabel}
          title={openLabel}
        >
          <div className={styles.mapLauncherCopy}>
            <Map size={36} aria-hidden="true" />
            <div>
              <h2 className={styles.mapTitle}>{title}</h2>
              <p className={styles.mapCount}>{routeLabel}</p>
            </div>
          </div>
        </Link>
      ) : (
        <div className={`${styles.mapLauncher} ${styles.mapLauncherDisabled}`}>
          <div className={styles.mapLauncherCopy}>
            <Map size={36} aria-hidden="true" />
            <div>
              <h2 className={styles.mapTitle}>{title}</h2>
              <p className={`${styles.mapCount} ${styles.mapCountEmpty}`}>{emptyLabel}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
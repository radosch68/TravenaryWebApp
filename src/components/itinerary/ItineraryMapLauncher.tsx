import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { ArrowSquareOut, MapTrifold } from '@phosphor-icons/react'

import type { LocationMapPin } from './location-map-pins'

interface ItineraryMapLauncherProps {
  pins: LocationMapPin[]
  title: string
  emptyLabel: string
  openLabel: string
  to: string
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
}: ItineraryMapLauncherProps): ReactElement {
  const routeLabel = getMapRouteLabel(pins)

  return (
    <section className="itinerary-detail-panel__map-section" aria-label={title}>
      {pins.length > 0 ? (
        <Link
          className="itinerary-detail-panel__map-launcher"
          to={to}
          target="_blank"
          rel="noreferrer"
          aria-label={openLabel}
          title={openLabel}
        >
          <div className="itinerary-detail-panel__map-launcher-copy">
            <MapTrifold size={40} weight="regular" aria-hidden="true" />
            <div>
              <h2 className="itinerary-detail-panel__map-title">{title}</h2>
              <p className="itinerary-detail-panel__map-count">
                {routeLabel}
              </p>
            </div>
          </div>
          <span className="itinerary-detail-panel__map-open" aria-hidden="true">
            <ArrowSquareOut size={20} weight="bold" aria-hidden="true" />
          </span>
        </Link>
      ) : (
        <div className="itinerary-detail-panel__map-launcher itinerary-detail-panel__map-launcher--disabled">
          <div className="itinerary-detail-panel__map-launcher-copy">
            <MapTrifold size={40} weight="regular" aria-hidden="true" />
            <div>
              <h2 className="itinerary-detail-panel__map-title">{title}</h2>
              <p className="itinerary-detail-panel__map-count itinerary-detail-panel__map-count--empty">
                {emptyLabel}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

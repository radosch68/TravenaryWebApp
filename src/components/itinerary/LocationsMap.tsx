import {
  BedDouble,
  BusFront,
  Car,
  Footprints,
  MapPin,
  Maximize2,
  Minimize2,
  NotebookPen,
  Plane,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useTranslation } from 'react-i18next'
import maplibregl from 'maplibre-gl'

import { formatLocalTime } from '@/utils/date-format'

import { buildGoogleMapsSearchUrl, type LocationMapPin } from './location-map-pins'
import styles from './LocationsMap.module.css'

interface LocationsMapProps {
  pins: LocationMapPin[]
  variant?: 'inline' | 'page'
}

interface WebkitFullscreenDocument extends Document {
  webkitExitFullscreen?: () => Promise<void> | void
  webkitFullscreenElement?: Element | null
  webkitFullscreenEnabled?: boolean
}

interface WebkitFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void
}

interface RouteOverlayState {
  width: number
  height: number
  points: string
}

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
}

const ACTIVITY_MARKER_COLORS: Record<LocationMapPin['activityType'], string> = {
  note: '#8a7a68',
  flight: '#b8860b',
  accommodation: '#7b2d8e',
  transfer: '#1a7fd4',
  poi: '#228b22',
  carRental: '#8b4513',
  custom: '#d2691e',
  food: '#c62828',
  divider: '#8a7a68',
  shopping: '#c2185b',
  tour: '#00796b',
}

const ACTIVITY_MARKER_ICONS: Record<LocationMapPin['activityType'], LucideIcon> = {
  note: NotebookPen,
  flight: Plane,
  accommodation: BedDouble,
  transfer: BusFront,
  poi: MapPin,
  carRental: Car,
  custom: Sparkles,
  food: UtensilsCrossed,
  divider: Sparkles,
  shopping: ShoppingBag,
  tour: Footprints,
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function resolveMapPixelRatio(): number {
  if (typeof window === 'undefined' || typeof window.devicePixelRatio !== 'number') {
    return 1
  }

  const ratio = window.devicePixelRatio
  if (!Number.isFinite(ratio)) {
    return 1
  }

  return Math.max(1, Math.min(ratio, 2))
}

function refreshMapViewport(map: maplibregl.Map | null): void {
  if (!map) {
    return
  }

  map.setPixelRatio(resolveMapPixelRatio())
  map.resize()
  map.triggerRepaint()
}

function buildRoutePointsAttribute(map: maplibregl.Map, pins: LocationMapPin[]): string {
  if (pins.length < 2) {
    return ''
  }

  return pins
    .map((pin) => {
      const projected = map.project([pin.longitude, pin.latitude])
      if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) {
        return ''
      }

      return `${projected.x.toFixed(2)},${projected.y.toFixed(2)}`
    })
    .filter(Boolean)
    .join(' ')
}

function computeRouteOverlayState(
  map: maplibregl.Map,
  pins: LocationMapPin[],
  container: HTMLDivElement | null,
): RouteOverlayState {
  if (!container) {
    return { width: 0, height: 0, points: '' }
  }

  const rect = container.getBoundingClientRect()
  const width = Math.max(0, rect.width)
  const height = Math.max(0, rect.height)

  if (width === 0 || height === 0 || pins.length < 2) {
    return { width, height, points: '' }
  }

  return {
    width,
    height,
    points: buildRoutePointsAttribute(map, pins),
  }
}

function getFullscreenElement(documentRef: Document): Element | null {
  const webkitDocument = documentRef as WebkitFullscreenDocument
  return documentRef.fullscreenElement ?? webkitDocument.webkitFullscreenElement ?? null
}

function canRequestFullscreen(documentRef: Document): boolean {
  const rootElement = documentRef.documentElement as WebkitFullscreenElement
  const webkitDocument = documentRef as WebkitFullscreenDocument

  if (documentRef.fullscreenEnabled === true || webkitDocument.webkitFullscreenEnabled === true) {
    return true
  }

  return typeof rootElement.requestFullscreen === 'function'
    || typeof rootElement.webkitRequestFullscreen === 'function'
}

function canExitFullscreen(documentRef: Document): boolean {
  const webkitDocument = documentRef as WebkitFullscreenDocument
  return typeof documentRef.exitFullscreen === 'function'
    || typeof webkitDocument.webkitExitFullscreen === 'function'
}

async function requestElementFullscreen(element: HTMLElement): Promise<void> {
  const fullscreenElement = element as WebkitFullscreenElement

  if (typeof fullscreenElement.requestFullscreen === 'function') {
    await fullscreenElement.requestFullscreen()
    return
  }

  if (typeof fullscreenElement.webkitRequestFullscreen === 'function') {
    await Promise.resolve(fullscreenElement.webkitRequestFullscreen())
    return
  }

  throw new Error('Fullscreen API unavailable')
}

async function exitElementFullscreen(documentRef: Document): Promise<void> {
  const webkitDocument = documentRef as WebkitFullscreenDocument

  if (typeof documentRef.exitFullscreen === 'function') {
    await documentRef.exitFullscreen()
    return
  }

  if (typeof webkitDocument.webkitExitFullscreen === 'function') {
    await Promise.resolve(webkitDocument.webkitExitFullscreen())
    return
  }

  throw new Error('Fullscreen API unavailable')
}

interface PopupRenderInput {
  pin: LocationMapPin
  pinIndex: number
  locale: string
  dayLabel: string
  activityTypeLabel: string
  openInGoogleMapsLabel: string
}

function toPopupHtml({
  pin,
  pinIndex,
  locale,
  dayLabel,
  activityTypeLabel,
  openInGoogleMapsLabel,
}: PopupRenderInput): string {
  const title = escapeHtml(pin.activityTitle)
  const timeLabel = pin.activityTime ? escapeHtml(formatLocalTime(pin.activityTime, locale)) : ''
  const coordinates = `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`
  const locationLabel = pin.locationLabel ? escapeHtml(pin.locationLabel) : ''
  const googleMapsUrl = buildGoogleMapsSearchUrl(pin.latitude, pin.longitude)

  const metadata = [escapeHtml(activityTypeLabel), timeLabel, escapeHtml(dayLabel)].filter(Boolean).join(' • ')

  return `
    <div class="${styles.popup}">
      <strong class="${styles.popupTitle}">${title}</strong>
      <div class="${styles.popupMeta}">#${pinIndex + 1}${metadata ? ` • ${metadata}` : ''}</div>
      ${locationLabel ? `<div class="${styles.popupLine}">${locationLabel}</div>` : ''}
      <div class="${styles.popupLine}">${escapeHtml(coordinates)}</div>
      <a class="${styles.popupMapLink}" href="${googleMapsUrl}" target="_blank" rel="noreferrer">${escapeHtml(openInGoogleMapsLabel)}</a>
    </div>
  `
}

export function LocationsMap({ pins, variant = 'inline' }: LocationsMapProps): ReactElement {
  const { t, i18n } = useTranslation('common')
  const mapWrapperRef = useRef<HTMLDivElement | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const fullscreenRefreshTimersRef = useRef<number[]>([])
  const markersRef = useRef<maplibregl.Marker[]>([])
  const markerIconRootsRef = useRef<Root[]>([])
  const routeAnimationFrameRef = useRef<number | null>(null)
  const initialMapLoadedRef = useRef(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false)
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false)
  const [routeOverlay, setRouteOverlay] = useState<RouteOverlayState>({
    width: 0,
    height: 0,
    points: '',
  })

  const orderedPins = useMemo(() => pins.map((pin) => ({ ...pin })), [pins])
  const isNativeFullscreenSupported = useMemo(
    () => canRequestFullscreen(document) && canExitFullscreen(document),
    [],
  )
  const isFullscreen = isNativeFullscreen || isPseudoFullscreen

  const scheduleRouteOverlayUpdate = useCallback((map: maplibregl.Map, routePins: LocationMapPin[]): void => {
    if (routeAnimationFrameRef.current !== null) {
      return
    }

    routeAnimationFrameRef.current = window.requestAnimationFrame(() => {
      routeAnimationFrameRef.current = null
      const nextState = computeRouteOverlayState(map, routePins, mapContainerRef.current)
      setRouteOverlay((currentState) => {
        if (
          currentState.width === nextState.width
          && currentState.height === nextState.height
          && currentState.points === nextState.points
        ) {
          return currentState
        }

        return nextState
      })
    })
  }, [])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    let loadTimeoutId: number | null = null
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [14.4, 50.1],
      zoom: 8,
      cooperativeGestures: true,
      attributionControl: { compact: true },
      pixelRatio: resolveMapPixelRatio(),
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')
    map.once('load', () => {
      initialMapLoadedRef.current = true
      if (loadTimeoutId !== null) {
        window.clearTimeout(loadTimeoutId)
      }
      setLoadFailed(false)
    })
    loadTimeoutId = window.setTimeout(() => {
      if (!initialMapLoadedRef.current) {
        setLoadFailed(true)
      }
    }, 10000)
    mapRef.current = map

    return () => {
      if (loadTimeoutId !== null) {
        window.clearTimeout(loadTimeoutId)
      }
      fullscreenRefreshTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      fullscreenRefreshTimersRef.current = []
      if (routeAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(routeAnimationFrameRef.current)
        routeAnimationFrameRef.current = null
      }
      for (const marker of markersRef.current) {
        marker.remove()
      }
      markersRef.current = []
      markerIconRootsRef.current.forEach((root) => root.unmount())
      markerIconRootsRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const mapWrapper = mapWrapperRef.current
    if (!mapWrapper) {
      return
    }

    const handleFullscreenChange = (): void => {
      const fullscreenElement = getFullscreenElement(document)
      setIsNativeFullscreen(Boolean(fullscreenElement && fullscreenElement === mapWrapperRef.current))
      window.requestAnimationFrame(() => {
        refreshMapViewport(mapRef.current)
      })

      fullscreenRefreshTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      fullscreenRefreshTimersRef.current = [
        window.setTimeout(() => {
          refreshMapViewport(mapRef.current)
        }, 120),
        window.setTimeout(() => {
          refreshMapViewport(mapRef.current)
        }, 420),
      ]
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener)
    }
  }, [])

  useEffect(() => {
    if (!isPseudoFullscreen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const previousTouchAction = document.body.style.touchAction

    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.touchAction = previousTouchAction
    }
  }, [isPseudoFullscreen])

  useEffect(() => {
    if (!isPseudoFullscreen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsPseudoFullscreen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPseudoFullscreen])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const timeoutIds: number[] = []
    const syncRouteOverlay = (): void => {
      scheduleRouteOverlayUpdate(map, orderedPins)
    }

    const applyPins = (): void => {
      for (const marker of markersRef.current) {
        marker.remove()
      }
      markersRef.current = []
      markerIconRootsRef.current.forEach((root) => root.unmount())
      markerIconRootsRef.current = []

      if (orderedPins.length === 0) {
        syncRouteOverlay()
        return
      }

      const bounds = new maplibregl.LngLatBounds()
      orderedPins.forEach((pin, index) => {
        bounds.extend([pin.longitude, pin.latitude])

        const markerEl = document.createElement('button')
        markerEl.type = 'button'
        markerEl.className = styles.pin
        markerEl.setAttribute('aria-label', pin.locationLabel || pin.activityTitle)
        markerEl.style.setProperty('--day-map-pin-color', ACTIVITY_MARKER_COLORS[pin.activityType] ?? '#8a7a68')

        const markerIconEl = document.createElement('span')
        markerIconEl.className = styles.pinIcon
        markerEl.appendChild(markerIconEl)
        const MarkerIcon = ACTIVITY_MARKER_ICONS[pin.activityType] ?? Sparkles
        const markerIconRoot = createRoot(markerIconEl)
        markerIconRoot.render(<MarkerIcon size={12} strokeWidth={2.2} />)
        markerIconRootsRef.current.push(markerIconRoot)

        const markerNumberEl = document.createElement('span')
        markerNumberEl.className = styles.pinNumber
        markerNumberEl.textContent = String(index + 1)
        markerEl.appendChild(markerNumberEl)

        const popupHtml = toPopupHtml({
          pin,
          pinIndex: index,
          locale: i18n.language,
          dayLabel: Number.isFinite(pin.dayNumber)
            ? t('itineraryView.dayNumber', { dayNumber: pin.dayNumber })
            : '',
          activityTypeLabel: t(`itineraryView.activityType.${pin.activityType}`),
          openInGoogleMapsLabel: t('itineraryView.openInGoogleMaps'),
        })

        const marker = new maplibregl.Marker({
          element: markerEl,
          anchor: 'bottom',
          offset: [0, 2],
        })
          .setLngLat([pin.longitude, pin.latitude])
          .setPopup(new maplibregl.Popup({ offset: 20, closeButton: true }).setHTML(popupHtml))
          .addTo(map)

        markersRef.current.push(marker)
      })

      if (orderedPins.length === 1) {
        map.easeTo({
          center: [orderedPins[0].longitude, orderedPins[0].latitude],
          zoom: 13,
          duration: 0,
        })
      } else {
        map.fitBounds(bounds, {
          padding: 56,
          maxZoom: 13,
          duration: 0,
        })
      }

      refreshMapViewport(map)
      syncRouteOverlay()
      const firstRefreshId = window.setTimeout(() => {
        refreshMapViewport(map)
        syncRouteOverlay()
      }, 120)
      const secondRefreshId = window.setTimeout(() => {
        refreshMapViewport(map)
        syncRouteOverlay()
      }, 420)
      timeoutIds.push(firstRefreshId, secondRefreshId)
    }

    if (!map.loaded()) {
      map.once('load', applyPins)
    } else {
      applyPins()
    }

    map.on('move', syncRouteOverlay)
    map.on('zoom', syncRouteOverlay)
    map.on('rotate', syncRouteOverlay)
    map.on('pitch', syncRouteOverlay)
    map.on('resize', syncRouteOverlay)
    map.on('idle', syncRouteOverlay)

    return () => {
      map.off('load', applyPins)
      map.off('move', syncRouteOverlay)
      map.off('zoom', syncRouteOverlay)
      map.off('rotate', syncRouteOverlay)
      map.off('pitch', syncRouteOverlay)
      map.off('resize', syncRouteOverlay)
      map.off('idle', syncRouteOverlay)
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
      if (routeAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(routeAnimationFrameRef.current)
        routeAnimationFrameRef.current = null
      }
    }
  }, [i18n.language, orderedPins, scheduleRouteOverlayUpdate, t])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    window.requestAnimationFrame(() => {
      refreshMapViewport(map)
      scheduleRouteOverlayUpdate(map, orderedPins)
    })
  }, [isFullscreen, orderedPins, scheduleRouteOverlayUpdate])

  const toggleFullscreen = async (): Promise<void> => {
    const mapWrapper = mapWrapperRef.current
    if (!mapWrapper) {
      return
    }

    if (!isNativeFullscreenSupported) {
      setIsPseudoFullscreen((value) => !value)
      return
    }

    try {
      if (getFullscreenElement(document) === mapWrapper) {
        await exitElementFullscreen(document)
      } else {
        await requestElementFullscreen(mapWrapper)
      }

      fullscreenRefreshTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      fullscreenRefreshTimersRef.current = [
        window.setTimeout(() => {
          refreshMapViewport(mapRef.current)
        }, 120),
        window.setTimeout(() => {
          refreshMapViewport(mapRef.current)
        }, 420),
      ]
    } catch {
      // Keep map usable when fullscreen is denied or unsupported at runtime.
    }
  }

  const routeViewBox = routeOverlay.width > 0 && routeOverlay.height > 0
    ? `0 0 ${routeOverlay.width} ${routeOverlay.height}`
    : '0 0 1 1'
  const hasRoute = routeOverlay.points.length > 0
  const variantClass = variant === 'page' ? styles.pageVariant : styles.inlineVariant
  const fullscreenClass = isFullscreen ? styles.fullscreen : ''
  const pseudoFullscreenClass = isPseudoFullscreen ? styles.pseudoFullscreen : ''

  return (
    <div
      ref={mapWrapperRef}
      className={`${styles.mapRoot} ${variantClass} ${fullscreenClass} ${pseudoFullscreenClass}`.trim()}
    >
      <button
        type="button"
        className={styles.fullscreenToggle}
        onClick={() => {
          void toggleFullscreen()
        }}
        aria-label={isFullscreen
          ? t('itineraryView.collapseMap')
          : t('itineraryView.expandMap')}
        title={isFullscreen
          ? t('itineraryView.collapseMap')
          : t('itineraryView.expandMap')}
      >
        {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
      </button>

      <div className={styles.viewport}>
        <div ref={mapContainerRef} className={styles.canvas} />
        <svg
          className={styles.routeOverlay}
          viewBox={routeViewBox}
          aria-hidden="true"
          focusable="false"
        >
          {hasRoute ? (
            <>
              <polyline className={`${styles.route} ${styles.routeCase}`} points={routeOverlay.points} />
              <polyline className={`${styles.route} ${styles.routeLine}`} points={routeOverlay.points} />
            </>
          ) : null}
        </svg>
      </div>

      {loadFailed ? (
        <p className={styles.error} role="alert">
          {t('itineraryView.mapLoadFailed')}
        </p>
      ) : null}
    </div>
  )
}

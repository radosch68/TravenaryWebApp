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
import { resolveMapProvider } from './map-provider'
import styles from './LocationsMap.module.css'

export interface LocationsMapProps {
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

type GoogleMapsApi = {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance
  InfoWindow: new (options: Record<string, unknown>) => GoogleInfoWindowInstance
  Polyline: new (options: Record<string, unknown>) => GooglePolylineInstance
  LatLngBounds: new () => GoogleLatLngBoundsInstance
  importLibrary?: (libraryName: string) => Promise<unknown>
  marker?: {
    AdvancedMarkerElement: new (options: Record<string, unknown>) => GoogleAdvancedMarkerInstance
  }
  event: {
    trigger: (instance: unknown, eventName: string) => void
    clearInstanceListeners: (instance: unknown) => void
  }
}

type GoogleMapInstance = {
  fitBounds: (bounds: GoogleLatLngBoundsInstance, padding?: number) => void
  setCenter: (position: { lat: number; lng: number }) => void
  setZoom: (zoom: number) => void
}

type GoogleAdvancedMarkerInstance = {
  addEventListener: (eventName: string, callback: () => void) => void
  map: GoogleMapInstance | null
}

type GoogleInfoWindowInstance = {
  open: (options: { map: GoogleMapInstance; anchor?: GoogleAdvancedMarkerInstance }) => void
  close: () => void
}

type GooglePolylineInstance = {
  setMap: (map: GoogleMapInstance | null) => void
}

type GoogleLatLngBoundsInstance = {
  extend: (position: { lat: number; lng: number }) => void
}

interface GoogleWindow {
  google?: {
    maps?: GoogleMapsApi
  }
}

const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-javascript-api'
const googleMapsScriptPromises = new Map<string, Promise<void>>()

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

function createPinBadgeElement(pin: LocationMapPin, markerNumber: number): {
  markerElement: HTMLButtonElement
  markerIconRoot: Root
} {
  const markerElement = document.createElement('button')
  markerElement.type = 'button'
  markerElement.className = styles.pin
  markerElement.setAttribute('aria-label', pin.locationLabel || pin.activityTitle)
  markerElement.style.setProperty('--day-map-pin-color', ACTIVITY_MARKER_COLORS[pin.activityType] ?? '#8a7a68')

  const markerIconElement = document.createElement('span')
  markerIconElement.className = styles.pinIcon
  markerElement.appendChild(markerIconElement)
  const MarkerIcon = ACTIVITY_MARKER_ICONS[pin.activityType] ?? Sparkles
  const markerIconRoot = createRoot(markerIconElement)
  markerIconRoot.render(<MarkerIcon size={12} strokeWidth={2.2} />)

  const markerNumberElement = document.createElement('span')
  markerNumberElement.className = styles.pinNumber
  markerNumberElement.textContent = String(markerNumber)
  markerElement.appendChild(markerNumberElement)

  return {
    markerElement,
    markerIconRoot,
  }
}

function unmountMarkerIconRootsDeferred(roots: Root[]): void {
  if (roots.length === 0) {
    return
  }

  const rootsToUnmount = [...roots]
  window.setTimeout(() => {
    rootsToUnmount.forEach((root) => {
      root.unmount()
    })
  }, 0)
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

function getGoogleMapsApi(): GoogleMapsApi | null {
  const candidate = (window as unknown as GoogleWindow).google?.maps
  return candidate ?? null
}

function isGoogleMapsApiReady(mapsApi: GoogleMapsApi | null): boolean {
  if (!mapsApi) {
    return false
  }

  return typeof mapsApi.Map === 'function'
    && typeof mapsApi.marker?.AdvancedMarkerElement === 'function'
    && typeof mapsApi.InfoWindow === 'function'
    && typeof mapsApi.Polyline === 'function'
    && typeof mapsApi.LatLngBounds === 'function'
    && typeof mapsApi.event?.trigger === 'function'
}

async function waitForGoogleMapsApiReady(timeoutMs = 5000): Promise<GoogleMapsApi> {
  const startedAt = Date.now()
  let markerImportAttempted = false

  while (Date.now() - startedAt <= timeoutMs) {
    const mapsApi = getGoogleMapsApi()
    if (mapsApi && isGoogleMapsApiReady(mapsApi)) {
      return mapsApi
    }

    if (
      !markerImportAttempted
      && mapsApi
      && typeof mapsApi.importLibrary === 'function'
      && typeof mapsApi.marker?.AdvancedMarkerElement !== 'function'
    ) {
      markerImportAttempted = true
      try {
        await mapsApi.importLibrary('marker')
      } catch {
        // Keep polling in case the script has not finished hydrating yet.
      }
      continue
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 50)
    })
  }

  throw new Error('Google Maps API was loaded but constructors are not ready.')
}

function refreshGoogleMapViewport(map: GoogleMapInstance | null, mapsApi: GoogleMapsApi | null): void {
  if (!map || !mapsApi) {
    return
  }

  mapsApi.event.trigger(map, 'resize')
}

function ensureGoogleMapsScript(apiKey: string): Promise<void> {
  const normalizedKey = apiKey.trim()
  if (normalizedKey.length === 0) {
    return Promise.reject(new Error('Google Maps API key is missing.'))
  }

  if (isGoogleMapsApiReady(getGoogleMapsApi())) {
    return Promise.resolve()
  }

  const existingPromise = googleMapsScriptPromises.get(normalizedKey)
  if (existingPromise) {
    return existingPromise
  }

  const scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null

    const onLoad = (): void => {
      void waitForGoogleMapsApiReady()
        .then(() => {
          resolve()
        })
        .catch(() => {
          reject(new Error('Google Maps API loaded without ready constructors.'))
        })
    }

    const onError = (): void => {
      reject(new Error('Failed to load Google Maps API script.'))
    }

    if (existing) {
      void waitForGoogleMapsApiReady()
        .then(() => {
          resolve()
        })
        .catch(() => {
          reject(new Error('Google Maps API script exists but constructors are not ready.'))
        })
      return
    }

    const script = document.createElement('script')
    script.id = GOOGLE_MAPS_SCRIPT_ID
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(normalizedKey)}&v=weekly&loading=async&libraries=marker`
    script.async = true
    script.defer = true
    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
    document.head.appendChild(script)
  })

  const managedPromise = scriptPromise.catch((error) => {
    googleMapsScriptPromises.delete(normalizedKey)
    throw error
  })

  googleMapsScriptPromises.set(normalizedKey, managedPromise)
  return managedPromise
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

export function MapLibreLocationsMap({ pins, variant = 'inline' }: LocationsMapProps): ReactElement {
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
      cooperativeGestures: false,
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
      unmountMarkerIconRootsDeferred(markerIconRootsRef.current)
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
      unmountMarkerIconRootsDeferred(markerIconRootsRef.current)
      markerIconRootsRef.current = []

      if (orderedPins.length === 0) {
        syncRouteOverlay()
        return
      }

      const bounds = new maplibregl.LngLatBounds()
      orderedPins.forEach((pin, index) => {
        bounds.extend([pin.longitude, pin.latitude])

        const { markerElement, markerIconRoot } = createPinBadgeElement(pin, index + 1)
        markerIconRootsRef.current.push(markerIconRoot)

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
          element: markerElement,
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

function GoogleLocationsMap({ pins, variant = 'inline' }: LocationsMapProps): ReactElement {
  const { t, i18n } = useTranslation('common')
  const mapWrapperRef = useRef<HTMLDivElement | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<GoogleMapInstance | null>(null)
  const mapsApiRef = useRef<GoogleMapsApi | null>(null)
  const markersRef = useRef<GoogleAdvancedMarkerInstance[]>([])
  const markerIconRootsRef = useRef<Root[]>([])
  const polylinesRef = useRef<GooglePolylineInstance[]>([])
  const infoWindowRef = useRef<GoogleInfoWindowInstance | null>(null)
  const fullscreenRefreshTimersRef = useRef<number[]>([])
  const [loadFailed, setLoadFailed] = useState(false)
  const [googleMapReady, setGoogleMapReady] = useState(false)
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false)
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false)

  const orderedPins = useMemo(() => pins.map((pin) => ({ ...pin })), [pins])
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? ''
  const googleMapId = import.meta.env.VITE_GOOGLE_MAP_ID?.trim() || 'DEMO_MAP_ID'
  const isNativeFullscreenSupported = useMemo(
    () => canRequestFullscreen(document) && canExitFullscreen(document),
    [],
  )
  const isFullscreen = isNativeFullscreen || isPseudoFullscreen

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    let cancelled = false

    const initialize = async (): Promise<void> => {
      if (mapsApiKey.length === 0) {
        setLoadFailed(true)
        return
      }

      try {
        await ensureGoogleMapsScript(mapsApiKey)
      } catch {
        if (!cancelled) {
          setLoadFailed(true)
        }
        return
      }

      if (cancelled) {
        return
      }

      try {
        const mapsApi = await waitForGoogleMapsApiReady()
        if (cancelled || !mapContainerRef.current) {
          return
        }

        mapsApiRef.current = mapsApi
        mapRef.current = new mapsApi.Map(mapContainerRef.current, {
          center: { lat: 50.1, lng: 14.4 },
          zoom: 8,
          mapId: googleMapId,
          gestureHandling: 'greedy',
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
        })
        infoWindowRef.current = new mapsApi.InfoWindow({})
        setGoogleMapReady(true)
        setLoadFailed(false)
      } catch {
        if (!cancelled) {
          setLoadFailed(true)
        }
      }
    }

    void initialize()

    return () => {
      cancelled = true
      fullscreenRefreshTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      fullscreenRefreshTimersRef.current = []

      if (infoWindowRef.current) {
        infoWindowRef.current.close()
      }
      infoWindowRef.current = null

      markersRef.current.forEach((marker) => {
        marker.map = null
      })
      markersRef.current = []
      unmountMarkerIconRootsDeferred(markerIconRootsRef.current)
      markerIconRootsRef.current = []

      polylinesRef.current.forEach((polyline) => {
        polyline.setMap(null)
      })
      polylinesRef.current = []

      mapRef.current = null
      mapsApiRef.current = null
      setGoogleMapReady(false)
    }
  }, [googleMapId, mapsApiKey])

  useEffect(() => {
    const mapWrapper = mapWrapperRef.current
    if (!mapWrapper) {
      return
    }

    const handleFullscreenChange = (): void => {
      const fullscreenElement = getFullscreenElement(document)
      setIsNativeFullscreen(Boolean(fullscreenElement && fullscreenElement === mapWrapperRef.current))
      window.requestAnimationFrame(() => {
        refreshGoogleMapViewport(mapRef.current, mapsApiRef.current)
      })

      fullscreenRefreshTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      fullscreenRefreshTimersRef.current = [
        window.setTimeout(() => {
          refreshGoogleMapViewport(mapRef.current, mapsApiRef.current)
        }, 120),
        window.setTimeout(() => {
          refreshGoogleMapViewport(mapRef.current, mapsApiRef.current)
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
    if (!googleMapReady) {
      return
    }

    const map = mapRef.current
    const mapsApi = mapsApiRef.current
    if (!map || !mapsApi) {
      return
    }

    markersRef.current.forEach((marker) => {
      marker.map = null
      mapsApi.event.clearInstanceListeners(marker)
    })
    markersRef.current = []
    unmountMarkerIconRootsDeferred(markerIconRootsRef.current)
    markerIconRootsRef.current = []

    polylinesRef.current.forEach((polyline) => {
      polyline.setMap(null)
      mapsApi.event.clearInstanceListeners(polyline)
    })
    polylinesRef.current = []

    if (infoWindowRef.current) {
      infoWindowRef.current.close()
    }

    if (orderedPins.length === 0) {
      return
    }

    const AdvancedMarkerElement = mapsApi.marker?.AdvancedMarkerElement
    if (typeof AdvancedMarkerElement !== 'function') {
      setLoadFailed(true)
      return
    }

    const bounds = new mapsApi.LatLngBounds()
    orderedPins.forEach((pin, index) => {
      const position = { lat: pin.latitude, lng: pin.longitude }
      bounds.extend(position)

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

      const { markerElement, markerIconRoot } = createPinBadgeElement(pin, index + 1)
      markerIconRootsRef.current.push(markerIconRoot)

      const marker = new AdvancedMarkerElement({
        map,
        position,
        title: pin.locationLabel || pin.activityTitle,
        content: markerElement,
        gmpClickable: true,
      })

      let lastInfoWindowOpenAt = 0
      const openInfoWindow = (): void => {
        const now = Date.now()
        if (now - lastInfoWindowOpenAt < 40) {
          return
        }
        lastInfoWindowOpenAt = now

        if (!infoWindowRef.current) {
          return
        }

        infoWindowRef.current.close()
        infoWindowRef.current = new mapsApi.InfoWindow({ content: popupHtml })
        infoWindowRef.current.open({ map, anchor: marker })
      }

      markerElement.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        openInfoWindow()
      })

      try {
        marker.addEventListener('gmp-click', openInfoWindow)
      } catch {
        // Some channels/builds may not expose gmp-click; DOM click fallback remains active.
      }

      markersRef.current.push(marker)
    })

    if (orderedPins.length >= 2) {
      const path = orderedPins.map((pin) => ({ lat: pin.latitude, lng: pin.longitude }))

      const routeLine = new mapsApi.Polyline({
        map,
        path,
        geodesic: true,
        strokeOpacity: 0,
        icons: [
          {
            icon: {
              path: 'M 0,-1 0,1',
              strokeOpacity: 1,
              strokeColor: '#0b5bcc',
              scale: 2.5,
            },
            offset: '0',
            repeat: '13px',
          },
        ],
      })

      polylinesRef.current = [routeLine]
    }

    if (orderedPins.length === 1) {
      map.setCenter({ lat: orderedPins[0].latitude, lng: orderedPins[0].longitude })
      map.setZoom(13)
      return
    }

    map.fitBounds(bounds, 56)
  }, [googleMapReady, i18n.language, orderedPins, t])

  useEffect(() => {
    if (!googleMapReady) {
      return
    }

    const map = mapRef.current
    const mapsApi = mapsApiRef.current
    if (!map || !mapsApi) {
      return
    }

    window.requestAnimationFrame(() => {
      refreshGoogleMapViewport(map, mapsApi)
    })
  }, [googleMapReady, isFullscreen])

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
          refreshGoogleMapViewport(mapRef.current, mapsApiRef.current)
        }, 120),
        window.setTimeout(() => {
          refreshGoogleMapViewport(mapRef.current, mapsApiRef.current)
        }, 420),
      ]
    } catch {
      // Keep map usable when fullscreen is denied or unsupported at runtime.
    }
  }

  const variantClass = variant === 'page' ? styles.pageVariant : styles.inlineVariant
  const fullscreenClass = isFullscreen ? styles.fullscreen : ''
  const pseudoFullscreenClass = isPseudoFullscreen ? styles.pseudoFullscreen : ''

  return (
    <div
      ref={mapWrapperRef}
      className={`${styles.mapRoot} ${styles.googleProvider} ${variantClass} ${fullscreenClass} ${pseudoFullscreenClass}`.trim()}
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
      </div>

      {loadFailed ? (
        <p className={styles.error} role="alert">
          {t('itineraryView.mapLoadFailed')}
        </p>
      ) : null}
    </div>
  )
}

export function LocationsMap(props: LocationsMapProps): ReactElement {
  const provider = resolveMapProvider()

  if (provider === 'google') {
    return <GoogleLocationsMap {...props} />
  }

  return <MapLibreLocationsMap {...props} />
}

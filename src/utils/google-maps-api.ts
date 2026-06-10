type GoogleMapsDirectionsResult = {
  routes?: Array<{
    legs?: Array<{
      distance?: { text?: string }
      duration?: { text?: string }
    }>
  }>
}

type GoogleMapsDirectionsStatus = 'OK' | 'ZERO_RESULTS' | 'NOT_FOUND' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'INVALID_REQUEST' | 'UNKNOWN_ERROR'

export type GoogleMapsApi = {
  DirectionsService: new () => {
    route: (
      request: Record<string, unknown>,
      callback: (result: GoogleMapsDirectionsResult | null, status: GoogleMapsDirectionsStatus) => void,
    ) => void
  }
  TravelMode?: {
    DRIVING?: string
    WALKING?: string
    BICYCLING?: string
    TRANSIT?: string
  }
}

interface GoogleWindow {
  google?: {
    maps?: GoogleMapsApi
  }
}

const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-javascript-api'
const googleMapsScriptPromises = new Map<string, Promise<void>>()

export function getGoogleMapsApi(): GoogleMapsApi | null {
  const candidate = (window as unknown as GoogleWindow).google?.maps
  return candidate ?? null
}

function isGoogleMapsApiReady(mapsApi: GoogleMapsApi | null): boolean {
  return Boolean(mapsApi && typeof mapsApi.DirectionsService === 'function')
}

export async function waitForGoogleMapsApiReady(timeoutMs = 5000): Promise<GoogleMapsApi> {
  const startedAt = Date.now()

  while (Date.now() - startedAt <= timeoutMs) {
    const mapsApi = getGoogleMapsApi()
    if (mapsApi && isGoogleMapsApiReady(mapsApi)) {
      return mapsApi
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 50)
    })
  }

  throw new Error('Google Maps API was loaded but constructors are not ready.')
}

export function ensureGoogleMapsScript(apiKey: string): Promise<void> {
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(normalizedKey)}&v=weekly&loading=async`
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
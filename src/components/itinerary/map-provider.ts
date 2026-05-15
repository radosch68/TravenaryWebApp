export type MapProvider = 'maplibre' | 'google'

const DEFAULT_MAP_PROVIDER: MapProvider = 'maplibre'

export function resolveMapProvider(): MapProvider {
  const rawProvider = import.meta.env.VITE_MAP_PROVIDER?.trim().toLowerCase()

  if (rawProvider === 'google' || rawProvider === 'maplibre') {
    return rawProvider
  }

  return DEFAULT_MAP_PROVIDER
}

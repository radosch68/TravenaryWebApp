import type { WebReference } from '@/services/contracts'
import { unsplashUrl } from '@/utils/unsplash-url'

type ReferenceType = NonNullable<WebReference['type']>
type ReferenceChipType = ReferenceType | 'no-type'
type YouTubeThumbnailQuality = 'default' | 'mqdefault' | 'hqdefault' | 'sddefault' | 'maxresdefault'

const PHOTO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'svg', 'avif', 'heic', 'heif', 'jfif'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'avi', 'webm', 'm4v', 'mkv', 'mpeg', 'mpg', '3gp', 'ogv'])
const WEBPAGE_EXTENSIONS = new Set(['html', 'htm', 'php', 'asp', 'aspx', 'jsp'])

function isYouTubeHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  return normalized === 'youtu.be'
    || normalized.endsWith('.youtu.be')
    || normalized === 'youtube.com'
    || normalized.endsWith('.youtube.com')
    || normalized === 'youtube-nocookie.com'
    || normalized.endsWith('.youtube-nocookie.com')
}

function readPathExtension(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return null
  }

  let candidate = trimmed
  try {
    candidate = new URL(trimmed).pathname
  } catch {
    candidate = candidate.split('#')[0]?.split('?')[0] ?? candidate
  }

  const normalized = candidate.toLowerCase()
  const match = normalized.match(/\.([a-z0-9]+)$/)
  return match?.[1] ?? null
}

export function inferReferenceTypeFromUrl(rawUrl: string): ReferenceType | '' {
  if (getYouTubeVideoId(rawUrl)) {
    return 'video'
  }

  const extension = readPathExtension(rawUrl)
  if (!extension) {
    return ''
  }

  if (PHOTO_EXTENSIONS.has(extension)) {
    return 'photo'
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return 'video'
  }
  if (WEBPAGE_EXTENSIONS.has(extension)) {
    return 'webpage'
  }

  return ''
}

export function getYouTubeVideoId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsedUrl = new URL(trimmed)
    if (!isYouTubeHost(parsedUrl.hostname)) {
      return null
    }

    if (parsedUrl.hostname.toLowerCase().includes('youtu.be')) {
      const shortId = parsedUrl.pathname.split('/').filter(Boolean)[0]
      return shortId || null
    }

    const watchId = parsedUrl.searchParams.get('v')
    if (watchId) {
      return watchId
    }

    const pathMatch = parsedUrl.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/)
    return pathMatch?.[1] ?? null
  } catch {
    return null
  }
}

export function getYouTubeThumbnailUrl(rawUrl: string, quality: YouTubeThumbnailQuality = 'hqdefault'): string | null {
  const videoId = getYouTubeVideoId(rawUrl)
  if (!videoId) {
    return null
  }

  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`
}

export function getReferenceThumbnailUrl(reference: WebReference, widthPx: number): string | null {
  if (reference.type === 'photo') {
    return unsplashUrl(reference.url, widthPx, 70)
  }

  if (reference.type === 'video') {
    return getYouTubeThumbnailUrl(reference.url)
  }

  return null
}

export function toReferenceChipType(type?: string): ReferenceChipType {
  if (type === 'photo') return 'photo'
  if (type === 'video') return 'video'
  if (type === 'webpage') return 'webpage'
  return 'no-type'
}
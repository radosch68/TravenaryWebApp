/**
 * Rewrite an Unsplash image URL to request a specific size.
 * Non-Unsplash URLs are returned unchanged.
 */
export function unsplashUrl(url: string, width: number, quality = 80): string {
  if (!url.includes('images.unsplash.com')) {
    return url
  }

  try {
    const parsed = new URL(url)
    parsed.searchParams.set('w', String(width))
    parsed.searchParams.set('q', String(quality))
    parsed.searchParams.set('fit', 'crop')
    return parsed.toString()
  } catch {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}w=${width}&q=${quality}&fit=crop`
  }
}

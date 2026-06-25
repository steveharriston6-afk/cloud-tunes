/** Helper to register the Service Worker and manage cache communication */

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Force update check on register
          registration.update();
        })
        .catch((error) => {
          console.error('[SW] Registration failed:', error);
        });
    });
  }
}

/** Tell Service Worker to prune audio cache, keeping only specified URLs */
export function pruneAudioCache(keepUrls: string[]) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    // Normalise URLs to matching path segments
    const normalizedUrls = keepUrls.map(url => {
      try {
        const parsed = new URL(url, window.location.origin);
        return parsed.pathname;
      } catch {
        return url;
      }
    });

    navigator.serviceWorker.controller.postMessage({
      type: 'PRUNE_AUDIO_CACHE',
      payload: { keepUrls: normalizedUrls }
    });
  }
}

/** Invalidate cache for a specific URL (useful if a song was modified/updated) */
export function invalidateUrlCache(url: string) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    let targetPath = url;
    try {
      const parsed = new URL(url, window.location.origin);
      targetPath = parsed.pathname;
    } catch {
      // ignore
    }

    navigator.serviceWorker.controller.postMessage({
      type: 'INVALIDATE_URL',
      payload: { url: targetPath }
    });
  }
}

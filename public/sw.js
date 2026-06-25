const AUDIO_CACHE = 'cloudtunes-audio-cache-v1';
const IMAGE_CACHE = 'cloudtunes-image-cache-v1';
const STATIC_CACHE = 'cloudtunes-static-cache-v1';

// Install event
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle range request slices from cached ArrayBuffer
async function returnRangeResponse(cachedResponse, rangeHeader) {
  const buffer = await cachedResponse.arrayBuffer();
  const totalLength = buffer.byteLength;
  const contentType = cachedResponse.headers.get('content-type') || 'audio/mpeg';

  // Parse Range header (e.g. "bytes=0-100" or "bytes=50-")
  const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
  if (!rangeMatch) {
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': totalLength,
      }
    });
  }

  const start = parseInt(rangeMatch[1], 10);
  const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : totalLength - 1;
  
  // Ensure indices are within bounds
  const chunkStart = Math.min(start, totalLength - 1);
  const chunkEnd = Math.min(end, totalLength - 1);
  const chunkLength = chunkEnd - chunkStart + 1;

  const slicedData = buffer.slice(chunkStart, chunkEnd + 1);

  return new Response(slicedData, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': contentType,
      'Content-Range': `bytes ${chunkStart}-${chunkEnd}/${totalLength}`,
      'Content-Length': chunkLength,
      'Accept-Ranges': 'bytes',
    }
  });
}

// Fetch interception
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Audio stream caching and serving (proxy & direct GDrive CDN)
  const isAudio = url.pathname.includes('/api/stream/') || url.hostname.includes('drive.usercontent.google.com');
  if (isAudio) {
    const rangeHeader = event.request.headers.get('range');
    
    event.respondWith(
      (async () => {
        const cache = await caches.open(AUDIO_CACHE);
        const cachedResponse = await cache.match(event.request.url);

        if (cachedResponse) {
          if (rangeHeader) {
            return returnRangeResponse(cachedResponse, rangeHeader);
          }
          return cachedResponse.clone();
        }

        if (rangeHeader) {
          return fetch(event.request);
        }

        try {
          const response = await fetch(event.request);
          if (response.status === 200 || response.status === 206) {
            await cache.put(event.request.url, response.clone());
          }
          return response;
        } catch (err) {
          return fetch(event.request);
        }
      })()
    );
    return;
  }

  // 2. Cover image caching
  if (url.pathname.includes('/api/cover/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGE_CACHE);
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            await cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return new Response('', { status: 404 });
        }
      })()
    );
    return;
  }
});

// Control messages (Pruning and invalidating cache)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  const { type, payload } = event.data;

  if (type === 'PRUNE_AUDIO_CACHE') {
    // Keep only specified active URLs (current track URL and next preloaded track URL)
    const keepUrls = payload.keepUrls || [];
    event.waitUntil(
      (async () => {
        const cache = await caches.open(AUDIO_CACHE);
        const keys = await cache.keys();
        for (const request of keys) {
          const matchFound = keepUrls.some(url => request.url.includes(url));
          if (!matchFound) {
            await cache.delete(request);
          }
        }
      })()
    );
  }

  if (type === 'INVALIDATE_URL') {
    const url = payload.url;
    event.waitUntil(
      (async () => {
        const audioCache = await caches.open(AUDIO_CACHE);
        const imageCache = await caches.open(IMAGE_CACHE);
        await audioCache.delete(url);
        await imageCache.delete(url);
      })()
    );
  }
});

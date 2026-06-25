import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { URL } from 'url';
import { tracks } from '../db.js';
import { toTrackAPI } from '../models/schemas.js';
import { cacheService } from '../utils/cacheService.js';

const router = Router();
const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

let cachedSongs: any = null;

export function invalidateSongsCache() {
  cachedSongs = null;
}

// ─── GET /api/songs — All available tracks ───────────────────────

router.get('/songs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const cursorStr = req.query.cursor as string;
    const search = req.query.search as string;
    const artist = req.query.artist as string;
    const album = req.query.album as string;
    const ids = req.query.ids as string;
    const sortBy = req.query.sortBy as string || 'dateAdded';

    const query: any = { isAvailable: true };

    if (artist) {
      query.artist = artist;
    }
    if (album) {
      query.album = album;
    }
    if (ids) {
      const idArray = ids.split(',').filter(Boolean);
      query.publicId = { $in: idArray };
    }

    if (search) {
      query.$text = { $search: search };
    }

    // Cursor pagination parsing
    if (cursorStr) {
      try {
        const cursorData = JSON.parse(Buffer.from(cursorStr, 'base64').toString('utf-8'));
        if (sortBy === 'title') {
          query.$or = [
            { title: { $gt: cursorData.title } },
            { title: cursorData.title, _id: { $gt: cursorData.id } }
          ];
        } else {
          const dateVal = new Date(cursorData.dateAdded);
          query.$or = [
            { dateAdded: { $lt: dateVal } },
            { dateAdded: dateVal, _id: { $lt: cursorData.id } }
          ];
        }
      } catch (err) {
        console.error('[Songs] Failed to parse cursor:', err);
      }
    }

    const sort: any = {};
    if (sortBy === 'title') {
      sort.title = 1;
      sort._id = 1;
    } else {
      sort.dateAdded = -1;
      sort._id = -1;
    }

    const docs = await tracks()
      .find(query)
      .sort(sort)
      .limit(limit)
      .toArray();

    let nextCursor: string | null = null;
    if (docs.length === limit) {
      const lastDoc = docs[docs.length - 1];
      const cursorObj = sortBy === 'title'
        ? { title: lastDoc.title, id: lastDoc._id }
        : { dateAdded: lastDoc.dateAdded.toISOString(), id: lastDoc._id };
      nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString('base64');
    }

    res.json({
      tracks: docs.map(toTrackAPI),
      nextCursor
    });
  } catch (err: any) {
    console.error('[API] Error fetching songs:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/tracks/:id — Single track ──────────────────────────

router.get('/tracks/:id', async (req, res) => {
  try {
    const doc = await tracks().findOne({ publicId: req.params.id });
    if (!doc) {
      res.status(404).json({ error: 'Track not found' });
      return;
    }
    res.json(toTrackAPI(doc));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/cover/:trackId — Cover art proxy ───────────────────

router.get('/cover/:trackId', async (req, res) => {
  const { trackId } = req.params;
  try {
    // Check L1/L2 Cache first
    const cached = await cacheService.get(trackId, 'covers');
    if (cached) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.end(cached.buffer);
      return;
    }

    const doc = await tracks().findOne({ publicId: trackId });
    if (!doc || !doc.coverArt) {
      res.status(404).end('Cover not found');
      return;
    }

    const coverUrl = doc.coverArt;

    // 1. Local cover file
    if (coverUrl.startsWith('/covers/')) {
      const localCoverPath = path.resolve(PROJECT_ROOT, 'data', 'covers', coverUrl.replace('/covers/', ''));
      if (fs.existsSync(localCoverPath)) {
        const ext = path.extname(localCoverPath).toLowerCase();
        const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
        const buffer = await fs.promises.readFile(localCoverPath);
        await cacheService.set(trackId, 'covers', buffer, contentType);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.end(buffer);
        return;
      }
    }

    // 2. Remote cover URL proxy (with L1/L2 caching)
    if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
      const fetchCover = (target: string) => {
        https.get(target, (proxyRes) => {
          if (proxyRes.statusCode === 301 || proxyRes.statusCode === 302) {
            if (proxyRes.headers.location) {
              fetchCover(proxyRes.headers.location);
              return;
            }
          }
          if (proxyRes.statusCode !== 200) {
            res.status(proxyRes.statusCode || 404).end('Failed to fetch cover');
            return;
          }
          const contentType = proxyRes.headers['content-type'] || 'image/jpeg';
          const chunks: Buffer[] = [];
          proxyRes.on('data', (chunk) => chunks.push(chunk));
          proxyRes.on('end', async () => {
            const buffer = Buffer.concat(chunks);
            await cacheService.set(trackId, 'covers', buffer, contentType);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.end(buffer);
          });
        }).on('error', () => {
          res.status(404).end('Cover load error');
        });
      };
      fetchCover(coverUrl);
      return;
    }

    res.status(404).end('Cover not found');
  } catch (err: any) {
    res.status(500).end(err.message);
  }
});

// ─── GET /api/stream/:trackId — Audio streaming proxy ────────────

router.get('/stream/:trackId', async (req, res) => {
  const { trackId } = req.params;
  try {
    const doc = await tracks().findOne({ publicId: trackId });
    if (!doc || !doc.filePath) {
      res.status(404).end('Song not found');
      return;
    }

    const targetUrl = doc.filePath;
    const clientRange = req.headers['range'];

    // 1. Local track file streaming with Range requests
    if (targetUrl.startsWith('/tracks/')) {
      const actualFilePath = path.resolve(PROJECT_ROOT, 'data', 'tracks', targetUrl.replace('/tracks/', ''));
      if (!fs.existsSync(actualFilePath)) {
        res.status(404).end('Local file not found');
        return;
      }

      const stat = fs.statSync(actualFilePath);
      const totalSize = stat.size;
      const ext = path.extname(actualFilePath).toLowerCase();
      let contentType = 'audio/mpeg';
      if (ext === '.flac') contentType = 'audio/flac';
      else if (ext === '.wav') contentType = 'audio/wav';
      else if (ext === '.m4a' || ext === '.mp4') contentType = 'audio/mp4';
      else if (ext === '.ogg') contentType = 'audio/ogg';

      const MAX_CHUNK_SIZE = 1024 * 1024; // 1 MB chunk limit

      if (clientRange) {
        const parts = clientRange.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        let end = parts[1] ? parseInt(parts[1], 10) : start + MAX_CHUNK_SIZE - 1;

        if (start >= totalSize) {
          res.status(416);
          res.setHeader('Content-Range', `bytes */${totalSize}`);
          res.end();
          return;
        }

        if (end >= totalSize) {
          end = totalSize - 1;
        }

        if (end - start + 1 > MAX_CHUNK_SIZE) {
          end = start + MAX_CHUNK_SIZE - 1;
        }

        const chunkSize = end - start + 1;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', chunkSize);
        res.setHeader('Content-Type', contentType);

        const stream = fs.createReadStream(actualFilePath, { start, end, highWaterMark: 64 * 1024 });
        stream.pipe(res);
      } else {
        res.status(200);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', totalSize);
        res.setHeader('Content-Type', contentType);
        fs.createReadStream(actualFilePath, { highWaterMark: 64 * 1024 }).pipe(res);
      }
      return;
    }

    // 2. Google Drive / Cloud URL proxying (direct stream, no local cache file)
    let gdriveUrl = targetUrl;
    if (gdriveUrl.startsWith('/gdrive-proxy/')) {
      const id = gdriveUrl.split('/')[2];
      gdriveUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download`;
    }

    const proxyStream = (streamUrl: string) => {
      const parsedUrl = new URL(streamUrl);
      const requestHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      };

      const MAX_CHUNK_SIZE = 1024 * 1024; // 1 MB chunk limit
      let start = 0;
      let end: number | null = null;

      if (clientRange) {
        const parts = clientRange.replace(/bytes=/, '').split('-');
        start = parseInt(parts[0], 10);
        end = parts[1] ? parseInt(parts[1], 10) : null;
      }

      const targetEnd = end !== null ? Math.min(end, start + MAX_CHUNK_SIZE - 1) : (start + MAX_CHUNK_SIZE - 1);
      requestHeaders['Range'] = `bytes=${start}-${targetEnd}`;

      const options: https.RequestOptions = {
        method: 'GET',
        headers: requestHeaders,
      };

      const proxyReq = https.request(parsedUrl, options, (proxyRes) => {
        if (proxyRes.statusCode === 301 || proxyRes.statusCode === 302) {
          const redirectUrl = proxyRes.headers.location;
          if (redirectUrl) {
            proxyStream(redirectUrl);
            return;
          }
        }

        res.status(proxyRes.statusCode || 200);
        if (proxyRes.headers['content-type']) res.setHeader('Content-Type', proxyRes.headers['content-type']);
        if (proxyRes.headers['content-length']) res.setHeader('Content-Length', proxyRes.headers['content-length']);
        if (proxyRes.headers['content-range']) res.setHeader('Content-Range', proxyRes.headers['content-range']);
        if (proxyRes.headers['accept-ranges']) res.setHeader('Accept-Ranges', proxyRes.headers['accept-ranges']);

        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error('[Proxy Error]', err);
        res.status(500).end('Proxy stream failed');
      });

      proxyReq.end();
    };

    proxyStream(gdriveUrl);
  } catch (err: any) {
    res.status(500).end(err.message);
  }
});

// ─── GET /api/sync/status — Get sync status and logs ──────────────

router.get('/sync/status', async (_req, res) => {
  try {
    const statusFilePath = path.resolve(PROJECT_ROOT, 'data', 'sync_status.json');
    if (fs.existsSync(statusFilePath)) {
      const data = fs.readFileSync(statusFilePath, 'utf-8');
      res.json(JSON.parse(data));
    } else {
      res.json({
        status: 'idle',
        lastSyncTime: null,
        error: null,
        stats: {
          totalDiscovered: 0,
          newAdded: 0,
          updated: 0,
          failed: 0,
          covers: { embedded: 0, folder: 0, fallback: 0 }
        },
        logs: []
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/sync — Trigger library sync ───────────────────────

router.post('/sync', async (_req, res) => {
  try {
    const { runSync, isSyncRunning } = await import('../sync/syncWorker.js');
    if (isSyncRunning()) {
      res.status(409).json({ error: 'Sync already in progress' });
      return;
    }
    runSync();
    res.json({ status: 'sync_started' });
  } catch (err: any) {
    console.error('[Sync] Error starting sync:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

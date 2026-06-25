import { Router } from 'express';
import { tracks, artists, albums } from '../db.js';

const router = Router();

// ─── GET /api/search?q=&limit= — Full-text search ───────────────

router.get('/search', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  if (!query) {
    res.json({ tracks: [], artists: [], albums: [] });
    return;
  }

  try {
    const startTime = Date.now();

    // Strategy: Try text search first, fall back to regex for partial matches
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = new RegExp(escapedQuery, 'i');

    // ── Track search: text index + regex fallback ─────────────
    let trackResults = await tracks()
      .find({
        $text: { $search: query },
      })
      .project({ score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .toArray();

    // If text search returns few results, supplement with regex
    if (trackResults.length < limit) {
      const existingIds = new Set(trackResults.map((t) => t._id));
      const regexResults = await tracks()
        .find({
          _id: { $nin: Array.from(existingIds) },
          $or: [
            { title: regexPattern },
            { artist: regexPattern },
            { album: regexPattern },
            { genre: regexPattern },
          ],
        })
        .limit(limit - trackResults.length)
        .toArray();

      trackResults = [...trackResults, ...regexResults];
    }

    // ── Artist search ────────────────────────────────────────
    const artistResults = await artists()
      .find({
        name: regexPattern,
      })
      .limit(5)
      .toArray();

    // ── Album search ─────────────────────────────────────────
    const albumResults = await albums()
      .find({
        $or: [
          { name: regexPattern },
          { artist: regexPattern },
        ],
      })
      .limit(5)
      .toArray();

    const elapsed = Date.now() - startTime;

    res.json({
      tracks: trackResults.map((t) => ({
        id: t.publicId || t._id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        genre: t.genre,
        cover: `/api/cover/${t.publicId || t._id}`,
        format: t.format,
        details: t.details,
        duration: t.duration,
        isCloud: t.source === 'gdrive',
      })),
      artists: artistResults.map((a) => ({
        name: a.name,
        coverArt: a.coverArt ? `/api/cover/${a.coverArt}` : '',
        trackCount: a.trackCount,
      })),
      albums: albumResults.map((a) => ({
        name: a.name,
        artist: a.artist,
        coverArt: a.coverArt ? `/api/cover/${a.coverArt}` : '',
        trackCount: a.trackCount,
      })),
      meta: {
        query,
        elapsed: `${elapsed}ms`,
        totalResults: trackResults.length + artistResults.length + albumResults.length,
      },
    });
  } catch (err: any) {
    console.error('[Search] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/suggestions?q=&limit= — Quick suggestions ─────────

router.get('/suggestions', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  const limit = Math.min(parseInt(req.query.limit as string) || 5, 10);

  if (!query) {
    res.json([]);
    return;
  }

  try {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixRegex = new RegExp(`^${escapedQuery}`, 'i');
    const containsRegex = new RegExp(escapedQuery, 'i');

    const suggestions: any[] = [];

    // Priority 1: Title prefix matches
    const titlePrefix = await tracks()
      .find({ title: prefixRegex })
      .limit(limit)
      .toArray();

    for (const t of titlePrefix) {
      if (suggestions.length >= limit) break;
      suggestions.push({
        type: 'track',
        label: t.title,
        sublabel: t.artist,
        cover: `/api/cover/${t.publicId || t._id}`,
        id: t.publicId || t._id,
        artist: t.artist,
        album: t.album,
      });
    }

    // Priority 2: Artist matches
    if (suggestions.length < limit) {
      const artistMatches = await artists()
        .find({ name: containsRegex })
        .limit(3)
        .toArray();

      for (const a of artistMatches) {
        if (suggestions.length >= limit) break;
        suggestions.push({
          type: 'artist',
          label: a.name,
          sublabel: `${a.trackCount} song${a.trackCount > 1 ? 's' : ''}`,
          cover: a.coverArt ? `/api/cover/${a.coverArt}` : '',
          artist: a.name,
        });
      }
    }

    // Priority 3: Album matches
    if (suggestions.length < limit) {
      const albumMatches = await albums()
        .find({ name: containsRegex })
        .limit(3)
        .toArray();

      for (const a of albumMatches) {
        if (suggestions.length >= limit) break;
        suggestions.push({
          type: 'album',
          label: a.name,
          sublabel: a.artist,
          cover: a.coverArt ? `/api/cover/${a.coverArt}` : '',
          album: a.name,
          artist: a.artist,
        });
      }
    }

    // Priority 4: Contains matches (broader)
    if (suggestions.length < limit) {
      const existingIds = new Set(suggestions.filter((s) => s.id).map((s) => s.id));
      const containsResults = await tracks()
        .find({
          publicId: { $nin: Array.from(existingIds) },
          $or: [
            { title: containsRegex },
            { artist: containsRegex },
            { album: containsRegex },
          ],
        })
        .limit(limit - suggestions.length)
        .toArray();

      for (const t of containsResults) {
        if (suggestions.length >= limit) break;
        suggestions.push({
          type: 'track',
          label: t.title,
          sublabel: t.artist,
          cover: `/api/cover/${t.publicId || t._id}`,
          id: t.publicId || t._id,
          artist: t.artist,
          album: t.album,
        });
      }
    }

    res.json(suggestions);
  } catch (err: any) {
    console.error('[Suggestions] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

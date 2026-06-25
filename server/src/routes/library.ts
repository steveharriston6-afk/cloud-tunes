import { Router } from 'express';
import { tracks, artists, albums, favorites, playbackHistory } from '../db.js';

const router = Router();

// ─── GET /api/artists — Paginated artists with counts ────────────

router.get('/artists', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const cursorStr = req.query.cursor as string;
    const search = req.query.search as string;

    const query: any = {};
    if (search) {
      query.$text = { $search: search };
    }

    if (cursorStr) {
      try {
        const cursorData = JSON.parse(Buffer.from(cursorStr, 'base64').toString('utf-8'));
        query.$or = [
          { name: { $gt: cursorData.name } },
          { name: cursorData.name, _id: { $gt: cursorData.id } }
        ];
      } catch (err) {
        console.error('[Artists] Failed to parse cursor:', err);
      }
    }

    const result = await artists()
      .find(query)
      .sort({ name: 1, _id: 1 })
      .limit(limit)
      .toArray();

    let nextCursor: string | null = null;
    if (result.length === limit) {
      const last = result[result.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ name: last.name, id: last._id })).toString('base64');
    }

    res.json({
      artists: result,
      nextCursor
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/albums — Paginated albums with metadata ────────────

router.get('/albums', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const cursorStr = req.query.cursor as string;
    const search = req.query.search as string;

    const query: any = {};
    if (search) {
      query.$text = { $search: search };
    }

    if (cursorStr) {
      try {
        const cursorData = JSON.parse(Buffer.from(cursorStr, 'base64').toString('utf-8'));
        query.$or = [
          { name: { $gt: cursorData.name } },
          { name: cursorData.name, _id: { $gt: cursorData.id } }
        ];
      } catch (err) {
        console.error('[Albums] Failed to parse cursor:', err);
      }
    }

    const result = await albums()
      .find(query)
      .sort({ name: 1, _id: 1 })
      .limit(limit)
      .toArray();

    let nextCursor: string | null = null;
    if (result.length === limit) {
      const last = result[result.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ name: last.name, id: last._id })).toString('base64');
    }

    res.json({
      albums: result,
      nextCursor
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/stats — Library statistics ─────────────────────────

router.get('/stats', async (req, res) => {
  const userId = (req as any).userId;
  try {
    const trackCount = await tracks().countDocuments({ isAvailable: true });
    const artistCount = await artists().countDocuments();
    const albumCount = await albums().countDocuments();
    const favoriteCount = await favorites().countDocuments({ user_id: userId });

    // Total duration
    const durationAgg = await tracks()
      .aggregate([
        { $match: { isAvailable: true } },
        { $group: { _id: null, totalDuration: { $sum: '$duration' } } },
      ])
      .toArray();

    const totalDuration = durationAgg[0]?.totalDuration || 0;

    // Format breakdown
    const formatAgg = await tracks()
      .aggregate([
        { $match: { isAvailable: true } },
        { $group: { _id: '$format', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    // Source breakdown
    const sourceAgg = await tracks()
      .aggregate([
        { $match: { isAvailable: true } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ])
      .toArray();

    res.json({
      trackCount,
      artistCount,
      albumCount,
      favoriteCount,
      totalDuration,
      formats: formatAgg.map((f) => ({ format: f._id, count: f.count })),
      sources: sourceAgg.map((s) => ({ source: s._id, count: s.count })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/favorites — All user favorite track IDs ────────────

router.get('/favorites', async (req, res) => {
  const userId = (req as any).userId;
  try {
    const favs = await favorites().find({ user_id: userId }).sort({ addedAt: -1 }).toArray();
    res.json(favs.map((f) => f.trackId));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/favorites/:trackId — Toggle user favorite ─────────

router.post('/favorites/:trackId', async (req, res) => {
  const { trackId } = req.params;
  const userId = (req as any).userId;
  try {
    const existing = await favorites().findOne({ user_id: userId, trackId });
    if (existing) {
      await favorites().deleteOne({ user_id: userId, trackId });
      res.json({ action: 'removed', trackId });
    } else {
      await favorites().insertOne({
        _id: `fav_${userId}_${trackId}`,
        user_id: userId,
        trackId,
        addedAt: new Date(),
      });
      res.json({ action: 'added', trackId });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/history — User playback history ────────────────────

router.get('/history', async (req, res) => {
  const userId = (req as any).userId;
  try {
    const history = await playbackHistory()
      .find({ user_id: userId })
      .sort({ playedAt: -1 })
      .toArray();
    res.json(
      history.map((h) => ({
        trackId: h.trackId,
        lastPlayed: h.playedAt.toISOString(),
        playCount: h.playCount,
      }))
    );
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/history/:trackId — Record user play ────────────────

router.post('/history/:trackId', async (req, res) => {
  const { trackId } = req.params;
  const userId = (req as any).userId;
  try {
    const existing = await playbackHistory().findOne({ user_id: userId, trackId });
    if (existing) {
      await playbackHistory().updateOne(
        { user_id: userId, trackId },
        {
          $set: { playedAt: new Date() },
          $inc: { playCount: 1 },
        }
      );
    } else {
      await playbackHistory().insertOne({
        _id: `hist_${userId}_${trackId}_${Date.now()}`,
        user_id: userId,
        trackId,
        playedAt: new Date(),
        playCount: 1,
        lastPosition: 0,
      });
    }
    res.json({ status: 'recorded', trackId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/playlists — All user playlists ─────────────────────

router.get('/playlists', async (req, res) => {
  const userId = (req as any).userId;
  try {
    const result = await (await import('../db.js')).playlists()
      .find({ user_id: userId })
      .sort({ updatedAt: -1 })
      .toArray();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/playlists — Create user playlist ──────────────────

router.post('/playlists', async (req, res) => {
  const { name } = req.body;
  const userId = (req as any).userId;
  if (!name) {
    res.status(400).json({ error: 'Playlist name is required' });
    return;
  }
  try {
    const now = new Date();
    const playlist = {
      _id: `pl_${userId}_${Date.now()}`,
      user_id: userId,
      name,
      description: '',
      trackIds: [] as string[],
      coverArt: '',
      createdAt: now,
      updatedAt: now,
    };
    await (await import('../db.js')).playlists().insertOne(playlist);
    res.json(playlist);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/playlists/:id — Delete user playlist ────────────

router.delete('/playlists/:id', async (req, res) => {
  const userId = (req as any).userId;
  try {
    await (await import('../db.js')).playlists().deleteOne({ _id: req.params.id, user_id: userId });
    res.json({ status: 'deleted', id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/playlists/:id/tracks — Add track to user playlist ──

router.post('/playlists/:id/tracks', async (req, res) => {
  const { trackId } = req.body;
  const userId = (req as any).userId;
  if (!trackId) {
    res.status(400).json({ error: 'trackId is required' });
    return;
  }
  try {
    await (await import('../db.js')).playlists().updateOne(
      { _id: req.params.id, user_id: userId },
      {
        $addToSet: { trackIds: trackId },
        $set: { updatedAt: new Date() },
      }
    );
    res.json({ status: 'added', playlistId: req.params.id, trackId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/playlists/:id/tracks/:trackId — Remove track ─────

router.delete('/playlists/:id/tracks/:trackId', async (req, res) => {
  const userId = (req as any).userId;
  try {
    await (await import('../db.js')).playlists().updateOne(
      { _id: req.params.id, user_id: userId },
      {
        $pull: { trackIds: req.params.trackId },
        $set: { updatedAt: new Date() },
      }
    );
    res.json({ status: 'removed', playlistId: req.params.id, trackId: req.params.trackId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

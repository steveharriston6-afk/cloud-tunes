import crypto from 'crypto';
import { getDB } from './db.js';

/**
 * Creates all required indexes for the CloudTunes database.
 * Safe to call multiple times — createIndex is idempotent.
 */
export async function createIndexes(): Promise<void> {
  const db = getDB();
  console.log('[Indexes] Creating database indexes...');

  // ─── Tracks Collection ─────────────────────────────────────────

  const tracksCol = db.collection('tracks');

  // Populate publicId for any tracks missing it
  const cursor = tracksCol.find({ $or: [{ publicId: { $exists: false } }, { publicId: null }] });
  for await (const doc of cursor) {
    const publicId = crypto.createHash('sha256').update(doc._id.toString()).digest('hex');
    await tracksCol.updateOne({ _id: doc._id }, { $set: { publicId } });
  }

  // Full-text search index across title, artist, album, genre
  await tracksCol.createIndex(
    { title: 'text', artist: 'text', album: 'text', genre: 'text' },
    {
      weights: { title: 10, artist: 8, album: 6, genre: 4 },
      name: 'tracks_text_search',
      default_language: 'english',
    }
  );

  // Performance indexes for common queries
  await tracksCol.createIndex({ artist: 1 }, { name: 'tracks_artist' });
  await tracksCol.createIndex({ album: 1 }, { name: 'tracks_album' });
  await tracksCol.createIndex({ genre: 1 }, { name: 'tracks_genre' });
  await tracksCol.createIndex({ source: 1 }, { name: 'tracks_source' });
  await tracksCol.createIndex({ dateAdded: -1 }, { name: 'tracks_date_added' });
  await tracksCol.createIndex({ isAvailable: 1 }, { name: 'tracks_available' });
  await tracksCol.createIndex({ publicId: 1 }, { name: 'tracks_public_id', unique: true });
  await tracksCol.createIndex({ fileHash: 1 }, { name: 'tracks_file_hash', sparse: true });
  await tracksCol.createIndex({ driveFileId: 1 }, { name: 'tracks_drive_id', sparse: true });

  // Compound index for common filtered queries
  await tracksCol.createIndex(
    { isAvailable: 1, dateAdded: -1 },
    { name: 'tracks_available_recent' }
  );
  await tracksCol.createIndex(
    { isAvailable: 1, artist: 1 },
    { name: 'tracks_available_artist' }
  );
  await tracksCol.createIndex(
    { isAvailable: 1, album: 1 },
    { name: 'tracks_available_album' }
  );

  // ─── Artists Collection ────────────────────────────────────────

  const artistsCol = db.collection('artists');
  await artistsCol.createIndex({ name: 1 }, { name: 'artists_name', unique: true });
  await artistsCol.createIndex({ name: 'text' }, { name: 'artists_text_search' });

  // ─── Albums Collection ─────────────────────────────────────────

  const albumsCol = db.collection('albums');
  await albumsCol.createIndex(
    { name: 1, artist: 1 },
    { name: 'albums_name_artist', unique: true }
  );
  await albumsCol.createIndex({ name: 'text', artist: 'text' }, { name: 'albums_text_search' });

  // ─── Playlists Collection ──────────────────────────────────────

  const playlistsCol = db.collection('playlists');
  await playlistsCol.createIndex({ name: 1 }, { name: 'playlists_name' });
  await playlistsCol.createIndex({ user_id: 1 }, { name: 'playlists_user_id' });

  // ─── Genres Collection ─────────────────────────────────────────

  const genresCol = db.collection('genres');
  await genresCol.createIndex({ name: 1 }, { name: 'genres_name', unique: true });

  // ─── Playback History Collection ───────────────────────────────

  const historyCol = db.collection('playback_history');
  try {
    await historyCol.dropIndex('history_track_id');
  } catch (e) {}
  try {
    await historyCol.dropIndex('history_track_recent');
  } catch (e) {}
  await historyCol.createIndex({ user_id: 1, trackId: 1 }, { name: 'history_user_track_id', unique: true });
  await historyCol.createIndex({ user_id: 1 }, { name: 'history_user_id' });
  await historyCol.createIndex({ playedAt: -1 }, { name: 'history_played_at' });

  // ─── Favorites Collection ─────────────────────────────────────

  const favoritesCol = db.collection('favorites');
  try {
    await favoritesCol.dropIndex('favorites_track_id');
  } catch (e) {}
  await favoritesCol.createIndex({ user_id: 1, trackId: 1 }, { name: 'favorites_user_track_id', unique: true });
  await favoritesCol.createIndex({ user_id: 1 }, { name: 'favorites_user_id' });
  await favoritesCol.createIndex({ addedAt: -1 }, { name: 'favorites_added_at' });

  console.log('[Indexes] All indexes created successfully.');
}

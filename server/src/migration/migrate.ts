import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { connectDB, disconnectDB, tracks, artists, albums, genres } from '../db.js';
import { createIndexes } from '../indexes.js';
import type { TrackDocument, ArtistDocument, AlbumDocument, GenreDocument } from '../models/schemas.js';
import { invalidateSongsCache } from '../routes/tracks.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const SONGS_JSON_PATH = path.resolve(PROJECT_ROOT, 'data', 'songs.json');

export async function migrateTracksToMongo(jsonTracks: any[], shouldCloseConnection: boolean = false) {
  try {
    console.log(`[Migration] Found ${jsonTracks.length} tracks to process.`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const rawTrack of jsonTracks) {
      const id = rawTrack.id;
      const title = rawTrack.title || 'Unknown Title';
      const artist = rawTrack.artist || 'Unknown Artist';
      const album = rawTrack.album || 'Unknown Album';
      const genre = rawTrack.genre || 'Unknown Genre';
      const format = rawTrack.format || 'FLAC';
      const details = rawTrack.details || `${format} Stream`;
      const duration = typeof rawTrack.duration === 'number' ? rawTrack.duration : 180.0;
      const url = rawTrack.url || '';
      const cover = rawTrack.cover || '';

      const source = url.includes('drive.usercontent.google.com') || url.includes('/gdrive-proxy/') ? 'gdrive' : 'local';
      const publicId = crypto.createHash('sha256').update(id).digest('hex');

      // Build Document
      const trackDoc: TrackDocument = {
        _id: id,
        publicId,
        filePath: url,
        source,
        title,
        artist,
        album,
        albumArtist: artist, // Fallback
        genre,
        year: null, // Default
        duration,
        bitrate: null,
        sampleRate: null,
        bitDepth: null,
        format,
        details,
        coverArt: cover,
        lyrics: null,
        fileHash: source === 'local' ? id : null,
        driveFileId: source === 'gdrive' ? id : null,
        dateAdded: new Date(),
        lastModified: new Date(),
        sourceUpdatedAt: new Date(),
        isAvailable: true,
      };

      // Upsert
      const result = await tracks().replaceOne({ _id: id }, trackDoc, { upsert: true });

      if (result.upsertedCount > 0) {
        migratedCount++;
      } else {
        skippedCount++;
      }
    }

    // Soft-delete tracks not present in current active set
    const activeIds = jsonTracks.map(t => t.id);
    const deleteResult = await tracks().updateMany(
      { _id: { $nin: activeIds } },
      { $set: { isAvailable: false } }
    );
    console.log(`[Migration] Soft-deleted ${deleteResult.modifiedCount} stale tracks.`);

    console.log(`[Migration] Tracks: ${migratedCount} inserted/migrated, ${skippedCount} updated/synced.`);

    // 2. Populate Artists Collection
    console.log('[Migration] Compiling artists collection...');
    await artists().deleteMany({});
    const artistAgg = await tracks().aggregate([
      { $match: { isAvailable: true } },
      {
        $group: {
          _id: '$artist',
          trackCount: { $sum: 1 },
          albums: { $addToSet: '$album' },
          coverArt: { $first: '$publicId' },
          formats: { $addToSet: '$format' },
          sources: { $addToSet: '$source' },
        },
      },
    ]).toArray();

    for (const group of artistAgg) {
      const artistName = group._id || 'Unknown Artist';
      const hash = crypto.createHash('md5').update(artistName).digest('hex');
      const formats = (group.formats || []).map((f: string) => f.toUpperCase());
      const hasLossless = formats.some((f: string) => ['FLAC', 'ALAC', 'WAV'].includes(f));
      const highestQuality = hasLossless ? 'FLAC' : 'MP3';
      const isCloud = (group.sources || []).includes('gdrive');

      const doc: ArtistDocument = {
        _id: `artist_${hash}`,
        name: artistName,
        coverArt: group.coverArt || '',
        trackCount: group.trackCount,
        albumCount: group.albums.length,
        highestQuality,
        isCloud,
        dateAdded: new Date(),
      };
      await artists().replaceOne({ name: artistName }, doc, { upsert: true });
    }
    console.log(`[Migration] Artists collection populated with ${artistAgg.length} artists.`);

    // 3. Populate Albums Collection (grouped by album name only)
    console.log('[Migration] Compiling albums collection...');
    await albums().deleteMany({});
    const albumAgg = await tracks().aggregate([
      { $match: { isAvailable: true } },
      {
        $group: {
          _id: '$album',
          artists: { $addToSet: '$artist' },
          albumArtists: { $addToSet: '$albumArtist' },
          trackCount: { $sum: 1 },
          coverArt: { $first: '$publicId' },
          coverArts: { $addToSet: '$publicId' },
          year: { $first: '$year' },
          genre: { $first: '$genre' },
        },
      },
    ]).toArray();

    for (const group of albumAgg) {
      const albumName = group._id || 'Unknown Album';
      const uniqueArtists: string[] = (group.artists || []).filter(Boolean);
      const uniqueAlbumArtists: string[] = (group.albumArtists || []).filter(Boolean);

      // Determine display artist: prefer consistent albumArtist, then single artist, else "Various Artists"
      let displayArtist = 'Unknown Artist';
      if (uniqueArtists.length === 1) {
        displayArtist = uniqueArtists[0];
      } else if (uniqueAlbumArtists.length === 1 && uniqueAlbumArtists[0] !== uniqueArtists[0]) {
        displayArtist = uniqueAlbumArtists[0];
      } else if (uniqueArtists.length > 1) {
        displayArtist = 'Various Artists';
      }

      // Pick the best cover art (prefer one that actually has data)
      const coverArts: string[] = (group.coverArts || []).filter(Boolean);
      const bestCover = coverArts.length > 0 ? coverArts[0] : (group.coverArt || '');

      const hash = crypto.createHash('md5').update(albumName).digest('hex');
      const doc: AlbumDocument = {
        _id: `album_${hash}`,
        name: albumName,
        artist: displayArtist,
        coverArt: bestCover,
        trackCount: group.trackCount,
        year: group.year || null,
        genre: group.genre || 'Unknown Genre',
        dateAdded: new Date(),
      };
      await albums().replaceOne({ _id: `album_${hash}` }, doc, { upsert: true });
    }
    console.log(`[Migration] Albums collection populated with ${albumAgg.length} albums.`);

    // 4. Populate Genres Collection
    console.log('[Migration] Compiling genres collection...');
    await genres().deleteMany({});
    const genreAgg = await tracks().aggregate([
      { $match: { isAvailable: true } },
      {
        $group: {
          _id: '$genre',
          trackCount: { $sum: 1 },
        },
      },
    ]).toArray();

    for (const group of genreAgg) {
      const genreName = group._id || 'Unknown Genre';
      const hash = crypto.createHash('md5').update(genreName).digest('hex');
      const doc: GenreDocument = {
        _id: `genre_${hash}`,
        name: genreName,
        trackCount: group.trackCount,
      };
      await genres().replaceOne({ name: genreName }, doc, { upsert: true });
    }
    console.log(`[Migration] Genres collection populated with ${genreAgg.length} genres.`);

    // Invalidate Songs Cache
    invalidateSongsCache();

    console.log('[Migration] Seeding complete! Database is in sync with songs.json.');
  } catch (err: any) {
    console.error('[Migration] Failed during execution:', err);
  } finally {
    if (shouldCloseConnection) {
      await disconnectDB();
    }
  }
}

async function run() {
  console.log('[Migration] Starting migration from songs.json to MongoDB...');
  try {
    await connectDB();
    await createIndexes();
    if (fs.existsSync(SONGS_JSON_PATH)) {
      const rawData = fs.readFileSync(SONGS_JSON_PATH, 'utf-8');
      const jsonTracks = JSON.parse(rawData);
      await migrateTracksToMongo(jsonTracks, true);
    } else {
      console.warn(`[Migration] Warning: backup file not found at ${SONGS_JSON_PATH}`);
      await disconnectDB();
    }
  } catch (err: any) {
    console.error('[Migration] run script failed:', err);
    process.exit(1);
  }
}

// Execute CLI run if executed directly
if (process.argv[1]?.includes('migrate.ts') || process.argv[1]?.includes('migrate')) {
  run();
}

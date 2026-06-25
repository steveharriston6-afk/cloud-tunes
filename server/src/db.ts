import { MongoClient, Db, Collection } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import type {
  TrackDocument,
  ArtistDocument,
  AlbumDocument,
  PlaylistDocument,
  GenreDocument,
  PlaybackHistoryDocument,
  FavoriteDocument,
} from './models/schemas.js';

// Load env configuration
dotenv.config({ path: path.resolve(import.meta.dirname, '..', '..', '.env') });

if (!process.env.MONGO_URI) {
  throw new Error('MONGO_URI is not defined in the environment variables (.env)');
}
if (!process.env.DB_NAME) {
  throw new Error('DB_NAME is not defined in the environment variables (.env)');
}

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;



let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(MONGO_URI, {
    maxPoolSize: 20,
    minPoolSize: 2,
    maxIdleTimeMS: 30000,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  db = client.db(DB_NAME);
  console.log(`[DB] Connected to MongoDB: ${DB_NAME}`);
  return db;
}

export async function disconnectDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('[DB] Disconnected from MongoDB');
  }
}

export function getDB(): Db {
  if (!db) throw new Error('Database not connected. Call connectDB() first.');
  return db;
}

// ─── Typed Collection Accessors ──────────────────────────────────

export function tracks(): Collection<TrackDocument> {
  return getDB().collection<TrackDocument>('tracks');
}

export function artists(): Collection<ArtistDocument> {
  return getDB().collection<ArtistDocument>('artists');
}

export function albums(): Collection<AlbumDocument> {
  return getDB().collection<AlbumDocument>('albums');
}

export function playlists(): Collection<PlaylistDocument> {
  return getDB().collection<PlaylistDocument>('playlists');
}

export function genres(): Collection<GenreDocument> {
  return getDB().collection<GenreDocument>('genres');
}

export function playbackHistory(): Collection<PlaybackHistoryDocument> {
  return getDB().collection<PlaybackHistoryDocument>('playback_history');
}

export function favorites(): Collection<FavoriteDocument> {
  return getDB().collection<FavoriteDocument>('favorites');
}

// ─── Graceful Shutdown ───────────────────────────────────────────

process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectDB();
  process.exit(0);
});

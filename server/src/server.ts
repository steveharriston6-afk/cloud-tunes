import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import compression from 'compression';
import { connectDB } from './db.js';
import { createIndexes } from './indexes.js';
import tracksRouter from './routes/tracks.js';
import searchRouter from './routes/search.js';
import libraryRouter from './routes/library.js';
import { startSyncWorker, runSync } from './sync/syncWorker.js';
import { tracks } from './db.js';
import { extractFolderId, listAudioFiles, parseTrackFromFile } from './sync/gdriveImporter.js';
import { migrateTracksToMongo } from './migration/migrate.js';
import { downloadPlaceholderCovers } from './utils/downloadCovers.js';
import { invalidateSongsCache } from './routes/tracks.js';

// Load environment variables
dotenv.config({ path: path.resolve(import.meta.dirname, '..', '..', '.env') });

import fs from 'fs';

if (!process.env.PORT) {
  throw new Error('PORT is not defined in the environment variables (.env)');
}
const PORT = process.env.PORT;
const app = express();
const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..');
const DIST_PATH = path.resolve(PROJECT_ROOT, 'dist');


import crypto from 'crypto';

// Middlewares
app.use(compression());
app.use(cors());
app.use(express.json());

// Manual Cookie Parser & User Session Middleware
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const parts = c.trim().split('=');
      const k = parts[0];
      const v = parts.slice(1).join('=');
      return [k, v];
    })
  );

  let userId = cookies['user_id'];
  if (!userId) {
    userId = 'usr_' + crypto.randomUUID();
    res.setHeader('Set-Cookie', `user_id=${userId}; Path=/; HttpOnly; Max-Age=315360000; SameSite=Lax`);
  }
  (req as any).userId = userId;
  next();
});

if (fs.existsSync(DIST_PATH)) {
  console.log(`[Server] Serving production assets from: ${DIST_PATH}`);
  app.use(express.static(DIST_PATH));
}

// Security Headers Middleware with dynamic local network support for TVs
app.use((req, res, next) => {
  const host = req.headers.host || `localhost:${PORT}`;
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; ` +
    `script-src 'self' 'unsafe-inline'; ` +
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ` +
    `font-src 'self' https://fonts.gstatic.com; ` +
    `img-src 'self' data: http: https:; ` +
    `media-src 'self' blob: http: https:; ` +
    `connect-src 'self' http: https: ws: wss:;`
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Routes
app.use('/api', tracksRouter);
app.use('/api', searchRouter);
app.use('/api', libraryRouter);

// Basic health check
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', database: 'connected' });
});

// Wildcard fallback for SPA routing
if (fs.existsSync(DIST_PATH)) {
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.resolve(DIST_PATH, 'index.html'));
  });
}

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

async function migrateExistingCovers() {
  try {
    const oldTracks = await tracks().find({ coverArt: { $regex: /^https?:\/\// } }).toArray();
    if (oldTracks.length === 0) return;
    let updated = 0;
    for (const doc of oldTracks) {
      const groupKey = `${doc.artist || ''}::${doc.album || ''}`;
      const hash = [...groupKey].reduce((s, c) => s + c.charCodeAt(0), 0) % 8;
      await tracks().updateOne({ _id: doc._id }, { $set: { coverArt: `/covers/fallback_${hash}.jpg` } });
      updated++;
    }
    console.log(`[Server] Migrated ${updated} tracks to local cover paths.`);
    invalidateSongsCache();
  } catch (err: any) {
    console.log(`[Server] Cover migration skipped: ${err.message}`);
  }
}

async function seedIfEmpty() {
  try {
    const existingCount = await tracks().countDocuments({ isAvailable: true });
    if (existingCount > 0) {
      console.log(`[Server] Database has ${existingCount} tracks, skipping seed.`);
      return;
    }
    console.log('[Server] Database empty, importing from Google Drive...');
    const folderUrl = process.env.GOOGLE_DRIVE_FOLDER_URL || '';
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY || '';
    const folderId = extractFolderId(folderUrl);
    if (!folderId || !apiKey) {
      console.log('[Server] GOOGLE_DRIVE_FOLDER_URL or API key missing.');
      return;
    }
    try {
      const entries = await listAudioFiles(folderId, apiKey);
      if (entries.length === 0) { console.log('[Server] No audio files found in Drive.'); return; }
      const trackInputs = entries.map((e) => parseTrackFromFile(e.name, e.id, e.album));
      console.log(`[Server] Imported ${trackInputs.length} tracks from Google Drive, inserting into DB...`);
      await migrateTracksToMongo(trackInputs, false);
      console.log(`[Server] Database seeded with ${trackInputs.length} tracks.`);
    } catch (err: any) {
      console.log(`[Server] GDrive import failed: ${err.message}`);
    }
  } catch (err: any) {
    console.log(`[Server] Seed check failed: ${err.message}`);
  }
}

async function bootstrap() {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Setup indexes
    await createIndexes();

    // 3. Listen immediately (non-blocking, API available right away)
    app.listen(PORT, () => {
      console.log(`[Server] CloudTunes backend running on http://localhost:${PORT}`);
    });

    // 4. Pre-download placeholder covers to data/covers/
    downloadPlaceholderCovers(PROJECT_ROOT);

    // 5. Migrate existing HTTP cover URLs to local paths
    migrateExistingCovers();

    // 6. Seed in background (tracks appear as they're inserted)
    seedIfEmpty();

    // 7. Start sync worker in background
    startSyncWorker();
  } catch (err) {
    console.error('[Bootstrap Failed]', err);
    process.exit(1);
  }
}

bootstrap();

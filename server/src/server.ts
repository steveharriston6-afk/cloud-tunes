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
import { startSyncWorker } from './sync/syncWorker.js';

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

async function bootstrap() {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Setup indexes
    await createIndexes();

    // 3. Start background sync worker (defaults to checking every 5 mins)
    const syncInterval = process.env.SYNC_INTERVAL_MS 
      ? parseInt(process.env.SYNC_INTERVAL_MS, 10) 
      : 5 * 60 * 1000;
    startSyncWorker(syncInterval);

    // 4. Listen
    app.listen(PORT, () => {
      console.log(`[Server] CloudTunes backend running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[Bootstrap Failed]', err);
    process.exit(1);
  }
}

bootstrap();

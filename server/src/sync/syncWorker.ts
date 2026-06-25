import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { migrateTracksToMongo } from '../migration/migrate.js';
import { tracks } from '../db.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
let isSyncing = false;

function writeSyncStatus(status: 'idle' | 'syncing' | 'success' | 'error', errorMsg: string | null, detailsText?: string) {
  const statusFilePath = path.resolve(PROJECT_ROOT, 'data', 'sync_status.json');
  let stats = {
    totalDiscovered: 0,
    newAdded: 0,
    updated: 0,
    failed: 0,
    covers: { embedded: 0, folder: 0, fallback: 0 }
  };

  if (detailsText) {
    const discoveredMatch = detailsText.match(/Total files discovered:\s*(\d+)/i);
    const newAddedMatch = detailsText.match(/Total new tracks added:\s*(\d+)/i);
    const updatedMatch = detailsText.match(/Total existing tracks updated:\s*(\d+)/i);
    const failedMatch = detailsText.match(/Total tracks skipped\/failed:\s*(\d+)/i);
    const embeddedMatch = detailsText.match(/Embedded Cover Art:\s*(\d+)/i);
    const folderMatch = detailsText.match(/Folder Cover Art:\s*(\d+)/i);
    const fallbackMatch = detailsText.match(/Fallback \(Initials\/Gradients\):\s*(\d+)/i);

    if (discoveredMatch) stats.totalDiscovered = parseInt(discoveredMatch[1], 10);
    if (newAddedMatch) stats.newAdded = parseInt(newAddedMatch[1], 10);
    if (updatedMatch) stats.updated = parseInt(updatedMatch[1], 10);
    if (failedMatch) stats.failed = parseInt(failedMatch[1], 10);
    if (embeddedMatch) stats.covers.embedded = parseInt(embeddedMatch[1], 10);
    if (folderMatch) stats.covers.folder = parseInt(folderMatch[1], 10);
    if (fallbackMatch) stats.covers.fallback = parseInt(fallbackMatch[1], 10);
  }

  const statusObj = {
    status,
    lastSyncTime: new Date().toISOString(),
    error: errorMsg,
    stats,
    logs: detailsText ? detailsText.split('\n').filter(line => line.trim().length > 0) : []
  };

  try {
    fs.mkdirSync(path.dirname(statusFilePath), { recursive: true });
    fs.writeFileSync(statusFilePath, JSON.stringify(statusObj, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Sync] Error writing sync_status.json:', err);
  }
}

export async function runSync(): Promise<void> {
  if (isSyncing) {
    console.log('[Sync] Already syncing, skipping.');
    return;
  }

  const scriptPath = path.resolve(PROJECT_ROOT, 'scripts', 'import_gdrive.py');
  if (!fs.existsSync(scriptPath)) {
    console.log('[Sync] Import script not found, skipping sync.');
    return;
  }

  isSyncing = true;
  writeSyncStatus('syncing', null);

  const venvPython = path.resolve(PROJECT_ROOT, 'venv', 'bin', 'python');
  const pythonCmd = fs.existsSync(venvPython) ? `"${venvPython}"` : 'python3';

  console.log(`[Sync] Starting sync: ${pythonCmd} ${scriptPath}`);

  const allTracks = await tracks().find().toArray();
  const existingSongs = allTracks.map((t) => ({
    id: t._id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    genre: t.genre,
    url: t.filePath,
    cover: t.coverArt,
    format: t.format,
    details: t.details,
    duration: t.duration,
  }));

  await new Promise<void>((resolve, reject) => {
    const child = exec(
      `${pythonCmd} "${scriptPath}"`,
      { cwd: PROJECT_ROOT, maxBuffer: 25 * 1024 * 1024 },
      async (error, stdout, stderr) => {
        isSyncing = false;

        if (error) {
          console.error(`[Sync] Error: ${error.message}`);
          if (stderr) console.error(`[Sync] stderr: ${stderr}`);
          writeSyncStatus('error', error.message, (stderr || '') + '\n' + (stdout || ''));
          reject(error);
          return;
        }

        try {
          const startIdx = stdout.indexOf('===JSON_START===');
          const endIdx = stdout.indexOf('===JSON_END===');

          const cleanLogs = (
            (startIdx !== -1 ? stdout.substring(0, startIdx) : '') +
            (endIdx !== -1 ? stdout.substring(endIdx + '===JSON_END==='.length) : (startIdx === -1 ? stdout : ''))
          ).trim();

          if (startIdx !== -1 && endIdx !== -1) {
            const jsonStr = stdout.substring(startIdx + '===JSON_START==='.length, endIdx).trim();
            const parsedTracks = JSON.parse(jsonStr);
            console.log(`[Sync] Successfully parsed ${parsedTracks.length} tracks from stdout stream.`);

            if (cleanLogs) {
              console.log(`[Sync] Importer Logs:\n${cleanLogs}`);
            }

            console.log('[Sync] Triggering MongoDB database synchronization...');
            await migrateTracksToMongo(parsedTracks, false);
            writeSyncStatus('success', null, cleanLogs);
            resolve();
          } else {
            console.error('[Sync] JSON stream markers not found in output.');
            writeSyncStatus('error', 'JSON stream markers not found in output.', cleanLogs || stdout);
            reject(new Error('JSON stream markers not found'));
          }
        } catch (err: any) {
          console.error('[Sync] Failed to process output:', err.message);
          writeSyncStatus('error', `Failed to process output: ${err.message}`, stdout);
          reject(err);
        }
      }
    );

    child.stdin?.write(JSON.stringify(existingSongs));
    child.stdin?.end();
  });
}

export function startSyncWorker(intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout {
  console.log(`[Sync Worker] Background sync every ${intervalMs / 1000}s`);
  runSync();
  return setInterval(() => runSync(), intervalMs);
}

export function isSyncRunning(): boolean {
  return isSyncing;
}

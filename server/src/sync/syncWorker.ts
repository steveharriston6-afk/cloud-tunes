import fs from 'fs';
import path from 'path';
import { migrateTracksToMongo } from '../migration/migrate.js';
import { extractFolderId, listAudioFiles, parseTrackFromFile } from './gdriveImporter.js';

let isSyncing = false;

function writeSyncStatus(status: 'idle' | 'syncing' | 'success' | 'error', errorMsg: string | null) {
  const statusFilePath = path.resolve(import.meta.dirname, '..', '..', '..', 'data', 'sync_status.json');
  const statusObj = {
    status,
    lastSyncTime: new Date().toISOString(),
    error: errorMsg,
  };
  try {
    fs.mkdirSync(path.dirname(statusFilePath), { recursive: true });
    fs.writeFileSync(statusFilePath, JSON.stringify(statusObj, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Sync] Error writing sync_status.json:', err);
  }
}

async function runNodeImport(): Promise<void> {
  const folderUrl = process.env.GOOGLE_DRIVE_FOLDER_URL || '';
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY || '';
  const folderId = extractFolderId(folderUrl);
  if (!folderId || !apiKey) throw new Error('GOOGLE_DRIVE_FOLDER_URL or API key missing');
  const entries = await listAudioFiles(folderId, apiKey);
  if (entries.length === 0) throw new Error('No audio files found');
  const trackInputs = entries.map((e) => parseTrackFromFile(e.name, e.id, e.album));
  await migrateTracksToMongo(trackInputs, false);
}

export async function runSync(): Promise<void> {
  if (isSyncing) {
    console.log('[Sync] Already syncing, skipping.');
    return;
  }
  isSyncing = true;
  writeSyncStatus('syncing', null);

  try {
    console.log('[Sync] Running Node.js GDrive import...');
    await runNodeImport();
    console.log('[Sync] Import succeeded.');
    writeSyncStatus('success', null);
  } catch (err: any) {
    console.error(`[Sync] Import failed: ${err.message}`);
    writeSyncStatus('error', err.message);
  } finally {
    isSyncing = false;
  }
}

export function startSyncWorker(intervalMs: number = 60 * 60 * 1000): NodeJS.Timeout {
  console.log(`[Sync Worker] Background sync every ${intervalMs / 1000}s`);
  runSync().catch(() => {});
  return setInterval(() => runSync().catch(() => {}), intervalMs);
}

export function isSyncRunning(): boolean {
  return isSyncing;
}

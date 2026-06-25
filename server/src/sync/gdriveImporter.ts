import https from 'https';
import { DEFAULT_COVERS } from '../utils/downloadCovers.js';

const AUDIO_EXTS = ['.flac', '.mp3', '.wav', '.m4a', '.alac', '.aac', '.ogg'];

export function extractFolderId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
    /\/drive\/u\/\d+\/folders\/([a-zA-Z0-9_-]{10,})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  const longIds = url.match(/([a-zA-Z0-9_-]{25,})/g);
  if (longIds) {
    for (const c of longIds) {
      if (!c.startsWith('http') && !c.startsWith('www') && c.length >= 25)
        return c;
    }
  }
  return null;
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'CloudTunes/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface AudioEntry {
  name: string;
  id: string;
  album: string;
}

async function listFolder(folderId: string, apiKey: string, parentAlbum: string): Promise<AudioEntry[]> {
  const results: AudioEntry[] = [];
  let pageToken: string | null = null;

  while (true) {
    let url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType)&pageSize=1000&key=${apiKey}`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const data = await fetchJson(url);
    const items: DriveFile[] = data.files || [];

    const folders: DriveFile[] = [];
    for (const item of items) {
      const name = item.name?.trim();
      const fid = item.id;
      if (!name || !fid) continue;

      if (item.mimeType === 'application/vnd.google-apps.folder') {
        folders.push(item);
        continue;
      }

      const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
      if (AUDIO_EXTS.includes(ext) || item.mimeType?.startsWith('audio/')) {
        results.push({ name, id: fid, album: parentAlbum || 'Unknown Album' });
      }
    }

    // Recurse into subfolders — the folder name becomes the album name
    for (const folder of folders) {
      const subResults = await listFolder(folder.id, apiKey, folder.name);
      results.push(...subResults);
    }

    pageToken = data.nextPageToken || null;
    if (!pageToken) break;
  }

  return results;
}

export async function listAudioFiles(folderId: string, apiKey: string): Promise<AudioEntry[]> {
  return listFolder(folderId, apiKey, '');
}

export function parseTrackFromFile(filename: string, fileId: string, album?: string): TrackInput {
  const dot = filename.lastIndexOf('.');
  const ext = dot > 0 ? filename.slice(dot + 1).toUpperCase() : 'FLAC';
  const nameWithoutExt = dot > 0 ? filename.slice(0, dot) : filename;

  let artist = 'Unknown Artist';
  let title = nameWithoutExt;

  if (nameWithoutExt.includes(' - ')) {
    const parts = nameWithoutExt.split(' - ', 2);
    artist = parts[0].trim();
    title = parts[1].trim();
  }

  title = title.replace(/\s+/g, ' ').trim();
  if (!artist) artist = 'Unknown Artist';

  const resolvedAlbum = album || 'Unknown Album';

  const groupKey = `${artist}::${resolvedAlbum}`;
  const coverHash = [...groupKey].reduce((s, c) => s + c.charCodeAt(0), 0) % DEFAULT_COVERS.length;

  return {
    id: fileId,
    title,
    artist,
    album: resolvedAlbum,
    genre: 'Unknown Genre',
    url: `https://drive.usercontent.google.com/download?id=${fileId}&export=download`,
    cover: `/covers/fallback_${coverHash}.jpg`,
    format: ext,
    details: `${ext} Stream`,
    duration: 180.0,
  };
}

export interface TrackInput {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  url: string;
  cover: string;
  format: string;
  details: string;
  duration: number;
}

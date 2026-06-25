import https from 'https';

const AUDIO_EXTS = ['.flac', '.mp3', '.wav', '.m4a', '.alac', '.aac', '.ogg'];

const DEFAULT_COVERS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1539625319138-1e028b1aa25d?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1510915228340-29c85a43dcfe?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1526478806334-5fa488f7f9ec?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1484755560695-a4ec7489fc85?w=500&auto=format&fit=crop&q=60',
];

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

export async function listAudioFiles(folderId: string, apiKey: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  let pageToken: string | null = null;

  while (true) {
    let url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType)&pageSize=1000&key=${apiKey}`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const data = await fetchJson(url);
    const items: DriveFile[] = data.files || [];

    for (const item of items) {
      const name = item.name?.trim();
      const fid = item.id;
      if (!name || !fid) continue;
      const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
      if (AUDIO_EXTS.includes(ext) || item.mimeType?.startsWith('audio/')) {
        files.set(name, fid);
      }
    }

    pageToken = data.nextPageToken || null;
    if (!pageToken) break;
  }

  return files;
}

export function parseTrackFromFile(filename: string, fileId: string): TrackInput {
  const dot = filename.lastIndexOf('.');
  const ext = dot > 0 ? filename.slice(dot + 1).toUpperCase() : 'FLAC';
  const nameWithoutExt = dot > 0 ? filename.slice(0, dot) : filename;

  let artist = 'Unknown Artist';
  let title = nameWithoutExt;
  let album = 'Unknown Album';

  if (nameWithoutExt.includes(' - ')) {
    const parts = nameWithoutExt.split(' - ', 2);
    artist = parts[0].trim();
    title = parts[1].trim();
  }

  title = title.replace(/\s+/g, ' ').trim();
  if (!artist) artist = 'Unknown Artist';
  if (!album) album = 'Unknown Album';

  const coverHash = [...title].reduce((s, c) => s + c.charCodeAt(0), 0) % DEFAULT_COVERS.length;

  return {
    id: fileId,
    title,
    artist,
    album,
    genre: 'Unknown Genre',
    url: `https://drive.usercontent.google.com/download?id=${fileId}&export=download`,
    cover: DEFAULT_COVERS[coverHash],
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

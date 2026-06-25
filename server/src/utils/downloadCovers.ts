import fs from 'fs';
import path from 'path';
import https from 'https';

export const DEFAULT_COVERS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1539625319138-1e028b1aa25d?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1510915228340-29c85a43dcfe?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1526478806334-5fa488f7f9ec?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1484755560695-a4ec7489fc85?w=500&auto=format&fit=crop&q=60',
];

export function coversDir(projectRoot: string): string {
  return path.resolve(projectRoot, 'data', 'covers');
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'CloudTunes/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        if (res.headers.location) {
          resolve(downloadFile(res.headers.location, dest));
          return;
        }
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      try { fs.unlinkSync(dest); } catch {}
      reject(err);
    });
  });
}

export async function downloadPlaceholderCovers(projectRoot: string): Promise<void> {
  const dir = coversDir(projectRoot);
  fs.mkdirSync(dir, { recursive: true });

  let downloaded = 0;
  for (let i = 0; i < DEFAULT_COVERS.length; i++) {
    const dest = path.resolve(dir, `fallback_${i}.jpg`);
    if (fs.existsSync(dest)) continue;
    try {
      console.log(`[Covers] Downloading fallback cover ${i}...`);
      await downloadFile(DEFAULT_COVERS[i], dest);
      downloaded++;
    } catch (err: any) {
      console.log(`[Covers] Failed fallback cover ${i}: ${err.message}`);
    }
  }
  console.log(`[Covers] ${downloaded} new covers downloaded.`);
}

// ─── Track Document ──────────────────────────────────────────────

export interface TrackDocument {
  _id: string;                    // Google Drive file ID or MD5 hash
  publicId: string;               // SHA-256 hash of _id (secure identifier)
  filePath: string;               // Original URL or local path
  source: 'gdrive' | 'local';
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  year: number | null;
  duration: number;
  bitrate: number | null;
  sampleRate: number | null;
  bitDepth: number | null;
  format: string;
  details: string;
  coverArt: string;               // Path or URL to cover image
  lyrics: string | null;
  fileHash: string | null;
  driveFileId: string | null;
  dateAdded: Date;
  lastModified: Date;
  sourceUpdatedAt: Date | null;
  isAvailable: boolean;           // false = soft-deleted
}

// ─── Artist Document ─────────────────────────────────────────────

export interface ArtistDocument {
  _id: string;                    // Auto-generated
  name: string;
  coverArt: string;
  trackCount: number;
  albumCount: number;
  highestQuality: string;
  isCloud: boolean;
  dateAdded: Date;
}

// ─── Album Document ──────────────────────────────────────────────

export interface AlbumDocument {
  _id: string;                    // Auto-generated
  name: string;
  artist: string;
  coverArt: string;
  trackCount: number;
  year: number | null;
  genre: string;
  dateAdded: Date;
}

// ─── Playlist Document ───────────────────────────────────────────

export interface PlaylistDocument {
  _id: string;
  user_id: string;
  name: string;
  description: string;
  trackIds: string[];
  coverArt: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Genre Document ──────────────────────────────────────────────

export interface GenreDocument {
  _id: string;
  name: string;
  trackCount: number;
}

// ─── Playback History Document ───────────────────────────────────

export interface PlaybackHistoryDocument {
  _id: string;
  user_id: string;
  trackId: string;
  playedAt: Date;
  playCount: number;
  lastPosition: number;           // seconds
}

// ─── Favorite Document ───────────────────────────────────────────

export interface FavoriteDocument {
  _id: string;
  user_id: string;
  trackId: string;
  addedAt: Date;
}

// ─── API Response Types ──────────────────────────────────────────

/** Track as returned by the API (frontend-compatible) */
export interface TrackAPIResponse {
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
  isCloud: boolean;
  year: number | null;
  bitrate: number | null;
  sampleRate: number | null;
  bitDepth: number | null;
  source: string;
  dateAdded: string;
}

/** Convert TrackDocument to API response */
export function toTrackAPI(doc: TrackDocument): TrackAPIResponse {
  const url = `/api/stream/${doc.publicId || doc._id}`;

  return {
    id: doc.publicId || doc._id,
    title: doc.title,
    artist: doc.artist,
    album: doc.album,
    genre: doc.genre,
    url,
    cover: doc.coverArt ? `/api/cover/${doc.publicId || doc._id}` : '',
    format: doc.format,
    details: doc.details,
    duration: doc.duration,
    isCloud: doc.source === 'gdrive',
    year: doc.year,
    bitrate: doc.bitrate,
    sampleRate: doc.sampleRate,
    bitDepth: doc.bitDepth,
    source: doc.source,
    dateAdded: doc.dateAdded.toISOString(),
  };
}

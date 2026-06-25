import type { Track } from '../context/MusicPlayerContext';

// ─── Types ───────────────────────────────────────────────────────

export interface SearchResult {
  track: Track;
  score: number;
  matchField: 'title' | 'artist' | 'album' | 'genre' | 'details' | 'filename';
}

export interface SearchSuggestion {
  type: 'track' | 'artist' | 'album' | 'playlist';
  label: string;
  sublabel: string;
  cover: string;
  track?: Track;
  album?: string;
  artist?: string;
  playlistId?: string;
}

// ─── Normalization ───────────────────────────────────────────────

/** Normalize a string for fuzzy matching: lowercase, strip accents/special chars, collapse whitespace */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')    // strip diacritics
    .replace(/[^a-z0-9\s]/g, ' ')       // replace special chars with spaces
    .replace(/\s+/g, ' ')               // collapse whitespace
    .trim();
}

/** Split into individual search tokens */
function tokenize(str: string): string[] {
  return normalize(str).split(' ').filter(Boolean);
}

// ─── Indexed Track Entry ─────────────────────────────────────────

interface IndexedTrack {
  track: Track;
  titleNorm: string;
  artistNorm: string;
  albumNorm: string;
  genreNorm: string;
  detailsNorm: string;
  filenameNorm: string;
  allText: string; // concatenated for broad matching
}

// ─── Search Engine Class ─────────────────────────────────────────

export class SearchEngine {
  private index: IndexedTrack[] = [];
  private trackMap = new Map<string, IndexedTrack>();

  /** Build or rebuild the search index from a track list */
  buildIndex(tracks: Track[]): void {
    this.index = tracks.map((track) => {
      const titleNorm = normalize(track.title);
      const artistNorm = normalize(track.artist || '');
      const albumNorm = normalize(track.album || '');
      const genreNorm = normalize((track as any).genre || '');
      const detailsNorm = normalize(track.details || '');
      // Extract filename from URL for fallback matching
      const urlParts = (track.url || '').split('/');
      const rawFilename = decodeURIComponent(urlParts[urlParts.length - 1] || '');
      const filenameNorm = normalize(rawFilename.replace(/\.[^.]+$/, ''));

      const allText = [titleNorm, artistNorm, albumNorm, genreNorm, detailsNorm, filenameNorm].join(' ');

      const entry: IndexedTrack = {
        track,
        titleNorm,
        artistNorm,
        albumNorm,
        genreNorm,
        detailsNorm,
        filenameNorm,
        allText,
      };

      this.trackMap.set(track.id, entry);
      return entry;
    });
  }

  /** Score a single indexed track against normalized query tokens */
  private scoreTrack(entry: IndexedTrack, queryNorm: string, tokens: string[]): number {
    let score = 0;

    // ── Priority 1: Exact title match (highest)
    if (entry.titleNorm === queryNorm) {
      score += 1000;
    }

    // ── Priority 2: Title starts with query
    if (entry.titleNorm.startsWith(queryNorm)) {
      score += 500;
    }

    // ── Priority 3: Title contains query
    if (entry.titleNorm.includes(queryNorm)) {
      score += 200;
    }

    // ── Priority 4: Artist exact / starts-with / contains
    if (entry.artistNorm === queryNorm) {
      score += 400;
    } else if (entry.artistNorm.startsWith(queryNorm)) {
      score += 180;
    } else if (entry.artistNorm.includes(queryNorm)) {
      score += 120;
    }

    // ── Priority 5: Album exact / starts-with / contains
    if (entry.albumNorm === queryNorm) {
      score += 350;
    } else if (entry.albumNorm.startsWith(queryNorm)) {
      score += 150;
    } else if (entry.albumNorm.includes(queryNorm)) {
      score += 100;
    }

    // ── Genre match
    if (entry.genreNorm && entry.genreNorm.includes(queryNorm)) {
      score += 80;
    }

    // ── Details match (e.g. "FLAC", "24-bit")
    if (entry.detailsNorm.includes(queryNorm)) {
      score += 40;
    }

    // ── Filename fallback match
    if (entry.filenameNorm.includes(queryNorm)) {
      score += 30;
    }

    // ── Multi-token matching: every token must appear somewhere
    if (tokens.length > 1) {
      const allTokensMatch = tokens.every((tok) => entry.allText.includes(tok));
      if (allTokensMatch) {
        score += 150 + tokens.length * 20;
      }
    }

    // ── Individual token partial matches (additive)
    for (const tok of tokens) {
      if (entry.titleNorm.includes(tok)) score += 15;
      if (entry.artistNorm.includes(tok)) score += 10;
      if (entry.albumNorm.includes(tok)) score += 8;
    }

    return score;
  }

  /** Search tracks and return ranked results */
  search(query: string, limit?: number): SearchResult[] {
    const queryNorm = normalize(query);
    if (!queryNorm) return [];

    const tokens = tokenize(query);

    const results: SearchResult[] = [];

    for (const entry of this.index) {
      const score = this.scoreTrack(entry, queryNorm, tokens);
      if (score > 0) {
        // Determine primary match field for display purposes
        let matchField: SearchResult['matchField'] = 'title';
        if (entry.titleNorm.includes(queryNorm)) matchField = 'title';
        else if (entry.artistNorm.includes(queryNorm)) matchField = 'artist';
        else if (entry.albumNorm.includes(queryNorm)) matchField = 'album';
        else if (entry.genreNorm.includes(queryNorm)) matchField = 'genre';
        else if (entry.detailsNorm.includes(queryNorm)) matchField = 'details';
        else matchField = 'filename';

        results.push({ track: entry.track, score, matchField });
      }
    }

    // Sort by score descending, then alphabetically by title for ties
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.track.title.localeCompare(b.track.title);
    });

    return limit ? results.slice(0, limit) : results;
  }

  /** Generate rich auto-suggestions (tracks, artists, albums) */
  getSuggestions(query: string, maxSuggestions: number = 5): SearchSuggestion[] {
    const queryNorm = normalize(query);
    if (!queryNorm) return [];

    const tokens = tokenize(query);
    const suggestions: SearchSuggestion[] = [];
    const seenLabels = new Set<string>();

    // 1. Track suggestions (top scored)
    const trackResults = this.search(query, maxSuggestions * 2);

    for (const result of trackResults) {
      if (suggestions.length >= maxSuggestions) break;
      const key = `track:${result.track.id}`;
      if (seenLabels.has(key)) continue;
      seenLabels.add(key);

      suggestions.push({
        type: 'track',
        label: result.track.title,
        sublabel: result.track.artist,
        cover: result.track.cover || '',
        track: result.track,
        album: result.track.album,
        artist: result.track.artist,
      });
    }

    // 2. Deduplicated artist suggestions
    if (suggestions.length < maxSuggestions) {
      const artistScores = new Map<string, { score: number; cover: string; trackCount: number }>();
      for (const entry of this.index) {
        const artistNorm = entry.artistNorm;
        if (!artistNorm || artistNorm === 'unknown artist') continue;
        const matches = artistNorm.includes(queryNorm) || tokens.every(t => artistNorm.includes(t));
        if (matches) {
          const existing = artistScores.get(entry.track.artist) || { score: 0, cover: '', trackCount: 0 };
          existing.score += (artistNorm === queryNorm ? 500 : artistNorm.startsWith(queryNorm) ? 200 : 100);
          existing.trackCount++;
          artistScores.set(entry.track.artist, existing);
        }
      }

      const sortedArtists = Array.from(artistScores.entries())
        .sort((a, b) => b[1].score - a[1].score);

      for (const [artistName, info] of sortedArtists) {
        if (suggestions.length >= maxSuggestions) break;
        const key = `artist:${artistName}`;
        if (seenLabels.has(key)) continue;
        seenLabels.add(key);

        suggestions.push({
          type: 'artist',
          label: artistName,
          sublabel: `${info.trackCount} song${info.trackCount > 1 ? 's' : ''}`,
          cover: info.cover,
          artist: artistName,
        });
      }
    }

    // 3. Deduplicated album suggestions
    if (suggestions.length < maxSuggestions) {
      const albumScores = new Map<string, { score: number; cover: string; artist: string; trackCount: number }>();
      for (const entry of this.index) {
        const albumNorm = entry.albumNorm;
        if (!albumNorm || albumNorm === 'unknown album') continue;
        const matches = albumNorm.includes(queryNorm) || tokens.every(t => albumNorm.includes(t));
        if (matches) {
          const existing = albumScores.get(entry.track.album) || { score: 0, cover: '', artist: '', trackCount: 0 };
          existing.score += (albumNorm === queryNorm ? 500 : albumNorm.startsWith(queryNorm) ? 200 : 100);
          existing.trackCount++;
          if (!existing.cover && entry.track.cover) existing.cover = entry.track.cover;
          if (!existing.artist) existing.artist = entry.track.artist;
          albumScores.set(entry.track.album, existing);
        }
      }

      const sortedAlbums = Array.from(albumScores.entries())
        .sort((a, b) => b[1].score - a[1].score);

      for (const [albumName, info] of sortedAlbums) {
        if (suggestions.length >= maxSuggestions) break;
        const key = `album:${albumName}`;
        if (seenLabels.has(key)) continue;
        seenLabels.add(key);

        suggestions.push({
          type: 'album',
          label: albumName,
          sublabel: info.artist,
          cover: info.cover,
          album: albumName,
          artist: info.artist,
        });
      }
    }

    return suggestions.slice(0, maxSuggestions);
  }

  /** Filter a list of tracks using the search engine. Returns all matching tracks, ranked. */
  filterTracks(tracksList: Track[], query: string): Track[] {
    if (!normalize(query)) return tracksList;

    const queryNorm = normalize(query);
    const tokens = tokenize(query);
    const trackIdSet = new Set(tracksList.map(t => t.id));

    const scored: { track: Track; score: number }[] = [];

    for (const entry of this.index) {
      if (!trackIdSet.has(entry.track.id)) continue;
      const score = this.scoreTrack(entry, queryNorm, tokens);
      if (score > 0) {
        scored.push({ track: entry.track, score });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.track.title.localeCompare(b.track.title);
    });

    return scored.map(s => s.track);
  }
}

/** Highlight matching text portions for display */
export function highlightMatch(text: string, query: string): { text: string; highlighted: boolean }[] {
  if (!query.trim()) return [{ text, highlighted: false }];

  const queryNorm = normalize(query);
  const textLower = text.toLowerCase();
  const parts: { text: string; highlighted: boolean }[] = [];

  let lastIndex = 0;
  // Try to find each token in the text
  const tokens = tokenize(query);

  // Sort tokens longest-first for greedy matching
  const sortedTokens = [...tokens].sort((a, b) => b.length - a.length);

  // Find all match ranges
  const ranges: [number, number][] = [];

  for (const token of sortedTokens) {
    let searchFrom = 0;
    while (searchFrom < textLower.length) {
      const idx = textLower.indexOf(token, searchFrom);
      if (idx === -1) break;
      ranges.push([idx, idx + token.length]);
      searchFrom = idx + 1;
    }
  }

  // Also try the full query as a single match
  {
    let searchFrom = 0;
    while (searchFrom < textLower.length) {
      const idx = textLower.indexOf(queryNorm, searchFrom);
      if (idx === -1) break;
      ranges.push([idx, idx + queryNorm.length]);
      searchFrom = idx + 1;
    }
  }

  if (ranges.length === 0) return [{ text, highlighted: false }];

  // Merge overlapping ranges
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const prev = merged[merged.length - 1];
    if (ranges[i][0] <= prev[1]) {
      prev[1] = Math.max(prev[1], ranges[i][1]);
    } else {
      merged.push(ranges[i]);
    }
  }

  for (const [start, end] of merged) {
    if (start > lastIndex) {
      parts.push({ text: text.slice(lastIndex, start), highlighted: false });
    }
    parts.push({ text: text.slice(start, end), highlighted: true });
    lastIndex = end;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlighted: false });
  }

  return parts;
}

// Singleton instance
export const searchEngine = new SearchEngine();

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import type { EffectMode, SpatialSettings } from '../audio/AudioEngine';
import { pruneAudioCache } from '../utils/swRegister';
import { dbCache } from '../utils/dbCache';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  url: string;
  cover: string;
  format: string;
  details: string;
  duration: number;
  isCloud?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  songIds: string[];
}

export interface RecentlyPlayed {
  trackId: string;
  lastPlayed: string; // ISO date string
  playCount: number;
}

interface MusicPlayerContextType {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  queue: Track[];
  queueIndex: number;
  playlists: Playlist[];
  favorites: string[];
  recentlyPlayed: RecentlyPlayed[];
  repeatMode: 'none' | 'all' | 'one';
  isShuffle: boolean;
  effectMode: EffectMode;
  spatialSettings: SpatialSettings;
  theme: 'dark' | 'light' | 'system';
  setTheme: (theme: 'dark' | 'light' | 'system') => void;

  playTrack: (track: Track, contextTracks?: Track[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  setRepeatMode: (mode: 'none' | 'all' | 'one') => void;
  toggleShuffle: () => void;
  setEffectMode: (mode: EffectMode) => void;
  updateSpatialSettings: (settings: Partial<SpatialSettings>) => void;

  // Queue Management
  addToQueue: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  playNext: (track: Track) => void;
  clearQueue: () => void;
  setQueue: (tracks: Track[]) => void;

  // Playlist & Favorites
  toggleFavorite: (trackId: string) => void;
  createPlaylist: (name: string) => void;
  deletePlaylist: (playlistId: string) => void;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;

  isSyncing: boolean;
  syncLibrary: () => Promise<void>;

  // Cursor-based song pagination
  hasMoreSongs: boolean;
  isLoadingSongs: boolean;
  loadMoreSongs: () => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(undefined);

export const MusicPlayerProvider = ({ children }: { children: React.ReactNode }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(() => {
    try {
      const saved = localStorage.getItem('cloudtunes_current_track');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('cloudtunes_current_time');
      return saved ? parseFloat(saved) : 0;
    } catch {
      return 0;
    }
  });
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('cloudtunes_volume');
      return saved ? parseFloat(saved) : 0.8;
    } catch {
      return 0.8;
    }
  });
  const [queue, setQueue] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem('cloudtunes_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [queueIndex, setQueueIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('cloudtunes_queue_index');
      return saved ? parseInt(saved, 10) : -1;
    } catch {
      return -1;
    }
  });
  const [isShuffle, setIsShuffle] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('cloudtunes_is_shuffle');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>(() => {
    try {
      const saved = localStorage.getItem('cloudtunes_repeat_mode');
      return (saved as any) || 'all';
    } catch {
      return 'all';
    }
  });
  const [effectMode, setEffectModeState] = useState<EffectMode>(() => {
    try {
      const saved = localStorage.getItem('cloudtunes_effect_mode');
      return (saved as any) || 'Original';
    } catch {
      return 'Original';
    }
  });
  const [spatialSettings, setSpatialSettingsState] = useState<SpatialSettings>(() => {
    try {
      const saved = localStorage.getItem('cloudtunes_spatial_settings');
      return saved ? JSON.parse(saved) : {
        intensity: 0.5,
        roomSize: 'Medium',
        height: 0.5,
        spatialEnabled: true,
      };
    } catch {
      return {
        intensity: 0.5,
        roomSize: 'Medium',
        height: 0.5,
        spatialEnabled: true,
      };
    }
  });

  const [theme, setThemeState] = useState<'dark' | 'light' | 'system'>('dark');

  // Load theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('cloudtunes_theme') as 'dark' | 'light' | 'system' | null;
    if (savedTheme) {
      setThemeState(savedTheme);
    }
  }, []);

  // Handle theme changes
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (t: 'dark' | 'light' | 'system') => {
      let isLight = false;
      if (t === 'system') {
        isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      } else {
        isLight = t === 'light';
      }

      if (isLight) {
        root.classList.add('light');
        root.style.colorScheme = 'light';
      } else {
        root.classList.remove('light');
        root.style.colorScheme = 'dark';
      }
    };

    applyTheme(theme);
    localStorage.setItem('cloudtunes_theme', theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      const listener = (e: MediaQueryListEvent) => {
        if (e.matches) {
          root.classList.add('light');
          root.style.colorScheme = 'light';
        } else {
          root.classList.remove('light');
          root.style.colorScheme = 'dark';
        }
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  const setTheme = (t: 'dark' | 'light' | 'system') => {
    setThemeState(t);
  };

  // Persisted state
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayed[]>([]);
  const [originalQueue, setOriginalQueue] = useState<Track[]>([]);

  const currentTrackRef = useRef(currentTrack);
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const repeatModeRef = useRef(repeatMode);
  const isShuffleRef = useRef(isShuffle);
  const tracksRef = useRef(tracks);
  const recentlyPlayedRef = useRef(recentlyPlayed);
  const currentTimeRef = useRef(currentTime);

  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { isShuffleRef.current = isShuffle; }, [isShuffle]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { recentlyPlayedRef.current = recentlyPlayed; }, [recentlyPlayed]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  // Sync state modifications to localStorage
  useEffect(() => {
    localStorage.setItem('cloudtunes_queue', JSON.stringify(queue));
    localStorage.setItem('cloudtunes_queue_index', queueIndex.toString());
  }, [queue, queueIndex]);

  useEffect(() => {
    if (currentTrack) {
      localStorage.setItem('cloudtunes_current_track', JSON.stringify(currentTrack));
    } else {
      localStorage.removeItem('cloudtunes_current_track');
    }
  }, [currentTrack]);

  useEffect(() => {
    localStorage.setItem('cloudtunes_is_shuffle', JSON.stringify(isShuffle));
  }, [isShuffle]);

  useEffect(() => {
    localStorage.setItem('cloudtunes_repeat_mode', repeatMode);
  }, [repeatMode]);

  useEffect(() => {
    localStorage.setItem('cloudtunes_volume', volume.toString());
  }, [volume]);

  useEffect(() => {
    localStorage.setItem('cloudtunes_effect_mode', effectMode);
  }, [effectMode]);

  useEffect(() => {
    localStorage.setItem('cloudtunes_spatial_settings', JSON.stringify(spatialSettings));
  }, [spatialSettings]);

  // Preloading Track N+1 and Pruning Caches
  useEffect(() => {
    if (!currentTrack) return;

    let nextTrackItem: Track | null = null;
    if (queue.length > 0 && queueIndex >= 0) {
      const nextIdx = queueIndex + 1;
      if (nextIdx < queue.length) {
        nextTrackItem = queue[nextIdx];
      } else if (repeatMode === 'all') {
        nextTrackItem = queue[0];
      }
    }

    if (nextTrackItem) {
      audioEngine.preloadTrack(nextTrackItem.url);
    }

    const keepUrls = [currentTrack.url];
    if (nextTrackItem) {
      keepUrls.push(nextTrackItem.url);
    }
    pruneAudioCache(keepUrls);
  }, [currentTrack, queue, queueIndex, repeatMode]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [songsCursor, setSongsCursor] = useState<string | null>(null);
  const [hasMoreSongs, setHasMoreSongs] = useState(true);
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);

  const fetchSongs = () => {
    setIsLoadingSongs(true);
    fetch('/api/songs?limit=20')
      .then((res) => res.json())
      .then((data: { tracks: Track[]; nextCursor: string | null }) => {
        setSongsCursor(data.nextCursor);
        setHasMoreSongs(!!data.nextCursor);
        const songsList = data.tracks;
        dbCache.setMetadata('songs_list', songsList);
        setTracks(songsList);
      })
      .catch((err) => console.error('Failed to load track metadata:', err))
      .finally(() => setIsLoadingSongs(false));
  };

  const loadMoreSongs = () => {
    if (!songsCursor || isLoadingSongs || !hasMoreSongs) return;
    setIsLoadingSongs(true);
    fetch(`/api/songs?limit=20&cursor=${encodeURIComponent(songsCursor)}`)
      .then((res) => res.json())
      .then((data: { tracks: Track[]; nextCursor: string | null }) => {
        setSongsCursor(data.nextCursor);
        setHasMoreSongs(!!data.nextCursor);
        setTracks((prev) => [...prev, ...data.tracks]);
      })
      .catch((err) => console.error('Failed to load more tracks:', err))
      .finally(() => setIsLoadingSongs(false));
  };

  // Restores local cached tracks list instantly on startup, then polls
  useEffect(() => {
    const initTracks = async () => {
      try {
        const cached = await dbCache.getMetadata<Track[]>('songs_list');
        if (cached && cached.length > 0) {
          setTracks(cached);
        }
      } catch (err) {
        console.error('Failed to load cached metadata from IndexedDB:', err);
      }
      fetchSongs();
    };
    initTracks();
    const interval = setInterval(fetchSongs, 30000);
    return () => clearInterval(interval);
  }, []);

  const syncLibrary = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync', { method: 'POST' });
      if (response.ok) {
        // Wait briefly for the script write operation to finalize
        await new Promise((resolve) => setTimeout(resolve, 1500));
        fetchSongs();
      }
    } catch (err) {
      console.error('Error during manual sync:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Load dynamic colors when track changes
  useEffect(() => {
    if (currentTrack) {
      import('../utils/colorExtractor').then(({ extractColorsFromImage, applyAlbumColors }) => {
        extractColorsFromImage(currentTrack.cover)
          .then((colors) => {
            applyAlbumColors(colors);
          })
          .catch((err) => {
            console.error('Failed to extract album colors:', err);
          });
      });
    } else {
      const root = document.documentElement;
      root.style.setProperty('--album-color-solid', '#ff2d55');
      root.style.setProperty('--album-color-solid-muted', 'rgba(255, 45, 85, 0.5)');
      root.style.setProperty('--album-color-start', 'rgba(255, 45, 85, 0.12)');
      root.style.setProperty('--album-color-end', 'rgba(142, 45, 226, 0.12)');
    }
  }, [currentTrack]);

  // Load persisted user state
  useEffect(() => {
    // 1. Fetch Favorites
    fetch('/api/favorites')
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: string[]) => {
        setFavorites(data);
        localStorage.setItem('cloudtunes_favorites', JSON.stringify(data));
      })
      .catch(() => {
        const savedFavorites = localStorage.getItem('cloudtunes_favorites');
        if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
      });

    // 2. Fetch Playlists
    fetch('/api/playlists')
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: any[]) => {
        const mapped = data.map((pl) => ({
          id: pl._id,
          name: pl.name,
          songIds: pl.trackIds || [],
        }));
        setPlaylists(mapped);
        localStorage.setItem('cloudtunes_playlists', JSON.stringify(mapped));
      })
      .catch(() => {
        const savedPlaylists = localStorage.getItem('cloudtunes_playlists');
        if (savedPlaylists) setPlaylists(JSON.parse(savedPlaylists));
      });

    // 3. Fetch History
    fetch('/api/history')
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: RecentlyPlayed[]) => {
        setRecentlyPlayed(data);
        localStorage.setItem('cloudtunes_recently_played', JSON.stringify(data));
      })
      .catch(() => {
        const savedHistory = localStorage.getItem('cloudtunes_recently_played');
        if (savedHistory) setRecentlyPlayed(JSON.parse(savedHistory));
      });
  }, []);

  // Save to LocalStorage helpers

  const saveHistory = (newHistory: RecentlyPlayed[]) => {
    setRecentlyPlayed(newHistory);
    localStorage.setItem('cloudtunes_recently_played', JSON.stringify(newHistory));
  };

  // Wire up audio engine callbacks
  const handleTrackEndedRef = useRef<() => void>(() => {});
  const handlePlaybackFailedRef = useRef<() => void>(() => {});

  useEffect(() => {
    audioEngine.onPlayStatusChange = (status) => {
      setIsPlaying(status);
    };

    let lastSavedTime = 0;
    audioEngine.onTimeUpdate = (time) => {
      setCurrentTime(time);
      const now = Date.now();
      if (now - lastSavedTime > 2000) {
        localStorage.setItem('cloudtunes_current_time', time.toString());
        lastSavedTime = now;
      }
    };

    audioEngine.onDurationChange = (dur) => {
      setDuration(dur);
    };

    audioEngine.onEnded = () => {
      handleTrackEndedRef.current();
    };

    audioEngine.onPlaybackFailed = () => {
      handlePlaybackFailedRef.current();
    };

    // Initialize engine volume
    audioEngine.setVolume(volume);

    // Initial state restore inside AudioEngine
    const savedTimeStr = localStorage.getItem('cloudtunes_current_time');
    const savedTime = savedTimeStr ? parseFloat(savedTimeStr) : 0;
    if (currentTrackRef.current) {
      audioEngine.setTrack(currentTrackRef.current.url, savedTime);
    }
  }, []);

  const smartShuffle = (tracksToShuffle: Track[], current: Track | null) => {
    const historyMap = new Map<string, number>();
    recentlyPlayed.forEach((item, index) => {
      historyMap.set(item.trackId, index);
    });

    const items = [...tracksToShuffle];
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    const result: Track[] = [];
    let lastArtist = current?.artist || '';

    while (items.length > 0) {
      let bestIdx = 0;
      let bestScore = -Infinity;
      const searchWindow = Math.min(5, items.length);
      for (let k = 0; k < searchWindow; k++) {
        const item = items[k];
        let score = Math.random() * 10;
        if (item.artist === lastArtist) {
          score -= 15;
        }
        const historyIndex = historyMap.get(item.id);
        if (historyIndex === undefined) {
          score += 5;
        } else {
          score += (historyIndex / (recentlyPlayed.length || 1)) * 3;
        }
        if (score > bestScore) {
          bestScore = score;
          bestIdx = k;
        }
      }
      const selected = items.splice(bestIdx, 1)[0];
      result.push(selected);
      lastArtist = selected.artist;
    }
    return result;
  };

  const playTrack = (track: Track, contextTracks?: Track[]) => {
    let newQueue = contextTracks ? [...contextTracks] : [...tracks];
    if (newQueue.length === 0) {
      newQueue = [track];
    }
    
    // Ensure target track is present in new queue
    let targetIndex = newQueue.findIndex((t) => t.id === track.id);
    if (targetIndex === -1) {
      newQueue.unshift(track);
      targetIndex = 0;
    }

    if (isShuffle) {
      setOriginalQueue(newQueue);
      if (newQueue.length > 1) {
        const remaining = newQueue.filter((_, idx) => idx !== targetIndex);
        const shuffledRemaining = smartShuffle(remaining, track);
        newQueue = [track, ...shuffledRemaining];
        targetIndex = 0;
      }
    }

    setQueue(newQueue);
    setQueueIndex(targetIndex);
    setCurrentTrack(track);
    setCurrentTime(0);

    audioEngine.setTrack(track.url);
    audioEngine.play();

    // Update Recently Played
    const updatedHistory = [...recentlyPlayed];
    const historyIndex = updatedHistory.findIndex((h) => h.trackId === track.id);
    if (historyIndex > -1) {
      updatedHistory[historyIndex] = {
        trackId: track.id,
        lastPlayed: new Date().toISOString(),
        playCount: updatedHistory[historyIndex].playCount + 1,
      };
    } else {
      updatedHistory.unshift({
        trackId: track.id,
        lastPlayed: new Date().toISOString(),
        playCount: 1,
      });
    }
    saveHistory(updatedHistory);

    // Sync play history with server
    fetch(`/api/history/${track.id}`, { method: 'POST' }).catch((err) =>
      console.error('Failed to record track play on server:', err)
    );
  };

  const togglePlay = () => {
    if (!currentTrack && tracks.length > 0) {
      playTrack(tracks[0]);
      return;
    }
    if (isPlaying) {
      audioEngine.pause();
    } else {
      audioEngine.play();
    }
  };

  const seek = React.useCallback((seconds: number) => {
    setCurrentTime(seconds);
    audioEngine.seek(seconds);
  }, []);

  const nextTrack = React.useCallback(() => {
    const currentQueue = queueRef.current;
    const currentIdx = queueIndexRef.current;
    const currentRepeat = repeatModeRef.current;

    if (currentQueue.length === 0) return;

    const nextIndex = currentIdx + 1;
    if (nextIndex < currentQueue.length) {
      const target = currentQueue[nextIndex];
      setQueueIndex(nextIndex);
      setCurrentTrack(target);
      setCurrentTime(0);
      audioEngine.setTrack(target.url);
      audioEngine.play();
    } else if (currentRepeat === 'all') {
      const target = currentQueue[0];
      setQueueIndex(0);
      setCurrentTrack(target);
      setCurrentTime(0);
      audioEngine.setTrack(target.url);
      audioEngine.play();
    } else {
      setIsPlaying(false);
      audioEngine.pause();
    }
  }, []);

  const prevTrack = React.useCallback(() => {
    const currentQueue = queueRef.current;
    const currentIdx = queueIndexRef.current;
    const currentRepeat = repeatModeRef.current;

    if (currentTimeRef.current > 5) {
      seek(0);
      return;
    }

    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
      const target = currentQueue[prevIdx];
      setQueueIndex(prevIdx);
      setCurrentTrack(target);
      setCurrentTime(0);
      audioEngine.setTrack(target.url);
      audioEngine.play();
    } else if (currentQueue.length > 0 && currentRepeat === 'all') {
      const lastIdx = currentQueue.length - 1;
      const target = currentQueue[lastIdx];
      setQueueIndex(lastIdx);
      setCurrentTrack(target);
      setCurrentTime(0);
      audioEngine.setTrack(target.url);
      audioEngine.play();
    } else {
      seek(0);
    }
  }, [seek]);

  useEffect(() => {
    handleTrackEndedRef.current = () => {
      if (repeatModeRef.current === 'one') {
        audioEngine.seek(0);
        audioEngine.play();
      } else {
        nextTrack();
      }
    };
  }, [nextTrack]);

  useEffect(() => {
    handlePlaybackFailedRef.current = () => {
      nextTrack();
    };
  }, [nextTrack]);

  const setVolume = (vol: number) => {
    const boundVol = Math.max(0, Math.min(1, vol));
    setVolumeState(boundVol);
    audioEngine.setVolume(boundVol);
  };

  const toggleShuffle = () => {
    if (!isShuffle) {
      // Turn Shuffle ON
      setOriginalQueue([...queue]);
      if (queue.length > 1) {
        const remaining = queue.filter((_, idx) => idx !== queueIndex);
        const shuffledRemaining = smartShuffle(remaining, currentTrack);
        const newQueue = currentTrack ? [currentTrack, ...shuffledRemaining] : shuffledRemaining;
        setQueue(newQueue);
        setQueueIndex(0);
      }
      setIsShuffle(true);
    } else {
      // Turn Shuffle OFF
      if (originalQueue.length > 0) {
        setQueue(originalQueue);
        if (currentTrack) {
          const origIdx = originalQueue.findIndex((t) => t.id === currentTrack.id);
          setQueueIndex(origIdx !== -1 ? origIdx : 0);
        }
      }
      setIsShuffle(false);
    }
  };

  const setEffectMode = (mode: EffectMode) => {
    setEffectModeState(mode);
    audioEngine.setEffectMode(mode);
  };

  const updateSpatialSettings = (settings: Partial<SpatialSettings>) => {
    setSpatialSettingsState((prev) => {
      const next = { ...prev, ...settings };
      audioEngine.updateSpatialSettings(next);
      return next;
    });
  };

  // Queue Operations
  const addToQueue = (track: Track) => {
    setQueue((prev) => [...prev, track]);
    if (isShuffle) {
      setOriginalQueue((prev) => [...prev, track]);
    }
    if (queueIndex === -1) {
      setQueueIndex(0);
      setCurrentTrack(track);
      audioEngine.setTrack(track.url);
    }
  };

  const removeFromQueue = (trackId: string) => {
    if (isShuffle) {
      setOriginalQueue((prev) => prev.filter((t) => t.id !== trackId));
    }
    setQueue((prev) => {
      const idx = prev.findIndex((t) => t.id === trackId);
      if (idx === -1) return prev;
      const nextQueue = prev.filter((t) => t.id !== trackId);
      if (idx === queueIndex) {
        if (nextQueue.length > 0) {
          const nextIdx = idx >= nextQueue.length ? nextQueue.length - 1 : idx;
          setQueueIndex(nextIdx);
          const nextTrackItem = nextQueue[nextIdx];
          setCurrentTrack(nextTrackItem);
          audioEngine.setTrack(nextTrackItem.url);
          if (isPlaying) {
            audioEngine.play();
          }
        } else {
          setQueueIndex(-1);
          setCurrentTrack(null);
          setIsPlaying(false);
        }
      } else if (idx < queueIndex) {
        setQueueIndex(queueIndex - 1);
      }
      return nextQueue;
    });
  };

  const playNext = (track: Track) => {
    if (queue.length === 0) {
      playTrack(track);
      return;
    }
    const filteredQueue = queue.filter((t) => t.id !== track.id);
    const newIdx = queueIndex >= filteredQueue.length ? filteredQueue.length - 1 : queueIndex;

    const newQueue = [...filteredQueue];
    newQueue.splice(newIdx + 1, 0, track);
    setQueue(newQueue);
    setQueueIndex(newIdx);

    if (isShuffle) {
      setOriginalQueue((prev) => {
        const filtered = prev.filter((t) => t.id !== track.id);
        const origCurrentIdx = currentTrack ? filtered.findIndex((t) => t.id === currentTrack.id) : -1;
        const insertIdx = origCurrentIdx >= 0 ? origCurrentIdx : 0;
        const copy = [...filtered];
        copy.splice(insertIdx + 1, 0, track);
        return copy;
      });
    }
  };

  const clearQueue = () => {
    audioEngine.stop();
    setQueue([]);
    setQueueIndex(-1);
    setCurrentTrack(null);
    setIsPlaying(false);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  };

  // Favorites & Playlists
  const toggleFavorite = async (trackId: string) => {
    const isFav = favorites.includes(trackId);
    let nextFavs: string[];
    if (isFav) {
      nextFavs = favorites.filter((id) => id !== trackId);
    } else {
      nextFavs = [...favorites, trackId];
    }
    setFavorites(nextFavs);
    localStorage.setItem('cloudtunes_favorites', JSON.stringify(nextFavs));

    try {
      await fetch(`/api/favorites/${trackId}`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to toggle favorite on server:', err);
    }
  };

  const createPlaylist = async (name: string) => {
    const tempId = 'temp_' + Date.now();
    const newPlaylist: Playlist = {
      id: tempId,
      name,
      songIds: [],
    };
    const nextPlaylists = [...playlists, newPlaylist];
    setPlaylists(nextPlaylists);
    localStorage.setItem('cloudtunes_playlists', JSON.stringify(nextPlaylists));

    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const serverPlaylist = await res.json();
        const updated = nextPlaylists.map((p) =>
          p.id === tempId
            ? { id: serverPlaylist._id, name: serverPlaylist.name, songIds: serverPlaylist.trackIds || [] }
            : p
        );
        setPlaylists(updated);
        localStorage.setItem('cloudtunes_playlists', JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Failed to create playlist on server:', err);
    }
  };

  const deletePlaylist = async (playlistId: string) => {
    const nextPlaylists = playlists.filter((p) => p.id !== playlistId);
    setPlaylists(nextPlaylists);
    localStorage.setItem('cloudtunes_playlists', JSON.stringify(nextPlaylists));

    try {
      await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete playlist on server:', err);
    }
  };

  const addTrackToPlaylist = async (playlistId: string, trackId: string) => {
    const nextPlaylists = playlists.map((p) => {
      if (p.id === playlistId) {
        if (p.songIds.includes(trackId)) return p;
        return { ...p, songIds: [...p.songIds, trackId] };
      }
      return p;
    });
    setPlaylists(nextPlaylists);
    localStorage.setItem('cloudtunes_playlists', JSON.stringify(nextPlaylists));

    try {
      await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId }),
      });
    } catch (err) {
      console.error('Failed to add track to playlist on server:', err);
    }
  };

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    const nextPlaylists = playlists.map((p) => {
      if (p.id === playlistId) {
        return { ...p, songIds: p.songIds.filter((id) => id !== trackId) };
      }
      return p;
    });
    setPlaylists(nextPlaylists);
    localStorage.setItem('cloudtunes_playlists', JSON.stringify(nextPlaylists));

    try {
      await fetch(`/api/playlists/${playlistId}/tracks/${trackId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to remove track from playlist on server:', err);
    }
  };

  // Keep action references updated for the Media Session listeners
  const handlersRef = useRef<{ nextTrack?: () => void; prevTrack?: () => void; seek?: (s: number) => void }>({});
  useEffect(() => {
    handlersRef.current = { nextTrack, prevTrack, seek };
  }, [nextTrack, prevTrack, seek]);

  // 1. Sync Media Session Metadata when track changes
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        artwork: [
          { src: currentTrack.cover, sizes: '96x96', type: 'image/png' },
          { src: currentTrack.cover, sizes: '128x128', type: 'image/png' },
          { src: currentTrack.cover, sizes: '192x192', type: 'image/png' },
          { src: currentTrack.cover, sizes: '256x256', type: 'image/png' },
          { src: currentTrack.cover, sizes: '384x384', type: 'image/png' },
          { src: currentTrack.cover, sizes: '512x512', type: 'image/png' },
        ],
      });
    }
  }, [currentTrack]);

  // 2. Sync Playback State
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // 3. Sync Position State
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: 1.0,
          position: currentTime,
        });
      } catch (err) {
        console.warn('Failed to set media session position:', err);
      }
    }
  }, [currentTime, duration, currentTrack]);

  // 4. Setup Media Session Action Handlers
  useEffect(() => {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          audioEngine.play();
          setIsPlaying(true);
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          audioEngine.pause();
          setIsPlaying(false);
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          handlersRef.current.prevTrack?.();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          handlersRef.current.nextTrack?.();
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined) {
            handlersRef.current.seek?.(details.seekTime);
          }
        });
      } catch (err) {
        console.warn('Failed to attach Media Session handlers:', err);
      }
    }
  }, []);

  return (
    <MusicPlayerContext.Provider
      value={{
        tracks,
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        queue,
        queueIndex,
        playlists,
        favorites,
        recentlyPlayed,
        repeatMode,
        isShuffle,
        effectMode,
        spatialSettings,
        theme,
        setTheme,
        playTrack,
        togglePlay,
        nextTrack,
        prevTrack,
        seek,
        setVolume,
        setRepeatMode,
        toggleShuffle,
        setEffectMode,
        updateSpatialSettings,
        addToQueue,
        removeFromQueue,
        playNext,
        clearQueue,
        setQueue,
        toggleFavorite,
        createPlaylist,
        deletePlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        isSyncing,
        syncLibrary,
        hasMoreSongs,
        isLoadingSongs,
        loadMoreSongs,
      }}
    >
      {children}
    </MusicPlayerContext.Provider>
  );
};

export const useMusicPlayer = () => {
  const context = useContext(MusicPlayerContext);
  if (context === undefined) {
    throw new Error('useMusicPlayer must be used within a MusicPlayerProvider');
  }
  return context;
};
export default MusicPlayerContext;

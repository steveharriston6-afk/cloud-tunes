import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { MouseEvent } from 'react';
import type { Track } from '../context/MusicPlayerContext';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { 
  Play, 
  Heart, 
  Trash2, 
  Clock, 
  Music, 
  MoreVertical,
  ListPlus,
  PlayCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { TrackCover } from './TrackCover';
import { ArtistAvatar } from './ArtistAvatar';
import DspSettings from './DspSettings';
import { SyncDashboard } from './SyncDashboard';
import { searchEngine } from '../utils/SearchEngine';
import { VirtualizedGrid } from './VirtualizedGrid';
import { VirtualizedList } from './VirtualizedList';
import { PremiumMusicCard, getAudioSpecs } from './PremiumMusicCard';

interface LibraryViewsProps {
  currentView: string;
  setCurrentView: (view: string, albumId?: string | null, artistId?: string | null) => void;
  selectedAlbum: string | null;
  setSelectedAlbum: (album: string | null) => void;
  selectedArtist: string | null;
  setSelectedArtist: (artist: string | null) => void;
  searchQuery: string;
  onBack?: () => void;
  canGoBack?: boolean;
  isTV?: boolean;
}

export const LibraryViews = ({
  currentView,
  setCurrentView,
  selectedAlbum,
  setSelectedAlbum,
  selectedArtist,
  setSelectedArtist,
  searchQuery,
  onBack,
  canGoBack,
  isTV = false
}: LibraryViewsProps) => {
  const {
    tracks,
    currentTrack,
    isPlaying,
    favorites,
    playlists,
    recentlyPlayed,
    playTrack,
    toggleFavorite,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    deletePlaylist,
    playNext,
    addToQueue,
    isSyncing,
    syncLibrary,
    hasMoreSongs,
    isLoadingSongs,
    loadMoreSongs,
  } = useMusicPlayer();

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('recentlyAdded');
  const [filterBy, setFilterBy] = useState<string>('all');
  const recentlyAddedRef = useRef<HTMLDivElement>(null);
  const continueListeningRef = useRef<HTMLDivElement>(null);
  const hiResRef = useRef<HTMLDivElement>(null);
  const losslessRef = useRef<HTMLDivElement>(null);
  const recommendedRef = useRef<HTMLDivElement>(null);

  // Helper: Format duration (seconds to mm:ss)
  const formatDuration = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Helper: Get tracks matching search query (uses SearchEngine for ranked multi-field matching)
  const getFilteredTracks = (tracksList: Track[]) => {
    if (!searchQuery.trim()) return tracksList;
    return searchEngine.filterTracks(tracksList, searchQuery);
  };

  // Dropdown helper
  const toggleDropdown = (trackId: string, e: MouseEvent) => {
    e.stopPropagation();
    setActiveDropdown(activeDropdown === trackId ? null : trackId);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const closeDropdowns = () => setActiveDropdown(null);
    window.addEventListener('click', closeDropdowns);
    return () => window.removeEventListener('click', closeDropdowns);
  }, []);

  // Local states for paginated lists
  const [artistsList, setArtistsList] = useState<any[]>([]);
  const [artistsCursor, setArtistsCursor] = useState<string | null>(null);
  const [hasMoreArtists, setHasMoreArtists] = useState(true);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);

  const [albumsList, setAlbumsList] = useState<any[]>([]);
  const [albumsCursor, setAlbumsCursor] = useState<string | null>(null);
  const [hasMoreAlbums, setHasMoreAlbums] = useState(true);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(false);

  const [detailTracks, setDetailTracks] = useState<Track[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [favoritesTracks, setFavoritesTracks] = useState<Track[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);

  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);

  const artistsLoaderRef = useRef<HTMLDivElement>(null);
  const albumsLoaderRef = useRef<HTMLDivElement>(null);
  const songsLoaderRef = useRef<HTMLDivElement>(null);

  // Refs for infinite scroll — IntersectionObserver callback always reads these
  const loadMoreArtistsRef = useRef<() => void>(() => {});
  const loadMoreAlbumsRef = useRef<() => void>(() => {});
  const loadMoreSongsRef = useRef<() => void>(() => {});
  const hasMoreArtistsRef = useRef(true);
  const hasMoreAlbumsRef = useRef(true);
  const hasMoreSongsRef = useRef(true);
  const artistsCursorRef = useRef<string | null>(null);
  const albumsCursorRef = useRef<string | null>(null);
  const isLoadingArtistsRef = useRef(false);
  const isLoadingAlbumsRef = useRef(false);

  // Re-observe the sentinel so the IntersectionObserver fires immediately
  // if the sentinel is still visible after loading more items.
  const reobserveArtists = useCallback(() => {
    const obs = artistsObserverRef.current;
    const el = artistsLoaderRef.current;
    if (obs && el) {
      obs.unobserve(el);
      obs.observe(el);
    }
  }, []);

  const reobserveAlbums = useCallback(() => {
    const obs = albumsObserverRef.current;
    const el = albumsLoaderRef.current;
    if (obs && el) {
      obs.unobserve(el);
      obs.observe(el);
    }
  }, []);

  const loadMoreArtists = useCallback(() => {
    if (isLoadingArtistsRef.current || !hasMoreArtistsRef.current || !artistsCursorRef.current) return;
    setIsLoadingArtists(true);
    fetch(`/api/artists?limit=20&cursor=${artistsCursorRef.current}&search=${encodeURIComponent(searchQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        setArtistsList((prev) => [...prev, ...(data.artists || [])]);
        setArtistsCursor(data.nextCursor);
        setHasMoreArtists(!!data.nextCursor);
      })
      .catch((err) => console.error('Failed to load more artists:', err))
      .finally(() => {
        setIsLoadingArtists(false);
        reobserveArtists();
      });
  }, [searchQuery, reobserveArtists]);

  const loadMoreAlbums = useCallback(() => {
    if (isLoadingAlbumsRef.current || !hasMoreAlbumsRef.current || !albumsCursorRef.current) return;
    setIsLoadingAlbums(true);
    fetch(`/api/albums?limit=20&cursor=${albumsCursorRef.current}&search=${encodeURIComponent(searchQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        setAlbumsList((prev) => [...prev, ...(data.albums || [])]);
        setAlbumsCursor(data.nextCursor);
        setHasMoreAlbums(!!data.nextCursor);
      })
      .catch((err) => console.error('Failed to load more albums:', err))
      .finally(() => {
        setIsLoadingAlbums(false);
        reobserveAlbums();
      });
  }, [searchQuery, reobserveAlbums]);

  // Keep refs in sync with state — observer uses these exclusively
  useEffect(() => { loadMoreArtistsRef.current = loadMoreArtists; }, [loadMoreArtists]);
  useEffect(() => { loadMoreAlbumsRef.current = loadMoreAlbums; }, [loadMoreAlbums]);
  useEffect(() => { hasMoreArtistsRef.current = hasMoreArtists; }, [hasMoreArtists]);
  useEffect(() => { hasMoreAlbumsRef.current = hasMoreAlbums; }, [hasMoreAlbums]);
  useEffect(() => { artistsCursorRef.current = artistsCursor; }, [artistsCursor]);
  useEffect(() => { albumsCursorRef.current = albumsCursor; }, [albumsCursor]);
  useEffect(() => { isLoadingArtistsRef.current = isLoadingArtists; }, [isLoadingArtists]);
  useEffect(() => { isLoadingAlbumsRef.current = isLoadingAlbums; }, [isLoadingAlbums]);
  useEffect(() => { loadMoreSongsRef.current = loadMoreSongs; }, [loadMoreSongs]);
  useEffect(() => { hasMoreSongsRef.current = hasMoreSongs; }, [hasMoreSongs]);

  // Fetch initial artists
  useEffect(() => {
    if (currentView === 'artists') {
      setIsLoadingArtists(true);
      fetch(`/api/artists?limit=20&search=${encodeURIComponent(searchQuery)}`)
        .then((res) => res.json())
        .then((data) => {
          setArtistsList(data.artists || []);
          setArtistsCursor(data.nextCursor);
          setHasMoreArtists(!!data.nextCursor);
        })
        .catch((err) => console.error('Failed to load artists:', err))
        .finally(() => setIsLoadingArtists(false));
    }
  }, [currentView, searchQuery]);

  // Fetch initial albums
  useEffect(() => {
    if (currentView === 'albums') {
      setIsLoadingAlbums(true);
      fetch(`/api/albums?limit=20&search=${encodeURIComponent(searchQuery)}`)
        .then((res) => res.json())
        .then((data) => {
          setAlbumsList(data.albums || []);
          setAlbumsCursor(data.nextCursor);
          setHasMoreAlbums(!!data.nextCursor);
        })
        .catch((err) => console.error('Failed to load albums:', err))
        .finally(() => setIsLoadingAlbums(false));
    }
  }, [currentView, searchQuery]);

  // Load tracks for Album detail view
  useEffect(() => {
    if (currentView === 'album-detail' && selectedAlbum) {
      setIsLoadingDetail(true);
      fetch(`/api/songs?album=${encodeURIComponent(selectedAlbum)}&limit=1000`)
        .then((res) => res.json())
        .then((data) => {
          setDetailTracks(data.tracks || []);
        })
        .catch((err) => console.error('Failed to load album tracks:', err))
        .finally(() => setIsLoadingDetail(false));
    }
  }, [currentView, selectedAlbum]);

  // Load tracks for Artist detail view
  useEffect(() => {
    if (currentView === 'artist-detail' && selectedArtist) {
      setIsLoadingDetail(true);
      fetch(`/api/songs?artist=${encodeURIComponent(selectedArtist)}&limit=1000`)
        .then((res) => res.json())
        .then((data) => {
          setDetailTracks(data.tracks || []);
        })
        .catch((err) => console.error('Failed to load artist tracks:', err))
        .finally(() => setIsLoadingDetail(false));
    }
  }, [currentView, selectedArtist]);

  // Fetch favorites tracks
  useEffect(() => {
    if (currentView === 'favorites') {
      if (favorites.length === 0) {
        setFavoritesTracks([]);
        return;
      }
      setIsLoadingFavorites(true);
      fetch(`/api/songs?ids=${favorites.join(',')}&limit=1000`)
        .then((res) => res.json())
        .then((data) => {
          setFavoritesTracks(data.tracks || []);
        })
        .catch((err) => console.error('Failed to load favorites tracks:', err))
        .finally(() => setIsLoadingFavorites(false));
    }
  }, [currentView, favorites]);

  // Fetch playlist tracks
  useEffect(() => {
    if (currentView.startsWith('playlist-')) {
      const plId = currentView.replace('playlist-', '');
      const playlist = playlists.find((p) => p.id === plId);
      if (!playlist || !playlist.songIds || playlist.songIds.length === 0) {
        setPlaylistTracks([]);
        return;
      }
      setIsLoadingPlaylist(true);
      fetch(`/api/songs?ids=${playlist.songIds.join(',')}&limit=1000`)
        .then((res) => res.json())
        .then((data) => {
          setPlaylistTracks(data.tracks || []);
        })
        .catch((err) => console.error('Failed to load playlist tracks:', err))
        .finally(() => setIsLoadingPlaylist(false));
    }
  }, [currentView, playlists]);

  // Stable IntersectionObserver — created once per mount, never recreated for state changes.
  // Callback goes through refs so it always has the latest state.
  const artistsObserverRef = useRef<IntersectionObserver | null>(null);
  const albumsObserverRef = useRef<IntersectionObserver | null>(null);

  // Set up or tear down the artists observer whenever view / sentinel availability changes
  useEffect(() => {
    // Disconnect previous observer
    artistsObserverRef.current?.disconnect();
    artistsObserverRef.current = null;

    if (currentView !== 'artists') return;

    const loaderEl = artistsLoaderRef.current;
    if (!loaderEl) return;

    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMoreArtistsRef.current) {
        loadMoreArtistsRef.current();
      }
    }, { threshold: 0.1 });
    obs.observe(loaderEl);
    artistsObserverRef.current = obs;

    return () => {
      obs.disconnect();
      if (artistsObserverRef.current === obs) artistsObserverRef.current = null;
    };
    // Recreate observer only when sentinel DOM element changes or view changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, artistsLoaderRef.current]);

  // Same for albums
  useEffect(() => {
    albumsObserverRef.current?.disconnect();
    albumsObserverRef.current = null;

    if (currentView !== 'albums') return;

    const loaderEl = albumsLoaderRef.current;
    if (!loaderEl) return;

    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMoreAlbumsRef.current) {
        loadMoreAlbumsRef.current();
      }
    }, { threshold: 0.1 });
    obs.observe(loaderEl);
    albumsObserverRef.current = obs;

    return () => {
      obs.disconnect();
      if (albumsObserverRef.current === obs) albumsObserverRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, albumsLoaderRef.current]);

  // Songs infinite scroll observer (always active when on home view)
  const songsObserverRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    songsObserverRef.current?.disconnect();
    songsObserverRef.current = null;

    if (currentView !== 'home') return;

    const loaderEl = songsLoaderRef.current;
    if (!loaderEl) return;

    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMoreSongsRef.current) {
        loadMoreSongsRef.current();
      }
    }, { threshold: 0.1 });
    obs.observe(loaderEl);
    songsObserverRef.current = obs;

    return () => {
      obs.disconnect();
      if (songsObserverRef.current === obs) songsObserverRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, songsLoaderRef.current]);


  // Unified library filtering and sorting logic
  const processedTracks = useMemo(() => {
    let result = getFilteredTracks(tracks);

    // Apply Filters
    if (filterBy === 'lossless') {
      result = result.filter(t => ['FLAC', 'ALAC', 'WAV'].includes(t.format.toUpperCase()));
    } else if (filterBy === 'hires') {
      result = result.filter(t => {
        const isLossless = ['FLAC', 'ALAC', 'WAV'].includes(t.format.toUpperCase());
        const detailsLower = t.details.toLowerCase();
        return isLossless && (detailsLower.includes('24-bit') || detailsLower.includes('96khz') || detailsLower.includes('192khz'));
      });
    } else if (filterBy === 'favorites') {
      result = result.filter(t => favorites.includes(t.id));
    } else if (filterBy === 'downloaded') {
      result = result.filter(t => !t.isCloud);
    }

    // Apply Sorting
    if (sortBy === 'recentlyAdded') {
      // Reverse array order to show newest added tracks first
      result = [...result].reverse();
    } else if (sortBy === 'recentlyPlayed') {
      const rpMap = new Map(recentlyPlayed.map(rp => [rp.trackId, rp.lastPlayed]));
      result = [...result].sort((a, b) => {
        const dateA = rpMap.get(a.id) || '';
        const dateB = rpMap.get(b.id) || '';
        if (dateA && dateB) return dateB.localeCompare(dateA);
        if (dateA) return -1;
        if (dateB) return 1;
        return a.title.localeCompare(b.title);
      });
    } else if (sortBy === 'mostPlayed') {
      const countMap = new Map(recentlyPlayed.map(rp => [rp.trackId, rp.playCount]));
      result = [...result].sort((a, b) => {
        const countA = countMap.get(a.id) || 0;
        const countB = countMap.get(b.id) || 0;
        if (countA !== countB) return countB - countA;
        return a.title.localeCompare(b.title);
      });
    } else if (sortBy === 'name') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'artist') {
      result = [...result].sort((a, b) => a.artist.localeCompare(b.artist));
    } else if (sortBy === 'album') {
      result = [...result].sort((a, b) => a.album.localeCompare(b.album));
    } else if (sortBy === 'duration') {
      result = [...result].sort((a, b) => b.duration - a.duration);
    } else if (sortBy === 'quality') {
      const getQualityScore = (track: Track) => {
        const isLossless = ['FLAC', 'ALAC', 'WAV'].includes(track.format.toUpperCase());
        const detailsLower = track.details.toLowerCase();
        const isHiRes = isLossless && (detailsLower.includes('24-bit') || detailsLower.includes('96khz') || detailsLower.includes('192khz'));
        if (isHiRes) return 3;
        if (isLossless) return 2;
        return 1;
      };
      result = [...result].sort((a, b) => getQualityScore(b) - getQualityScore(a));
    }

    return result;
  }, [tracks, sortBy, filterBy, searchQuery, favorites, recentlyPlayed]);

  // VIEW: LISTEN NOW (HOME)
  const renderCarousel = (
    title: string,
    items: Track[],
    scrollRef: React.RefObject<HTMLDivElement | null>,
    allTracksList: Track[]
  ) => {
    if (items.length === 0) return null;

    const scroll = (direction: 'left' | 'right') => {
      const container = scrollRef.current;
      if (container) {
        const scrollAmount = direction === 'left' ? -container.clientWidth * 0.8 : container.clientWidth * 0.8;
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    };

    return (
      <div className="space-y-3 group/carousel relative">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-text-main">{title}</h2>
          
          <div className="flex gap-1.5 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300">
            <button
              onClick={() => scroll('left')}
              className="w-7 h-7 rounded-full bg-hover-bg hover:bg-active-bg text-text-muted hover:text-text-main flex items-center justify-center transition-all cursor-pointer focus:outline-none focus-visible:outline-primary"
              title="Scroll Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-7 h-7 rounded-full bg-hover-bg hover:bg-active-bg text-text-muted hover:text-text-main flex items-center justify-center transition-all cursor-pointer focus:outline-none focus-visible:outline-primary"
              title="Scroll Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="premium-carousel flex gap-4 overflow-x-auto pb-3 scroll-smooth snap-x snap-mandatory"
        >
          {items.map((track) => (
            <div key={`carousel-${title}-${track.id}`} className="w-[160px] md:w-[180px] flex-shrink-0 snap-start">
              <PremiumMusicCard track={track} allTracks={allTracksList} isTV={isTV} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  // VIEW: LISTEN NOW (HOME)
  const renderHome = () => {
    const greeting = (() => {
      const hrs = new Date().getHours();
      if (hrs < 12) return 'Good morning';
      if (hrs < 18) return 'Good afternoon';
      return 'Good evening';
    })();

    // 1. Recently Added (first 12 tracks)
    const recentlyAddedTracks = tracks.slice(0, 12);

    // 2. Continue Listening (Recently Played Tracks)
    const recentlyPlayedTracks = [...recentlyPlayed]
      .sort((a, b) => new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime())
      .map(rp => tracks.find(t => t.id === rp.trackId))
      .filter((t): t is Track => !!t)
      .slice(0, 12);

    // 3. Hi-Res Tracks
    const hiResTracks = tracks.filter(t => {
      const isLossless = ['FLAC', 'ALAC', 'WAV'].includes(t.format.toUpperCase());
      const detailsLower = t.details.toLowerCase();
      return isLossless && (
        detailsLower.includes('24-bit') || 
        detailsLower.includes('96khz') || 
        detailsLower.includes('192khz') ||
        detailsLower.includes('96000 hz') ||
        detailsLower.includes('192000 hz')
      );
    }).slice(0, 12);

    // 4. Lossless Tracks
    const losslessTracks = tracks.filter(t => ['FLAC', 'ALAC', 'WAV'].includes(t.format.toUpperCase())).slice(0, 12);

    // 5. Recommended (Favorites or fallback to reversed tracks)
    const favoriteTracks = tracks.filter(t => favorites.includes(t.id)).slice(0, 12);
    const recommendedTracks = favoriteTracks.length > 0 ? favoriteTracks : tracks.slice().reverse().slice(0, 12);

    // Find featured track/album for Hero Section
    const featuredTrack = hiResTracks.length > 0 
      ? hiResTracks[0] 
      : (losslessTracks.length > 0 ? losslessTracks[0] : (tracks.length > 0 ? tracks[0] : null));

    const renderHero = () => {
      if (!featuredTrack) return null;

      const albumTracks = tracks.filter(t => t.album === featuredTrack.album);

      const playFeatured = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (albumTracks.length > 0) {
          playTrack(albumTracks[0], albumTracks);
        } else {
          playTrack(featuredTrack, [featuredTrack]);
        }
      };

      const isLossless = ['FLAC', 'ALAC', 'WAV'].includes(featuredTrack.format.toUpperCase());
      const isHiRes = isLossless && (
        featuredTrack.details.toLowerCase().includes('24-bit') || 
        featuredTrack.details.toLowerCase().includes('96khz') || 
        featuredTrack.details.toLowerCase().includes('192khz') ||
        featuredTrack.details.toLowerCase().includes('96000 hz') ||
        featuredTrack.details.toLowerCase().includes('192000 hz')
      );

      return (
        <div 
          onClick={playFeatured}
          className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-transparent p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 md:gap-8 cursor-pointer group shadow-2xl transition-all duration-500 hover:scale-[1.01] hover:border-white/10"
        >
          {/* Blurred artwork background */}
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none filter blur-3xl scale-125 overflow-hidden">
            <TrackCover 
              src={featuredTrack.cover} 
              title={featuredTrack.title} 
              artist={featuredTrack.artist}
              className="w-full h-full object-cover" 
            />
          </div>

          {/* Left / Top: Artwork */}
          <div className="relative z-10 w-40 h-40 md:w-48 md:h-48 rounded-xl overflow-hidden shadow-2xl flex-shrink-0 border border-white/[0.06]">
            <TrackCover 
              src={featuredTrack.cover} 
              title={featuredTrack.title} 
              artist={featuredTrack.artist}
              album={featuredTrack.album}
              format={featuredTrack.format}
              details={featuredTrack.details}
              className="w-full h-full object-cover" 
            />
            {/* Play Button Overlay */}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <Play className="w-12 h-12 text-white fill-current" />
            </div>
          </div>

          {/* Right / Bottom: Info & Action */}
          <div className="relative z-10 flex-1 flex flex-col items-center md:items-start text-center md:text-left justify-center min-w-0">
            <span className="text-[10px] md:text-xs font-black tracking-widest text-primary uppercase mb-2">
              Featured Album
            </span>
            <h2 className="text-xl md:text-3xl font-display font-extrabold text-text-main line-clamp-1 group-hover:text-primary transition-colors">
              {featuredTrack.album || "Unknown Album"}
            </h2>
            <p className="text-xs md:text-sm text-text-muted mt-1 font-semibold">
              {featuredTrack.artist || "Unknown Artist"}
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3">
              {isHiRes ? (
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-[#F59E0B] text-neutral-950 uppercase tracking-wider shadow-sm">
                  Hi-Res Audio
                </span>
              ) : isLossless ? (
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-[#10B981] text-neutral-950 uppercase tracking-wider shadow-sm">
                  Lossless
                </span>
              ) : null}
              <span className="text-[10px] text-text-dim font-medium">
                {getAudioSpecs(featuredTrack)}
              </span>
            </div>

            <button
              onClick={playFeatured}
              className="mt-5 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all duration-300 flex items-center gap-2 border border-white/[0.08] backdrop-blur-md shadow-lg"
            >
              <Play className="w-4 h-4 fill-current" /> Play Album
            </button>
          </div>
        </div>
      );
    };

    const visibleTracks = processedTracks;

    return (
      <div className="space-y-10 pb-24 text-left">
        {/* Welcome Section */}
        <div className="py-2 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-extrabold tracking-tight text-gradient">
              {greeting}
            </h1>
            <p className="text-xs text-text-muted mt-1 font-medium font-sans">Welcome back to CloudTunes.</p>
          </div>
          <button
            onClick={() => syncLibrary()}
            disabled={isSyncing}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-md transition-all ${
              isSyncing 
                ? 'bg-hover-bg text-text-dim cursor-not-allowed'
                : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 cursor-pointer'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Library'}
          </button>
        </div>

        {/* Hero Banner */}
        {renderHero()}

        {/* Horizontal Carousels */}
        {renderCarousel('Recently Added', recentlyAddedTracks, recentlyAddedRef, tracks)}
        {renderCarousel('Continue Listening', recentlyPlayedTracks, continueListeningRef, tracks)}
        {renderCarousel('Hi-Res Audio', hiResTracks, hiResRef, tracks)}
        {renderCarousel('Lossless Collection', losslessTracks, losslessRef, tracks)}
        {renderCarousel('Recommended', recommendedTracks, recommendedRef, tracks)}

        {/* Unified All Songs Toolbar and Grid */}
        <div className="space-y-4 pt-4 border-t border-panel-border/40">
          <h2 className="text-lg font-bold tracking-tight text-text-main">All Songs</h2>

          {/* Toolbar: Filters and Sorts */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-bg-subtle">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'all', label: 'All Songs' },
                { id: 'lossless', label: 'Lossless' },
                { id: 'hires', label: 'Hi-Res' },
                { id: 'favorites', label: 'Favorites' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterBy(f.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    filterBy === f.id
                      ? 'bg-primary text-white scale-[1.02]'
                      : 'bg-hover-bg text-text-muted hover:bg-active-bg hover:text-text-main'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-text-dim font-medium">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-hover-bg text-text-main rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:bg-active-bg transition-colors cursor-pointer"
              >
                <option value="recentlyAdded" className="bg-bg-dark text-text-main">Recently Added</option>
                <option value="recentlyPlayed" className="bg-bg-dark text-text-main">Recently Played</option>
                <option value="mostPlayed" className="bg-bg-dark text-text-main">Most Played</option>
                <option value="name" className="bg-bg-dark text-text-main">Song Title</option>
                <option value="artist" className="bg-bg-dark text-text-main">Artist Name</option>
                <option value="album" className="bg-bg-dark text-text-main">Album Name</option>
                <option value="duration" className="bg-bg-dark text-text-main">Duration</option>
                <option value="quality" className="bg-bg-dark text-text-main">Audio Quality</option>
              </select>
            </div>
          </div>

          {/* Unified Library count */}
          <div className="flex justify-between items-center text-xs text-text-dim px-2">
            <span>Showing {processedTracks.length} tracks</span>
          </div>

          {/* Grid of Song Cards */}
          {processedTracks.length === 0 ? (
            <div className="bg-bg-subtle p-16 rounded-xl text-center text-sm text-text-dim italic">
              No tracks found matching the current filters or search query.
            </div>
          ) : (
            <VirtualizedGrid
              items={visibleTracks}
              itemHeight={260}
              cardMode={true}
              metadataHeight={90}
              isTV={isTV}
              gap={16}
              renderItem={(track) => (
                <PremiumMusicCard
                  key={`home-card-${track.id}`}
                  track={track}
                  allTracks={processedTracks}
                  isTV={isTV}
                />
              )}
            />
          )}
          {hasMoreSongs && (
            <div ref={songsLoaderRef} className="h-10 flex items-center justify-center">
              {isLoadingSongs && (
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // VIEW: ALBUMS GRID
  const renderAlbums = () => {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold text-text-main">Albums</h1>
        {albumsList.length === 0 && !isLoadingAlbums ? (
          <p className="text-xs text-text-dim italic">No albums found matching "{searchQuery}"</p>
        ) : (
          <>
            <VirtualizedGrid
              items={albumsList}
              itemHeight={260}
              cardMode={true}
              metadataHeight={85}
              isTV={isTV}
              gap={20}
              renderItem={(album) => (
                <div
                  key={`album-grid-${album.name}`}
                  onClick={() => {
                    setSelectedAlbum(album.name);
                    setCurrentView('album-detail');
                  }}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedAlbum(album.name);
                      setCurrentView('album-detail');
                    }
                  }}
                  className="premium-card p-3 flex flex-col h-full select-none cursor-pointer group relative"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-neutral-900 border border-white/[0.04]">
                    <TrackCover 
                      src={album.coverArt ? `/api/cover/${album.coverArt}` : ''} 
                      title={album.name} 
                      artist={album.artist}
                      album={album.name}
                      alt={album.name} 
                      className="premium-card-artwork w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-left w-full">
                    <h3 className="text-xs font-semibold text-text-main truncate group-hover:text-primary transition-colors">{album.name}</h3>
                    <p className="text-[10px] text-text-muted truncate mt-0.5">{album.artist}</p>
                    <span className="text-[9px] text-text-dim block mt-1 font-semibold">{album.trackCount} song{album.trackCount > 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}
            />
            <div
              ref={albumsLoaderRef}
              className={`h-10 w-full flex items-center justify-center text-text-dim text-xs transition-opacity ${
                !hasMoreAlbums ? 'opacity-0 pointer-events-none' : ''
              }`}
            >
              {isLoadingAlbums ? 'Loading more albums...' : hasMoreAlbums ? 'Scroll for more' : ''}
            </div>
          </>
        )}
      </div>
    );
  };

  // VIEW: ARTISTS GRID
  const renderArtists = () => {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold text-text-main">Artists</h1>
        {artistsList.length === 0 && !isLoadingArtists ? (
          <p className="text-xs text-text-dim italic">No artists found matching "{searchQuery}"</p>
        ) : (
          <>
            <VirtualizedGrid
              items={artistsList}
              itemHeight={220}
              cardMode={true}
              metadataHeight={85}
              isTV={isTV}
              gap={20}
              renderItem={(artist) => (
                <div
                  key={`artist-grid-${artist.name}`}
                  onClick={() => {
                    setSelectedArtist(artist.name);
                    setCurrentView('artist-detail');
                  }}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedArtist(artist.name);
                      setCurrentView('artist-detail');
                    }
                  }}
                  className="premium-card p-4 text-center flex flex-col items-center justify-between h-full select-none cursor-pointer group relative overflow-hidden"
                >
                  <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden mb-3 shadow-inner border border-white/10 premium-card-artwork">
                    <ArtistAvatar 
                      name={artist.name} 
                      imageUrl={artist.coverArt ? `/api/cover/${artist.coverArt}` : undefined} 
                      size="lg" 
                      className="w-full h-full" 
                    />
                  </div>
                  <div className="w-full">
                    <h3 className="text-xs font-semibold text-text-main truncate group-hover:text-primary transition-colors max-w-full">{artist.name}</h3>
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                      <span className="text-[9px] text-text-dim font-semibold">
                        {artist.trackCount} track{artist.trackCount !== 1 ? 's' : ''}
                      </span>
                      <span className="text-text-dim/40">•</span>
                      <span className="text-[9px] text-text-dim font-semibold">
                        {artist.albumCount} album{artist.albumCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-center gap-1.5 mt-2">
                      {artist.highestQuality === 'FLAC' && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                          FLAC
                        </span>
                      )}
                      {artist.isCloud && (
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                          Cloud
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            />
            <div
              ref={artistsLoaderRef}
              className={`h-10 w-full flex items-center justify-center text-text-dim text-xs transition-opacity ${
                !hasMoreArtists ? 'opacity-0 pointer-events-none' : ''
              }`}
            >
              {isLoadingArtists ? 'Loading more artists...' : hasMoreArtists ? 'Scroll for more' : ''}
            </div>
          </>
        )}
      </div>
    );
  };

  // VIEW: ALBUM DETAIL VIEW
  const renderAlbumDetail = () => {
    let currentAlbumName = selectedAlbum;
    if (!currentAlbumName) return null;

    const albumCover = detailTracks[0]?.cover || '';
    const artistName = detailTracks[0]?.artist || '';
    const year = currentAlbumName === 'Bombay' ? '1995' : 'Recent';

    const filteredAlbumTracks = getFilteredTracks(detailTracks);

    return (
      <div className="space-y-8">
        {renderBackButton()}
        {/* Album Header */}
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-end">
          <TrackCover 
            src={albumCover} 
            title={currentAlbumName} 
            artist={artistName}
            album={currentAlbumName}
            alt={currentAlbumName} 
            className="w-48 h-48 rounded-xl shadow-lg transition-opacity hover:opacity-90 text-3xl"
          />
          <div className="flex-1 space-y-2.5 text-center sm:text-left">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Album</span>
            <h1 className="text-3xl font-display font-extrabold text-text-main tracking-tight leading-none">{selectedAlbum}</h1>
            <div className="text-xs text-text-muted space-y-1">
              <p>by <span className="font-semibold text-text-main hover:text-primary cursor-pointer" onClick={() => { setSelectedArtist(artistName); setCurrentView('artist-detail'); }}>{artistName}</span></p>
              <p>{year} • {detailTracks.length} song{detailTracks.length !== 1 ? 's' : ''} • {formatDuration(detailTracks.reduce((acc, t) => acc + t.duration, 0))}</p>
            </div>
            
            {/* Play/Shuffle Actions */}
            <div className="flex items-center gap-3 pt-2 justify-center sm:justify-start">
              <button 
                onClick={() => playTrack(detailTracks[0], detailTracks)}
                disabled={detailTracks.length === 0}
                className="px-5 py-2.5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-primary-glow/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Play
              </button>
              <button 
                onClick={() => {
                  const randomTrack = detailTracks[Math.floor(Math.random() * detailTracks.length)];
                  playTrack(randomTrack, detailTracks);
                }}
                disabled={detailTracks.length === 0}
                className="px-5 py-2.5 rounded-full bg-hover-bg hover:bg-active-bg text-text-main text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                Shuffle
              </button>
            </div>
          </div>
        </div>

        {/* Tracklist Table */}
        <div className="rounded-xl overflow-hidden bg-bg-subtle">
          {isLoadingDetail ? (
            <div className="p-8 text-center text-xs text-text-dim">Loading album tracks...</div>
          ) : (
            renderTrackTable(filteredAlbumTracks)
          )}
        </div>
      </div>
    );
  };

  // VIEW: FAVORITES
  const renderFavorites = () => {
    const filteredFavs = getFilteredTracks(favoritesTracks);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-text-main flex items-center gap-2">
            <Heart className="w-7 h-7 text-primary fill-primary" />
            Favorites
          </h1>
          <p className="text-xs text-text-dim mt-1">Tracks you heart will appear here. Stored in MongoDB.</p>
        </div>

        {isLoadingFavorites ? (
          <div className="p-10 text-center text-xs text-text-dim">Loading favorites...</div>
        ) : filteredFavs.length === 0 ? (
          <div className="bg-bg-subtle p-10 rounded-xl text-center text-sm text-text-dim italic">
            No favorited tracks yet. Click the heart icon on any song to add it!
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden bg-bg-subtle">
            {renderTrackTable(filteredFavs)}
          </div>
        )}
      </div>
    );
  };

  // VIEW: PLAYLIST DETAIL VIEW
  const renderPlaylistDetail = (playlistId: string) => {
    const playlist = playlists.find((p) => p.id === playlistId);
    if (!playlist) return null;

    const filteredPlaylistTracks = getFilteredTracks(playlistTracks);

    return (
      <div className="space-y-6">
        {renderBackButton()}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-text-main flex items-center gap-2">
              <Music className="w-6 h-6 text-primary" />
              {playlist.name}
            </h1>
            <p className="text-xs text-text-dim mt-1">
              Playlist • {playlistTracks.length} song{playlistTracks.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => {
              deletePlaylist(playlist.id);
              setCurrentView('home');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-xs font-semibold text-red-400 hover:bg-red-500/25 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Playlist
          </button>
        </div>

        {isLoadingPlaylist ? (
          <div className="p-10 text-center text-xs text-text-dim">Loading playlist...</div>
        ) : filteredPlaylistTracks.length === 0 ? (
          <div className="bg-bg-subtle p-10 rounded-xl text-center text-sm text-text-dim italic">
            This playlist is empty. Browse songs and click the triple dot menu (•••) to add them!
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden bg-bg-subtle">
            {renderTrackTable(filteredPlaylistTracks, playlist.id)}
          </div>
        )}
      </div>
    );
  };

  // REUSABLE COMPONENT: Tracklist Table
  const renderTrackTable = (trackList: Track[], playlistIdToRemoveFrom?: string) => {
    return (
      <div className="w-full text-left text-xs">
        {/* Header row */}
        <div className="flex border-b border-panel-border text-text-dim font-semibold text-[10px] tracking-wider uppercase select-none py-3 px-4 items-center">
          <div className="w-10 text-center shrink-0">#</div>
          <div className="flex-1 min-w-0 px-4">Title</div>
          <div className="w-1/4 min-w-[120px] px-4 hidden md:block shrink-0">Album</div>
          <div className="w-20 px-4 hidden sm:block shrink-0">Format</div>
          <div className="w-16 text-center shrink-0"><Clock className="w-3.5 h-3.5 mx-auto" /></div>
          <div className="w-12 shrink-0"></div>
        </div>
        
        {/* Virtualized rows */}
        <div className="relative">
          <VirtualizedList
            items={trackList}
            itemHeight={56}
            gap={0}
            renderItem={(track, index) => {
              const isCurrent = currentTrack?.id === track.id;
              const isFav = favorites.includes(track.id);

              return (
                <div
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      playTrack(track, trackList);
                    }
                  }}
                  className={`flex items-center hover:bg-hover-bg group transition-colors cursor-pointer focus:bg-active-bg focus:outline-none py-2 px-4 h-full border-b border-panel-border/20 ${
                    isCurrent ? 'bg-primary/5 text-primary' : 'text-text-main'
                  }`}
                  onClick={() => playTrack(track, trackList)}
                >
                  {/* Index / Play indicator */}
                  <div className="w-10 text-center font-medium text-text-dim group-hover:text-text-main transition-colors shrink-0">
                    <div className="relative flex items-center justify-center w-5 h-5 mx-auto">
                      {isCurrent && isPlaying ? (
                        <div className="flex gap-0.5 items-end justify-center h-3 w-3">
                          <span className="w-0.5 bg-primary animate-[bounce_0.8s_infinite_100ms] h-full" />
                          <span className="w-0.5 bg-primary animate-[bounce_0.8s_infinite_300ms] h-1/2" />
                          <span className="w-0.5 bg-primary animate-[bounce_0.8s_infinite_200ms] h-3/4" />
                        </div>
                      ) : (
                        <>
                          <span className="group-hover:hidden">{index + 1}</span>
                          <Play className="hidden group-hover:block w-3 h-3 fill-current text-text-main" />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Title & Artist */}
                  <div className="flex-1 min-w-0 px-4 flex items-center gap-3">
                    <TrackCover src={track.cover} title={track.title} artist={track.artist} album={track.album} format={track.format} details={track.details} alt={track.album} className="w-8 h-8 rounded text-[9px] shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold truncate text-text-main">{track.title}</div>
                      <div className="text-[10px] text-text-dim group-hover:text-text-muted truncate mt-0.5">{track.artist}</div>
                    </div>
                  </div>

                  {/* Album */}
                  <div className="w-1/4 min-w-[120px] px-4 hidden md:block text-text-muted group-hover:text-text-main truncate shrink-0">
                    {track.album}
                  </div>

                  {/* Format Badges */}
                  <div className="w-20 px-4 hidden sm:block select-none shrink-0">
                    <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase ${
                      track.format === 'FLAC' 
                        ? 'bg-rose-500/20 text-rose-400 font-extrabold' 
                        : 'bg-active-bg text-text-muted'
                    }`}>
                      {track.format}
                    </span>
                  </div>

                  {/* Duration */}
                  <div className="w-16 text-center font-mono text-text-dim group-hover:text-text-main shrink-0">
                    {formatDuration(track.duration)}
                  </div>

                  {/* Actions Dropdown Button */}
                  <div className="w-12 text-center relative shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={(e) => toggleDropdown(track.id, e)}
                      className="p-1 rounded hover:bg-active-bg text-text-dim hover:text-text-main transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu Popup */}
                    {activeDropdown === track.id && (
                      <div className="absolute right-12 top-2 z-50 w-44 bg-bg-dark border border-panel-border rounded-xl shadow-2xl py-1.5 text-left">
                        <button
                          onClick={() => {
                            toggleFavorite(track.id);
                            setActiveDropdown(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-text-muted hover:text-text-main hover:bg-primary/10 transition-colors"
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-primary text-primary' : ''}`} />
                          {isFav ? 'Unfavorite' : 'Favorite'}
                        </button>
                        <button
                          onClick={() => {
                            addToQueue(track);
                            setActiveDropdown(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-text-muted hover:text-text-main hover:bg-hover-bg transition-colors"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                          Add to Queue
                        </button>
                        <button
                          onClick={() => {
                            playNext(track);
                            setActiveDropdown(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-text-muted hover:text-text-main hover:bg-hover-bg transition-colors"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          Play Next
                        </button>
                        
                        {/* Playlist Sub-list */}
                        {playlists.length > 0 && (
                          <div className="border-t border-panel-border my-1 pt-1">
                            <span className="px-3 text-[9px] font-bold text-text-dim uppercase tracking-wider block mb-1">Add to Playlist</span>
                            {playlists.map((pl) => (
                              <button
                                key={`add-to-pl-${pl.id}`}
                                onClick={() => {
                                  addTrackToPlaylist(pl.id, track.id);
                                  setActiveDropdown(null);
                                }}
                                className="w-full text-left truncate px-3 py-1.5 text-[10px] text-text-muted hover:text-text-main hover:bg-hover-bg transition-colors"
                              >
                                + {pl.name}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Remove from Playlist (only if viewing a playlist) */}
                        {playlistIdToRemoveFrom && (
                          <button
                            onClick={() => {
                              removeTrackFromPlaylist(playlistIdToRemoveFrom, track.id);
                              setActiveDropdown(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors border-t border-panel-border mt-1 pt-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }}
          />
        </div>
      </div>
    );
  };

  // VIEW: ARTIST DETAIL VIEW
  const renderArtistDetail = () => {
    let currentArtistName = selectedArtist;
    if (!currentArtistName) return null;

    const filteredArtistTracks = searchQuery.trim()
      ? searchEngine.filterTracks(detailTracks, searchQuery)
      : detailTracks;

    // Group by album
    const albumGroups = Array.from(new Set(filteredArtistTracks.map((t) => t.album))).map((albumName) => ({
      name: albumName,
      tracks: filteredArtistTracks.filter((t) => t.album === albumName),
    }));

    return (
      <div className="space-y-8">
        {renderBackButton()}
        {/* Artist Header */}
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-end">
          <div className="relative w-48 h-48 shrink-0">
            <ArtistAvatar 
              name={currentArtistName} 
              imageUrl={detailTracks[0]?.cover ? `/api/cover/${detailTracks[0].id}` : undefined} 
              size="2xl" 
            />
          </div>
          <div className="flex-1 space-y-2.5 text-center sm:text-left">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Artist</span>
            <h1 className="text-3xl font-display font-extrabold text-text-main tracking-tight leading-none">{currentArtistName}</h1>
            <div className="text-xs text-text-muted space-y-1">
              <p>{detailTracks.length} song{detailTracks.length !== 1 ? 's' : ''} across {albumGroups.length} album{albumGroups.length !== 1 ? 's' : ''}</p>
            </div>

            {/* Play/Shuffle Actions */}
            <div className="flex items-center gap-3 pt-2 justify-center sm:justify-start">
              <button
                onClick={() => playTrack(detailTracks[0], detailTracks)}
                disabled={detailTracks.length === 0}
                className="px-5 py-2.5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-primary-glow/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Play
              </button>
              <button
                onClick={() => {
                  const randomTrack = detailTracks[Math.floor(Math.random() * detailTracks.length)];
                  playTrack(randomTrack, detailTracks);
                }}
                disabled={detailTracks.length === 0}
                className="px-5 py-2.5 rounded-full bg-hover-bg hover:bg-active-bg text-text-main text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                Shuffle
              </button>
            </div>
          </div>
        </div>

        {/* Album-grouped track listing */}
        {isLoadingDetail ? (
          <div className="p-8 text-center text-xs text-text-dim">Loading artist tracks...</div>
        ) : (
          albumGroups.map((album) => {
            const albumCover = album.tracks[0]?.cover || '';
            return (
              <div key={`artist-album-${album.name}`} className="space-y-3">
                <div className="flex items-center gap-4">
                  <TrackCover
                    src={albumCover}
                    title={album.name}
                    artist={currentArtistName || ''}
                    album={album.name}
                    alt={album.name}
                    className="w-12 h-12 rounded-lg"
                  />
                  <div>
                    <h2 className="text-base font-bold text-text-main">{album.name}</h2>
                    <p className="text-[10px] text-text-dim">{album.tracks.length} song{album.tracks.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden bg-bg-subtle">
                  {renderTrackTable(album.tracks)}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderBackButton = () => {
    if (!canGoBack || !onBack) return null;
    return (
      <button 
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-main transition-colors duration-200 mb-6 group cursor-pointer focus:outline-none rounded px-1 -mx-1"
      >
        <ChevronLeft className="w-4.5 h-4.5 transition-transform group-hover:-translate-x-0.5" />
        <span>Back</span>
      </button>
    );
  };

  // ROUTER CONTROLLER
  switch (currentView) {
    case 'home':
      return renderHome();
    case 'albums':
      return renderAlbums();
    case 'artists':
      return renderArtists();
    case 'favorites':
      return renderFavorites();
    case 'settings':
      return (
        <div className="space-y-8 pb-12">
          {renderBackButton()}
          <DspSettings />
          <SyncDashboard />
        </div>
      );
    case 'album-detail':
      return renderAlbumDetail();
    case 'artist-detail':
      return renderArtistDetail();
    default:
      if (currentView.startsWith('playlist-')) {
        const plId = currentView.replace('playlist-', '');
        return renderPlaylistDetail(plId);
      }
      return renderHome();
  }
};
export default LibraryViews;

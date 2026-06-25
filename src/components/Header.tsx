import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Sliders, Sparkles, Sun, Moon, Laptop, Music, User, Disc, X } from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { searchEngine, highlightMatch } from '../utils/SearchEngine';
import type { SearchSuggestion } from '../utils/SearchEngine';
import { TrackCover } from './TrackCover';
import { ArtistAvatar } from './ArtistAvatar';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setCurrentView: (view: string, albumId?: string | null, artistId?: string | null) => void;
  setSelectedAlbum?: (album: string | null) => void;
  setSelectedArtist?: (artist: string | null) => void;
}

export const Header = ({ searchQuery, setSearchQuery, setCurrentView, setSelectedAlbum, setSelectedArtist }: HeaderProps) => {
  const { effectMode, theme, setTheme, tracks, searchIndexTracks, playTrack } = useMusicPlayer();

  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isMobile, setIsMobile] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Build search index from full song list (all tracks, no pagination)
  useEffect(() => {
    const indexSource = searchIndexTracks.length > 0 ? searchIndexTracks : tracks;
    if (indexSource.length > 0) {
      searchEngine.buildIndex(indexSource);
    }
  }, [searchIndexTracks, tracks]);

  const maxSuggestions = isMobile ? 3 : 5;

  // Debounced suggestion generation
  const updateSuggestions = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!query.trim()) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      debounceRef.current = setTimeout(() => {
        const results = searchEngine.getSuggestions(query, maxSuggestions);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
        setSelectedIndex(-1);
      }, 150);
    },
    [maxSuggestions]
  );

  // When searchQuery changes from outside
  useEffect(() => {
    updateSuggestions(searchQuery);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, updateSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleInputFocus = () => {
    if (searchQuery.trim() && suggestions.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setShowDropdown(false);

    if (suggestion.type === 'track' && suggestion.track) {
      playTrack(suggestion.track);
      setSearchQuery('');
    } else if (suggestion.type === 'artist' && suggestion.artist) {
      if (setSelectedArtist) setSelectedArtist(suggestion.artist);
      setCurrentView('artist-detail');
      setSearchQuery('');
    } else if (suggestion.type === 'album' && suggestion.album) {
      if (setSelectedAlbum) setSelectedAlbum(suggestion.album);
      setCurrentView('album-detail');
      setSearchQuery('');
    } else if (suggestion.type === 'playlist' && suggestion.playlistId) {
      setCurrentView(`playlist-${suggestion.playlistId}`);
      setSearchQuery('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Escape') {
        setSearchQuery('');
        inputRef.current?.blur();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setSearchQuery('');
        inputRef.current?.blur();
        break;
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleThemeCycle = () => {
    if (theme === 'dark') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('system');
    } else {
      setTheme('dark');
    }
  };

  const getThemeTitle = () => {
    if (theme === 'dark') return 'Dark Mode (Click to switch to Light)';
    if (theme === 'light') return 'Light Mode (Click to switch to System)';
    return 'System Mode (Click to switch to Dark)';
  };

  // Icon for suggestion type
  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'artist':
        return <User className="w-3 h-3" />;
      case 'album':
        return <Disc className="w-3 h-3" />;
      case 'playlist':
        return <Music className="w-3 h-3" />;
      default:
        return null;
    }
  };

  // Render highlighted text
  const renderHighlightedText = (text: string) => {
    const parts = highlightMatch(text, searchQuery);
    return (
      <span>
        {parts.map((part, i) =>
          part.highlighted ? (
            <mark key={i} className="bg-primary/25 text-primary rounded-sm px-[1px]">
              {part.text}
            </mark>
          ) : (
            <span key={i}>{part.text}</span>
          )
        )}
      </span>
    );
  };

  return (
    <header className="h-16 px-8 flex items-center justify-between border-b border-panel-border bg-bg-darker/40 backdrop-blur-md sticky top-0 z-40">
      {/* Search Input Container */}
      <div className="w-80 relative">
        <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-text-dim">
          <Search className="w-4 h-4" />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder="Search songs, albums, artists..."
          className="w-full pl-9 pr-8 py-2 text-sm glass-input rounded-full placeholder-text-dim text-text-main"
          autoComplete="off"
          spellCheck={false}
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-2.5 flex items-center text-text-dim hover:text-text-main transition-colors cursor-pointer"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Auto-Suggestion Dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-2 bg-bg-darker/95 backdrop-blur-xl border border-panel-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 animate-[searchDropIn_0.15s_ease-out]"
          >
            <div className="py-1.5">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.type}-${suggestion.label}-${index}`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-100 cursor-pointer ${
                    index === selectedIndex
                      ? 'bg-active-bg'
                      : 'hover:bg-hover-bg'
                  }`}
                >
                  {/* Artwork */}
                  <div className={`w-9 h-9 flex-shrink-0 ${suggestion.type === 'artist' ? '' : 'rounded-lg overflow-hidden'}`}>
                    {suggestion.type === 'artist' ? (
                      <ArtistAvatar name={suggestion.label} size="sm" />
                    ) : (
                      <TrackCover
                        src={suggestion.cover}
                        title={suggestion.label}
                        artist={suggestion.artist || suggestion.sublabel}
                        album={suggestion.album}
                        className="w-full h-full text-[8px]"
                      />
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {suggestion.type !== 'track' && (
                        <span className="text-primary/60 flex-shrink-0">
                          {getSuggestionIcon(suggestion.type)}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-text-main truncate">
                        {renderHighlightedText(suggestion.label)}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-muted truncate mt-0.5">
                      {suggestion.type !== 'track' && (
                        <span className="text-primary/50 capitalize mr-1">{suggestion.type} ·</span>
                      )}
                      {renderHighlightedText(suggestion.sublabel)}
                    </p>
                  </div>

                  {/* Keyboard hint on selected */}
                  {index === selectedIndex && !isMobile && (
                    <span className="text-[9px] text-text-dim font-mono flex-shrink-0 bg-hover-bg px-1.5 py-0.5 rounded">
                      ↵
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Footer hint */}
            {!isMobile && (
              <div className="px-3.5 py-2 border-t border-panel-border flex items-center justify-between">
                <span className="text-[9px] text-text-dim">
                  <kbd className="font-mono bg-hover-bg px-1 py-0.5 rounded mr-1">↑↓</kbd>
                  Navigate
                  <kbd className="font-mono bg-hover-bg px-1 py-0.5 rounded mx-1">↵</kbd>
                  Select
                  <kbd className="font-mono bg-hover-bg px-1 py-0.5 rounded mx-1">Esc</kbd>
                  Close
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Theme Toggler & Quick DSP Status Info & Actions */}
      <div className="flex items-center gap-3">
        {effectMode !== 'Original' && (
          <div 
            onClick={() => setCurrentView('settings')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/15 border border-accent/20 text-xs font-semibold text-accent cursor-pointer hover:bg-accent/25 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-accent" />
            <span>DSP: {effectMode}</span>
          </div>
        )}

        {/* Theme Cycle Button */}
        <button
          onClick={handleThemeCycle}
          className="p-2 rounded-full bg-hover-bg border border-panel-border text-text-muted hover:text-text-main hover:bg-active-bg transition-all flex items-center justify-center cursor-pointer"
          title={getThemeTitle()}
        >
          {theme === 'dark' && <Moon className="w-4 h-4" />}
          {theme === 'light' && <Sun className="w-4 h-4" />}
          {theme === 'system' && <Laptop className="w-4 h-4" />}
        </button>

        <button
          onClick={() => setCurrentView('settings')}
          className="p-2 rounded-full bg-hover-bg border border-panel-border text-text-muted hover:text-text-main hover:bg-active-bg transition-all flex items-center justify-center"
          title="Audio DSP Settings"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
export default Header;

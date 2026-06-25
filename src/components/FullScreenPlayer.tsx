import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronDown, Play, Pause, SkipForward, SkipBack, 
  Volume2, VolumeX, Shuffle, Repeat, Heart, ListMusic, Music 
} from 'lucide-react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import TrackCover from './TrackCover';
import { EFFECT_META } from '../audio/AudioEngine';
import { DspIcon } from './DspIcons';

interface FullScreenPlayerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LyricLine {
  time: number;
  text: string;
}


const GENERIC_LYRICS = `[00:00.00] (Instrumental Introduction)
[00:08.00] Feeling the vibration in the sound...
[00:14.00] Drifting high, above the ground.
[00:20.00] In the silence of the night,
[00:26.00] Every frequency shines bright.
[00:32.00] Close your eyes and let it go,
[00:38.00] Let the sonic rivers flow.
[00:45.00] We are dancing in the glow,
[00:52.00] High dynamics, high and low...
[01:00.00] (Synth Solo - Spatial Stereo Reverb)
[01:15.00] Touch the stars, they call your name,
[01:21.00] Nothing here will stay the same.
[01:28.00] In the echo of the deep,
[01:34.00] Promises we swear to keep.
[01:42.00] Hear the vocal space expand,
[01:49.00] Atmospheric, golden sand...
[02:00.00] (Outro - Holographic Fading beats)`;

export const FullScreenPlayer: React.FC<FullScreenPlayerProps> = ({ isOpen, onClose }) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    queue,
    queueIndex,
    favorites,
    repeatMode,
    isShuffle,
    effectMode,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    setRepeatMode,
    toggleShuffle,
    toggleFavorite,
    removeFromQueue,
  } = useMusicPlayer();

  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [activeLyricIndex, setActiveLyricIndex] = useState(-1);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.8);
  const [isClosing, setIsClosing] = useState(false);
  
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 250);
  };

  // Parse lyrics when track changes
  useEffect(() => {
    if (currentTrack) {
      fetch('/lyrics.json')
        .then((res) => (res.ok ? res.json() : {}))
        .then((lyricsDb: Record<string, string>) => {
          const rawText = lyricsDb[currentTrack.title] || GENERIC_LYRICS;
          const lines = rawText.split('\n');
          const parsed: LyricLine[] = [];
          const regex = /\[(\d+):(\d+)\.(\d+)\]/;

          lines.forEach((line) => {
            const match = regex.exec(line);
            if (match) {
              const min = parseInt(match[1]);
              const sec = parseInt(match[2]);
              const ms = parseInt(match[3]);
              const time = min * 60 + sec + ms / 100;
              const text = line.replace(regex, '').trim();
              parsed.push({ time, text });
            }
          });
          setLyrics(parsed);
        })
        .catch((err) => {
          console.warn('Failed to fetch dynamic lyrics:', err);
          // Fallback to generic lyrics
          const lines = GENERIC_LYRICS.split('\n');
          const parsed: LyricLine[] = [];
          const regex = /\[(\d+):(\d+)\.(\d+)\]/;
          lines.forEach((line) => {
            const match = regex.exec(line);
            if (match) {
              const min = parseInt(match[1]);
              const sec = parseInt(match[2]);
              const ms = parseInt(match[3]);
              const time = min * 60 + sec + ms / 100;
              const text = line.replace(regex, '').trim();
              parsed.push({ time, text });
            }
          });
          setLyrics(parsed);
        });
      setActiveLyricIndex(-1);
    }
  }, [currentTrack]);

  // Track active lyric index
  useEffect(() => {
    if (lyrics.length > 0) {
      const index = lyrics.findIndex(
        (line, idx) => 
          currentTime >= line.time && 
          (idx === lyrics.length - 1 || currentTime < lyrics[idx + 1].time)
      );
      if (index !== activeLyricIndex) {
        setActiveLyricIndex(index);
      }
    }
  }, [currentTime, lyrics, activeLyricIndex]);

  // Scroll active lyric into view
  useEffect(() => {
    if (showLyrics && activeLyricIndex !== -1 && lyricsContainerRef.current) {
      const activeElement = lyricsContainerRef.current.children[activeLyricIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [activeLyricIndex, showLyrics]);

  if (!isOpen && !isClosing) return null;
  if (!currentTrack) return null;

  // Format time
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Seek on lyric click
  const handleLyricClick = (time: number) => {
    seek(time);
  };

  // Toggle Mute
  const handleMuteToggle = () => {
    if (isMuted) {
      setVolume(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  // Touch Gesture Listeners (Swipe to skip or minimize)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || touchStartX.current === null) return;
    
    const deltaY = e.touches[0].clientY - touchStartY.current;
    const deltaX = e.touches[0].clientX - touchStartX.current;

    // Swipe down on top bar area to minimize
    if (deltaY > 80 && Math.abs(deltaY) > Math.abs(deltaX)) {
      touchStartY.current = null;
      touchStartX.current = null;
      handleClose();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Horizontal swipe on cover to skip tracks (Swipe Left = Next, Swipe Right = Prev)
    if (Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        nextTrack();
      } else {
        prevTrack();
      }
    }

    touchStartY.current = null;
    touchStartX.current = null;
  };

  const isFav = favorites.includes(currentTrack.id);

  return (
    <div 
      className={`fixed inset-0 z-50 fluid-bg flex flex-col text-text-main select-none pb-safe ${
        isClosing ? 'animate-slide-down' : 'animate-slide-up'
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Navigation / Dismiss bar */}
      <header className="flex justify-between items-center px-6 pt-8 pb-4">
        <button 
          onClick={handleClose}
          className="p-2 rounded-full bg-hover-bg active:bg-active-bg hover:bg-active-bg transition-colors"
          aria-label="Minimize player"
        >
          <ChevronDown className="w-6 h-6 text-text-main" />
        </button>
        
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase font-bold tracking-widest text-text-dim">Playing From</span>
          <span className="text-xs font-semibold text-text-muted truncate max-w-[200px]">
            {currentTrack.album}
          </span>
        </div>

        <button 
          onClick={() => { setShowQueue(!showQueue); setShowLyrics(false); }}
          className={`p-2 rounded-full transition-colors ${showQueue ? 'bg-primary text-white' : 'bg-hover-bg text-text-main hover:bg-active-bg'}`}
          aria-label="Toggle queue"
        >
          <ListMusic className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center px-8 pb-4 overflow-hidden">
        {showLyrics ? (
          /* Lyrics Container */
          <div 
            ref={lyricsContainerRef}
            className="flex-1 overflow-y-auto px-4 py-8 space-y-6 scroll-smooth mask-lyrics text-left"
          >
            {lyrics.map((line, idx) => {
              const isActive = idx === activeLyricIndex;
              return (
                <p
                  key={idx}
                  onClick={() => handleLyricClick(line.time)}
                  className={`text-2xl font-bold cursor-pointer transition-all duration-300 transform origin-left leading-relaxed ${
                    isActive 
                      ? 'text-primary scale-105 filter drop-shadow-[0_0_12px_var(--color-primary-glow)] font-extrabold opacity-100' 
                      : 'text-text-muted hover:text-text-main opacity-40 hover:opacity-80'
                  }`}
                >
                  {line.text}
                </p>
              );
            })}
          </div>
        ) : showQueue ? (
          /* Embedded Queue Display */
          <div className="flex-1 overflow-y-auto bg-bg-subtle rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-primary mb-2 flex items-center gap-2">
              <ListMusic className="w-4 h-4" /> Next Up
            </h3>
            {queue.slice(queueIndex + 1).length === 0 ? (
              <p className="text-xs text-text-dim text-center py-8">Queue is empty. Add songs to keep the music playing.</p>
            ) : (
              <div className="space-y-2">
                {queue.slice(queueIndex + 1).map((track, idx) => {
                  const actualIdx = queueIndex + 1 + idx;
                  return (
                    <div 
                      key={`${track.id}-${actualIdx}`}
                      className="flex items-center gap-3 p-2 rounded-lg bg-hover-bg hover:bg-active-bg transition-colors"
                    >
                      <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                        <TrackCover src={track.cover} title={track.title} artist={track.artist} album={track.album} className="w-full h-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{track.title}</p>
                        <p className="text-[10px] text-text-muted truncate">{track.artist}</p>
                      </div>
                      <button 
                        onClick={() => removeFromQueue(track.id)}
                        className="text-text-dim hover:text-primary p-2 text-xs font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Large Album Cover Art Display */
          <div className="flex-1 flex flex-col items-center justify-center py-6">
            <div className="w-72 h-72 md:w-80 md:h-80 rounded-xl overflow-hidden shadow-lg transition-opacity hover:opacity-90 duration-500">
              <TrackCover src={currentTrack.cover} title={currentTrack.title} artist={currentTrack.artist} album={currentTrack.album} className="w-full h-full" />
            </div>
          </div>
        )}

        {/* Title, Artist, & Favorite Row */}
        <div className="flex items-center justify-between mt-4">
          <div className="min-w-0 flex-1 pr-4 text-left">
            <h2 className="text-2xl font-bold tracking-tight truncate">{currentTrack.title}</h2>
            <p className="text-base text-text-muted truncate mt-0.5">{currentTrack.artist}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button 
              onClick={() => toggleFavorite(currentTrack.id)}
              className={`p-3 rounded-full hover:bg-active-bg transition-colors ${isFav ? 'text-primary' : 'text-text-muted'}`}
              aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
            >
              <Heart className="w-6 h-6" fill={isFav ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        {/* Audio Quality Badges & Bit-Perfect Status */}
        <div className="flex flex-col gap-1.5 mt-3 select-none text-left shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-primary/20 text-primary uppercase tracking-wider">
              {currentTrack.format}
            </span>
            <span className="text-[11px] font-medium text-text-dim">
              {currentTrack.details}
            </span>
            {effectMode !== 'Original' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent/25 text-white flex items-center gap-1.5">
                <DspIcon name={EFFECT_META[effectMode]?.icon || 'original'} className="w-3 h-3" /> {effectMode}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <DspIcon name={effectMode === 'Original' ? 'original' : (EFFECT_META[effectMode]?.icon || 'original')} className={`w-3.5 h-3.5 ${
              effectMode === 'Original' ? 'text-green-400' : 'text-amber-400/90'
            }`} />
            <span className={`text-[11px] font-bold tracking-wide ${
              effectMode === 'Original' ? 'text-green-400' : 'text-amber-400/90'
            }`}>
              {effectMode === 'Original' ? 'True Lossless (Direct)' : `DSP Audio (${effectMode})`}
            </span>
          </div>
        </div>

        {/* Seekbar controls */}
        <div className="space-y-1 mt-6">
          <input 
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="w-full h-1 rounded-lg appearance-none cursor-pointer"
            aria-label="Seek playback"
          />
          <div className="flex justify-between text-xs text-text-dim font-medium">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Primary Playback controls */}
        <div className="flex justify-around items-center py-4 my-2">
          <button 
            onClick={toggleShuffle}
            className={`p-2 rounded-full transition-colors ${isShuffle ? 'text-primary' : 'text-text-muted hover:text-text-main'}`}
            aria-label="Shuffle"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <button 
            onClick={prevTrack}
            className="p-3 rounded-full text-text-main hover:bg-hover-bg active:bg-active-bg transition-colors"
            aria-label="Previous track"
          >
            <SkipBack className="w-7 h-7" />
          </button>

          <button 
            onClick={togglePlay}
            className="p-5 rounded-full bg-primary hover:bg-primary-hover text-white shadow-lg transition-colors"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current translate-x-0.5" />
            )}
          </button>

          <button 
            onClick={nextTrack}
            className="p-3 rounded-full text-text-main hover:bg-hover-bg active:bg-active-bg transition-colors"
            aria-label="Next track"
          >
            <SkipForward className="w-7 h-7" />
          </button>

          <button 
            onClick={() => setRepeatMode(repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none')}
            className={`p-2 rounded-full transition-colors ${repeatMode !== 'none' ? 'text-primary' : 'text-text-muted hover:text-text-main'}`}
            aria-label="Repeat"
          >
            <Repeat className="w-5 h-5" />
          </button>
        </div>

        {/* Volume & Aux Panel */}
        <div className="flex items-center gap-3 px-2 mt-4 pb-6">
          <button 
            onClick={handleMuteToggle}
            className="text-text-muted hover:text-text-main p-1"
            aria-label="Mute"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>

          <input 
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              if (isMuted && parseFloat(e.target.value) > 0) setIsMuted(false);
            }}
            className="flex-1 h-1 rounded-lg appearance-none cursor-pointer"
            aria-label="Volume slider"
          />

          <button 
            onClick={() => { setShowLyrics(!showLyrics); setShowQueue(false); }}
            className={`p-2 rounded-full transition-colors ${showLyrics ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'}`}
            aria-label="Toggle lyrics"
          >
            <Music className="w-5 h-5" />
          </button>
        </div>
      </main>
    </div>
  );
};

export default FullScreenPlayer;

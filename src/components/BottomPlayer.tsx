import { useState } from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { TrackCover } from './TrackCover';
import { EFFECT_META } from '../audio/AudioEngine';
import { DspIcon } from './DspIcons';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Shuffle, 
  Repeat, 
  Repeat1, 
  ListMusic, 
  Sliders, 
  Heart
} from 'lucide-react';

interface BottomPlayerProps {
  showQueue: boolean;
  setShowQueue: (show: boolean) => void;
  setCurrentView: (view: string) => void;
  onExpand?: () => void;
}

export const BottomPlayer = ({ showQueue, setShowQueue, setCurrentView, onExpand }: BottomPlayerProps) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    repeatMode,
    isShuffle,
    favorites,
    toggleFavorite,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    setRepeatMode,
    toggleShuffle,
    effectMode
  } = useMusicPlayer();

  const [prevVolume, setPrevVolume] = useState(0.8);

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  const handleVolumeToggle = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const handleRepeatToggle = () => {
    if (repeatMode === 'none') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('none');
  };

  if (!currentTrack) {
    return (
      <div className="h-14 md:h-20 border-t border-panel-border bg-bg-darker/80 backdrop-blur-xl flex items-center justify-center text-sm text-text-dim select-none">
        Select a track to start listening.
      </div>
    );
  }

  const isFavorite = favorites.includes(currentTrack.id);
  const remainingTime = duration - currentTime;

  // Render correct repeat icon
  const renderRepeatIcon = () => {
    if (repeatMode === 'one') {
      return <Repeat1 className="w-4.5 h-4.5 text-primary" />;
    }
    return <Repeat className={`w-4.5 h-4.5 ${repeatMode === 'all' ? 'text-primary' : ''}`} />;
  };

  const isLossless = currentTrack.format === 'FLAC' || currentTrack.format === 'ALAC' || currentTrack.format === 'WAV';

  return (
    <div 
      onClick={() => {
        if (window.innerWidth < 768 && onExpand) {
          onExpand();
        }
      }}
      className="h-20 md:h-24 border-t border-panel-border bg-bg-dark px-4 md:px-6 flex items-center justify-between select-none relative z-50 cursor-pointer md:cursor-default"
    >
      {/* Playback Progress Scrubber at the top edge of player */}
      <div className="absolute top-0 left-0 w-full h-[3px] bg-hover-bg group hover:h-1.5 transition-all">
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeekChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div 
          className="h-full progress-fill rounded-r transition-all"
          style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
        />
      </div>

      {/* Left side: Track details */}
      <div className="flex items-center gap-3 md:gap-4 flex-1 md:w-1/4 md:min-w-[240px] min-w-0">
        <TrackCover 
          src={currentTrack.cover} 
          title={currentTrack.title}
          artist={currentTrack.artist}
          album={currentTrack.album}
          alt={currentTrack.album} 
          className="w-11 h-11 md:w-14 md:h-14 rounded-lg shadow-md transition-opacity hover:opacity-90 text-lg flex-shrink-0"
        />
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <h4 className="text-xs md:text-sm font-semibold text-text-main truncate hover:underline cursor-pointer">
              {currentTrack.title}
            </h4>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(currentTrack.id);
              }}
              className="text-text-dim hover:text-primary transition-colors shrink-0"
            >
              <Heart 
                className={`w-3.5 h-3.5 md:w-4 md:h-4 transition-transform active:scale-125 ${isFavorite ? 'fill-primary text-primary' : ''}`} 
              />
            </button>
          </div>
          <p className="text-[10px] md:text-xs text-text-muted truncate hover:text-text-main transition-colors cursor-pointer">
            {currentTrack.artist}
          </p>
          
          {/* Format & Bit-Perfect Badges */}
          <div className="flex flex-col gap-1 mt-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className={`text-[8px] md:text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wider leading-none select-none uppercase flex items-center gap-1 shrink-0 ${
                isLossless 
                  ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-sm' 
                  : 'bg-active-bg text-text-muted'
              }`}>
                {isLossless && <DspIcon name="lossless" className="w-2.5 h-2.5" />}
                {currentTrack.format}
              </span>
              <span className="text-[9px] md:text-[10px] font-medium text-text-dim truncate max-w-[150px] md:max-w-none">
                {currentTrack.details}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <DspIcon name={effectMode === 'Original' ? 'original' : (EFFECT_META[effectMode]?.icon || 'original')} className={`w-3 h-3 ${
                effectMode === 'Original' ? 'text-green-400' : 'text-amber-400/90'
              }`} />
              <span className={`text-[8px] md:text-[9.5px] font-bold tracking-wide ${
                effectMode === 'Original' ? 'text-green-400' : 'text-amber-400/90'
              }`}>
                {effectMode === 'Original' ? 'True Lossless (Direct)' : `DSP Audio (${effectMode})`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Controls & Playback speed (Hidden on mobile) */}
      <div className="hidden md:flex flex-col items-center gap-1.5 w-2/5">
        <div className="flex items-center gap-6">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              toggleShuffle();
            }}
            className={`p-1.5 rounded hover:bg-hover-bg transition-all ${isShuffle ? 'text-primary' : 'text-text-dim hover:text-text-main'}`}
            title="Shuffle"
          >
            <Shuffle className="w-4.5 h-4.5" />
          </button>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              prevTrack();
            }}
            className="p-2 rounded hover:bg-hover-bg text-text-muted hover:text-text-main transition-all"
            title="Previous"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center transition-colors shadow-md shadow-white/15"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current text-black" />
            ) : (
              <Play className="w-5 h-5 fill-current text-black ml-0.5" />
            )}
          </button>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              nextTrack();
            }}
            className="p-2 rounded hover:bg-hover-bg text-text-muted hover:text-text-main transition-all"
            title="Next"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleRepeatToggle();
            }}
            className={`p-1.5 rounded hover:bg-hover-bg transition-all ${repeatMode !== 'none' ? 'text-primary' : 'text-text-dim hover:text-text-main'}`}
            title={`Repeat: ${repeatMode}`}
          >
            {renderRepeatIcon()}
          </button>
        </div>

        {/* Time Progress Details */}
        <div className="flex items-center justify-between w-full max-w-sm text-[10px] text-text-dim font-mono mt-0.5">
          <span>{formatTime(currentTime)}</span>
          <span>-{formatTime(remainingTime)}</span>
        </div>
      </div>

      {/* Right side: Volume & panels on desktop, Play/Pause + Next on mobile */}
      <div className="flex items-center justify-end gap-3 md:gap-4 md:w-1/4 md:min-w-[220px] shrink-0">
        {/* Mobile controls */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className="md:hidden w-8 h-8 rounded-full flex items-center justify-center text-text-main transition-all"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 text-text-main" />
          ) : (
            <Play className="w-5 h-5 text-text-main ml-0.5" />
          )}
        </button>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            nextTrack();
          }}
          className="md:hidden p-1.5 text-text-main transition-all"
          title="Next"
        >
          <SkipForward className="w-5 h-5 fill-current" />
        </button>

        {/* Desktop-only Volume & panels */}
        <div className="hidden md:flex items-center justify-end gap-4 w-full">
          {/* Quick DSP indicator */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setCurrentView('settings');
            }}
            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs ${
              effectMode !== 'Original'
                ? 'bg-accent/15 text-purple-300 font-semibold'
                : 'bg-hover-bg text-text-muted hover:text-text-main hover:bg-active-bg'
            }`}
            title="Audio Settings"
          >
            {effectMode !== 'Original' ? (
              <DspIcon name={EFFECT_META[effectMode]?.icon || 'original'} className="w-4 h-4" />
            ) : (
              <Sliders className="w-4 h-4" />
            )}
            {effectMode !== 'Original' && <span className="text-[10px] font-bold uppercase tracking-wider">{effectMode}</span>}
          </button>

          {/* Volume controls */}
          <div className="flex items-center gap-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleVolumeToggle();
              }}
              className="text-text-dim hover:text-text-main transition-colors"
            >
              {volume === 0 ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
            </button>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="w-20 accent-primary"
            />
          </div>

          {/* Queue panel toggle */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowQueue(!showQueue);
            }}
            className={`p-2 rounded-lg transition-all ${showQueue ? 'bg-primary/20 border border-primary/30 text-primary' : 'bg-hover-bg border border-panel-border text-text-dim hover:text-text-main hover:bg-active-bg'}`}
            title="Play Queue"
          >
            <ListMusic className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
export default BottomPlayer;

import React, { useState } from 'react';
import { Play, Heart, MoreVertical, ListPlus, FolderPlus } from 'lucide-react';
import type { Track } from '../context/MusicPlayerContext';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { TrackCover } from './TrackCover';

interface PremiumMusicCardProps {
  track: Track;
  allTracks: Track[];
  isTV?: boolean;
}

export const getAudioSpecs = (track: Track) => {
  const format = track.format ? track.format.toUpperCase() : 'MP3';
  const details = track.details || '';
  
  let depth = '';
  let rate = '';
  
  if (details.toLowerCase().includes('24-bit') || details.toLowerCase().includes('24bit')) {
    depth = '24-bit';
  } else if (details.toLowerCase().includes('16-bit') || details.toLowerCase().includes('16bit')) {
    depth = '16-bit';
  }
  
  const hzMatch = details.match(/(\d+\.?\d*)\s*(kHz|Hz)/i);
  if (hzMatch) {
    let num = parseFloat(hzMatch[1]);
    if (hzMatch[2].toLowerCase() === 'hz') {
      rate = `${(num / 1000).toFixed(0)} kHz`;
    } else {
      rate = `${num} kHz`;
    }
  } else if (details.toLowerCase().includes('96khz') || details.toLowerCase().includes('96 khz') || details.toLowerCase().includes('96000 hz')) {
    rate = '96 kHz';
  } else if (details.toLowerCase().includes('192khz') || details.toLowerCase().includes('192 khz') || details.toLowerCase().includes('192000 hz')) {
    rate = '192 kHz';
  } else if (details.toLowerCase().includes('44.1khz') || details.toLowerCase().includes('44.1 khz') || details.toLowerCase().includes('44100 hz')) {
    rate = '44.1 kHz';
  } else if (details.toLowerCase().includes('48khz') || details.toLowerCase().includes('48 khz') || details.toLowerCase().includes('48000 hz')) {
    rate = '48 kHz';
  }
  
  let kbps = '';
  const kbpsMatch = details.match(/(\d+)\s*kbps/i);
  if (kbpsMatch) {
    kbps = `${kbpsMatch[1]} kbps`;
  }
  
  const parts = [format];
  if (depth) parts.push(depth);
  if (rate) parts.push(rate);
  if (kbps && !depth && !rate) parts.push(kbps);
  
  return parts.join(' • ');
};

export const PremiumMusicCard = ({ track, allTracks, isTV = false }: PremiumMusicCardProps) => {
  const {
    currentTrack,
    playTrack,
    favorites,
    toggleFavorite,
    playNext,
    addToQueue,
    playlists,
    addTrackToPlaylist
  } = useMusicPlayer();

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isCurrent = currentTrack?.id === track.id;
  const isFav = favorites.includes(track.id);

  // Technical quality determination
  const isLossless = ['FLAC', 'ALAC', 'WAV'].includes(track.format.toUpperCase());
  const isHiRes = isLossless && (
    track.details.toLowerCase().includes('24-bit') || 
    track.details.toLowerCase().includes('96khz') || 
    track.details.toLowerCase().includes('192khz') ||
    track.details.toLowerCase().includes('96000 hz') ||
    track.details.toLowerCase().includes('192000 hz')
  );

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    playTrack(track, allTracks);
  };

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDropdownOpen(!dropdownOpen);
  };

  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(track.id);
    setDropdownOpen(false);
  };

  const handlePlayNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    playNext(track);
    setDropdownOpen(false);
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue(track);
    setDropdownOpen(false);
  };

  const handleAddToPlaylist = (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    addTrackToPlaylist(playlistId, track.id);
    setDropdownOpen(false);
  };

  return (
    <div
      onClick={handlePlayClick}
      className={`premium-card p-3 flex flex-col h-full select-none cursor-pointer group relative ${
        isCurrent ? 'bg-active-bg border-primary/40' : ''
      } ${isTV ? 'outline-2 focus-visible:outline-primary' : ''}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          playTrack(track, allTracks);
        }
      }}
      title={`${track.title} - ${track.artist}`}
    >
      {/* Artwork Section with strict aspect-square */}
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-neutral-900 border border-white/[0.04]">
        <TrackCover
          src={track.cover}
          title={track.title}
          artist={track.artist}
          album={track.album}
          format={track.format}
          details={track.details}
          alt={track.title}
          className="premium-card-artwork w-full h-full object-cover"
        />

        {/* Hover overlay with glassmorphic Play button */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20">
          <button
            onClick={handlePlayClick}
            className="w-12 h-12 rounded-full bg-primary/95 text-white flex items-center justify-center shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
          >
            <Play className="w-6 h-6 fill-current ml-0.5" />
          </button>
        </div>

        {/* Quality indicator floating badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-30">
          {isHiRes ? (
            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-[#F59E0B] text-neutral-950 shadow-lg tracking-wider uppercase">
              Hi-Res
            </span>
          ) : isLossless ? (
            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-[#10B981] text-neutral-950 shadow-lg tracking-wider uppercase">
              Lossless
            </span>
          ) : null}
        </div>

        {/* Format badge bottom right */}
        <div className="absolute bottom-2 right-2 z-30">
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-white/90 shadow-md uppercase">
            {track.format}
          </span>
        </div>
      </div>

      {/* Details Section */}
      <div className="flex-1 flex flex-col justify-between min-h-0 text-left relative pr-5">
        <div>
          <h3
            className={`text-xs font-semibold line-clamp-2 leading-tight ${
              isCurrent ? 'text-primary' : 'text-text-main'
            }`}
          >
            {track.title}
          </h3>
          <p className="text-[10px] text-text-muted truncate font-medium mt-0.5">
            {track.artist}
          </p>
        </div>

        <div className="mt-1 flex items-center justify-between">
          <span className="text-[9px] text-text-dim/80 truncate font-semibold">
            {getAudioSpecs(track)}
          </span>
        </div>

        {/* Three-dot Context Actions Menu */}
        <div className="absolute right-0 bottom-1 z-30">
          <button
            onClick={handleDropdownToggle}
            className="text-text-dim hover:text-text-main p-1 rounded-md transition-colors"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 bottom-6 bg-bg-dark border border-panel-border rounded-xl shadow-2xl py-1.5 w-40 z-50 overflow-hidden backdrop-blur-xl">
              <button
                onClick={handlePlayClick}
                className="w-full text-left px-3 py-1.5 text-[10px] text-text-main hover:bg-hover-bg flex items-center gap-2"
              >
                <Play className="w-3 h-3" /> Play Song
              </button>
              <button
                onClick={handlePlayNext}
                className="w-full text-left px-3 py-1.5 text-[10px] text-text-main hover:bg-hover-bg flex items-center gap-2"
              >
                <ListPlus className="w-3 h-3" /> Play Next
              </button>
              <button
                onClick={handleAddToQueue}
                className="w-full text-left px-3 py-1.5 text-[10px] text-text-main hover:bg-hover-bg flex items-center gap-2"
              >
                <FolderPlus className="w-3 h-3" /> Add to Queue
              </button>
              <button
                onClick={handleFavoriteToggle}
                className="w-full text-left px-3 py-1.5 text-[10px] text-text-main hover:bg-hover-bg flex items-center gap-2"
              >
                <Heart className={`w-3 h-3 ${isFav ? 'fill-primary text-primary' : ''}`} />{' '}
                {isFav ? 'Unfavorite' : 'Favorite'}
              </button>
              
              {/* Playlists sub-menu */}
              {playlists.length > 0 && (
                <div className="border-t border-panel-border mt-1 pt-1">
                  <div className="px-3 py-1 text-[8px] font-bold text-text-dim uppercase tracking-wider">
                    Add to Playlist
                  </div>
                  {playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={(e) => handleAddToPlaylist(pl.id, e)}
                      className="w-full text-left px-3 py-1 text-[9px] text-text-muted hover:bg-hover-bg truncate"
                    >
                      {pl.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PremiumMusicCard;

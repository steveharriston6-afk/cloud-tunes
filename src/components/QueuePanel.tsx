import React from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { Play, Trash2, X, ListMusic, Volume2 } from 'lucide-react';
import { TrackCover } from './TrackCover';

interface QueuePanelProps {
  onClose: () => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({ onClose }) => {
  const {
    queue,
    queueIndex,
    currentTrack,
    isPlaying,
    playTrack,
    removeFromQueue,
    clearQueue
  } = useMusicPlayer();

  const currentPlayingIndex = queueIndex;
  const upNextTracks = queue.slice(currentPlayingIndex + 1);

  return (
    <aside className="w-80 h-full flex flex-col border-l border-panel-border bg-bg-dark/85 select-none relative z-40">
      {/* Header */}
      <div className="p-4 border-b border-panel-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-main flex items-center gap-2">
          <ListMusic className="w-4 h-4 text-primary" /> Playing Queue
        </h2>
        <div className="flex items-center gap-2">
          {queue.length > 0 && (
            <button
              onClick={clearQueue}
              className="text-[10px] text-text-dim hover:text-red-400 font-semibold px-2 py-1 rounded hover:bg-hover-bg transition-all"
            >
              Clear
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-1 rounded text-text-dim hover:text-text-main hover:bg-hover-bg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Queue Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Currently Playing Card */}
        {currentTrack && (
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">Now Playing</span>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
              <TrackCover src={currentTrack.cover} title={currentTrack.title} artist={currentTrack.artist} album={currentTrack.album} alt={currentTrack.title} className="w-10 h-10 rounded text-xs" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs text-text-main truncate">{currentTrack.title}</div>
                <div className="text-[10px] text-primary/90 truncate mt-0.5">{currentTrack.artist}</div>
              </div>
              {isPlaying && <Volume2 className="w-4 h-4 text-primary animate-pulse" />}
            </div>
          </div>
        )}

        {/* Up Next List */}
        <div className="space-y-2.5">
          <span className="text-[10px] font-bold text-text-dim uppercase tracking-wider block">Up Next</span>
          {upNextTracks.length === 0 ? (
            <p className="text-xs text-text-dim italic py-2">Queue is empty</p>
          ) : (
            <div className="space-y-1.5">
              {upNextTracks.map((track, relativeIndex) => {
                const absoluteIndex = currentPlayingIndex + 1 + relativeIndex;
                return (
                  <div
                    key={`queue-item-${track.id}-${absoluteIndex}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-hover-bg group transition-colors cursor-pointer"
                    onClick={() => playTrack(track)}
                  >
                    <div className="relative w-8 h-8 rounded overflow-hidden shrink-0">
                      <TrackCover src={track.cover} title={track.title} artist={track.artist} album={track.album} alt={track.title} className="w-full h-full text-[10px]" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-3.5 h-3.5 fill-current text-white" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs text-text-main truncate group-hover:text-primary transition-colors">{track.title}</div>
                      <div className="text-[10px] text-text-dim truncate mt-0.5">{track.artist}</div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(track.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-text-dim hover:text-red-400 hover:bg-hover-bg transition-all shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
export default QueuePanel;

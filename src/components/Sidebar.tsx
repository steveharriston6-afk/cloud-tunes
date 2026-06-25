import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { 
  Home, 
  Disc, 
  Users, 
  Heart, 
  Sliders, 
  Plus, 
  Volume2, 
  ListMusic
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  setSelectedAlbum: (album: string | null) => void;
}

export const Sidebar = ({ currentView, setCurrentView, setSelectedAlbum }: SidebarProps) => {
  const { playlists, createPlaylist } = useMusicPlayer();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  // Automatically scroll active sidebar item into view
  useEffect(() => {
    const container = sidebarRef.current;
    if (!container) return;
    const activeEl = container.querySelector('.sidebar-active-item');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentView]);

  const handleCreatePlaylist = (e: FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    createPlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setShowAddModal(false);
  };

  const navItems = [
    { id: 'home', label: 'Listen Now', icon: Home },
    { id: 'albums', label: 'Albums', icon: Disc },
    { id: 'artists', label: 'Artists', icon: Users },
    { id: 'favorites', label: 'Favorites', icon: Heart },
    { id: 'settings', label: 'Audio DSP', icon: Sliders },
  ];

  const handleNavigate = (viewId: string) => {
    setCurrentView(viewId);
    setSelectedAlbum(null);
  };

  return (
    <div className="relative w-64 flex-shrink-0 h-full">
      <aside 
        ref={sidebarRef}
        className="w-full border-r border-panel-border bg-bg-darker/65 flex flex-col h-full overflow-y-auto overflow-x-hidden relative scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* App Branding (Static) */}
        <div className="p-6 flex items-center gap-3 flex-shrink-0 border-b border-panel-border">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-md">
            <Volume2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-display font-bold text-lg tracking-tight bg-gradient-to-r from-text-main to-text-main/70 bg-clip-text text-transparent">
              CloudTunes
            </span>
            <span className="block text-[10px] font-semibold text-primary uppercase tracking-widest leading-none">
              Lossless
            </span>
          </div>
        </div>

        {/* Navigation Library Content */}
        <div className="px-4 pt-6 pb-20 space-y-7 flex-1">
          <div className="space-y-1.5">
            <span className="px-3 text-[11px] font-semibold text-text-dim uppercase tracking-wider block">
              Library
            </span>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    tabIndex={0}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group cursor-pointer relative focus:outline-none ${
                      isActive 
                        ? 'bg-primary/[0.08] text-primary sidebar-active-item font-semibold' 
                        : 'text-text-muted hover:text-text-main hover:bg-hover-bg focus:bg-hover-bg focus:text-text-main'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-primary' : 'text-text-dim group-hover:text-text-main group-focus:text-text-main'
                    }`} />
                    
                    <span>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Playlists Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3">
              <span className="text-[11px] font-semibold text-text-dim uppercase tracking-wider">
                Playlists
              </span>
              <button 
                onClick={() => setShowAddModal(true)}
                tabIndex={0}
                className="text-text-dim hover:text-primary p-0.5 rounded transition-colors cursor-pointer focus:outline-none focus:text-primary"
                title="Create Playlist"
              >
                <Plus className="w-4.5 h-4.5" />
              </button>
            </div>

            <nav className="space-y-1">
              {playlists.length === 0 ? (
                <span className="px-3 text-xs text-text-dim italic block">
                  No playlists yet
                </span>
              ) : (
                playlists.map((playlist) => {
                  const isActive = currentView === `playlist-${playlist.id}`;
                  return (
                    <button
                      key={playlist.id}
                      onClick={() => handleNavigate(`playlist-${playlist.id}`)}
                      tabIndex={0}
                      className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm text-left transition-all cursor-pointer relative focus:outline-none ${
                        isActive 
                          ? 'bg-primary/[0.08] text-primary font-semibold' 
                          : 'text-text-muted hover:text-text-main hover:bg-hover-bg focus:bg-hover-bg focus:text-text-main'
                      }`}
                    >
                      <ListMusic className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-primary' : 'text-text-dim group-hover:text-text-main group-focus:text-text-main'
                      }`} />
                      
                      <span className="truncate">
                        {playlist.name}
                      </span>
                    </button>
                  );
                })
              )}
            </nav>
          </div>
        </div>
      </aside>

      {/* Playlist Creation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-bg-dark border border-panel-border p-6 rounded-xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <h3 className="text-lg font-display font-semibold mb-4 text-text-main">Create New Playlist</h3>
            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Playlist name"
                className="w-full px-4 py-2.5 rounded-lg text-sm bg-hover-bg border border-panel-border text-text-main focus:outline-none focus:border-primary placeholder-text-dim"
                autoFocus
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-hover-bg text-text-muted hover:bg-active-bg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-hover transition-all"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;

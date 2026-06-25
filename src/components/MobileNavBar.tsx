import React from 'react';
import { Home, Search, Library, Sliders } from 'lucide-react';

interface MobileNavBarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  setSelectedAlbum: (album: string | null) => void;
}

export const MobileNavBar: React.FC<MobileNavBarProps> = ({
  currentView,
  setCurrentView,
  setSelectedAlbum,
}) => {
  // Determine active tab
  const getActiveTab = () => {
    if (currentView === 'home') return 'home';
    if (currentView === 'search') return 'search';
    if (currentView === 'settings') return 'settings';
    return 'library'; // albums, artists, favorites, playlists fall into Library
  };

  const activeTab = getActiveTab();

  const handleTabClick = (tabId: string) => {
    setSelectedAlbum(null);
    if (tabId === 'library') {
      setCurrentView('favorites'); // Default library view is favorites
    } else {
      setCurrentView(tabId);
    }
  };

  const navItems = [
    { id: 'home', label: 'Listen Now', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'settings', label: 'Audio DSP', icon: Sliders },
  ];

  return (
    <nav className="w-full h-16 bg-bg-dark/80 border-t border-panel-border backdrop-blur-xl px-6 flex items-center justify-around select-none pb-safe">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            onClick={() => handleTabClick(item.id)}
            className="flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all"
          >
            <div className={`p-1 rounded-full transition-colors ${
              isActive ? 'text-primary' : 'text-text-muted hover:text-text-main'
            }`}>
              <Icon className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className={`text-[10px] font-semibold transition-colors ${
              isActive ? 'text-primary font-bold' : 'text-text-dim'
            }`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileNavBar;

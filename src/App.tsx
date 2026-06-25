import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { MusicPlayerProvider } from './context/MusicPlayerContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LibraryViews from './components/LibraryViews';
import BottomPlayer from './components/BottomPlayer';
import MobileNavBar from './components/MobileNavBar';
import ScrollProgress from './components/ScrollProgress';

const QueuePanel = lazy(() => import('./components/QueuePanel'));
const FullScreenPlayer = lazy(() => import('./components/FullScreenPlayer'));

function AppContent() {
  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showQueue, setShowQueue] = useState<boolean>(false);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isTV, setIsTV] = useState<boolean>(false);

  interface HistoryEntry {
    view: string;
    album: string | null;
    artist: string | null;
    scroll: number;
  }

  const [history, setHistory] = useState<HistoryEntry[]>([
    { view: 'home', album: null, artist: null, scroll: 0 }
  ]);

  const mainRef = useRef<HTMLDivElement>(null);

  const handleNavigate = (viewId: string, albumId?: string | null, artistId?: string | null) => {
    const currentScroll = mainRef.current ? mainRef.current.scrollTop : 0;
    
    let nextAlbum = albumId !== undefined ? albumId : selectedAlbum;
    let nextArtist = artistId !== undefined ? artistId : selectedArtist;
    
    const isMainTab = ['home', 'albums', 'artists', 'favorites', 'settings'].includes(viewId);
    if (isMainTab) {
      nextAlbum = null;
      nextArtist = null;
    }
    
    setHistory(prev => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          scroll: currentScroll
        };
      }
      
      const newEntry = {
        view: viewId,
        album: nextAlbum,
        artist: nextArtist,
        scroll: 0
      };
      
      if (isMainTab) {
        return [newEntry];
      }
      
      return [...updated, newEntry];
    });

    if (albumId !== undefined) {
      setSelectedAlbum(albumId);
    } else if (isMainTab) {
      setSelectedAlbum(null);
    }

    if (artistId !== undefined) {
      setSelectedArtist(artistId);
    } else if (isMainTab) {
      setSelectedArtist(null);
    }

    setCurrentView(viewId);
    
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  };

  const handleBack = () => {
    if (history.length <= 1) return;
    
    const newHistory = history.slice(0, -1);
    const target = newHistory[newHistory.length - 1];
    
    setHistory(newHistory);
    setSelectedAlbum(target.album);
    setSelectedArtist(target.artist);
    setCurrentView(target.view);
    
    setTimeout(() => {
      if (mainRef.current) {
        mainRef.current.scrollTop = target.scroll;
      }
    }, 50);
  };


  useEffect(() => {
    const checkLayout = () => {
      const tvDetected = typeof navigator !== 'undefined' && /smart[- ]?tv|googletv|appletv|hbbtv|netcast|viera|tizen|webos|jiosphere|dtv|rokutv|firetv|chromecast|android tv/i.test(navigator.userAgent);
      setIsTV(tvDetected);
      setIsMobile(window.innerWidth < 768 && !tvDetected);
    };

    checkLayout();
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, []);

  useEffect(() => {
    // 2. TV remote D-pad directional arrow key navigation
    const handleKeyDown = (event: KeyboardEvent) => {
      // Gather all elements capable of being focused on the TV
      const focusableSelector = 'button, a, [tabindex="0"]';
      const elements = Array.from(document.querySelectorAll<HTMLElement>(focusableSelector))
        .filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
        });

      let currentIndex = elements.indexOf(document.activeElement as HTMLElement);
      if (currentIndex === -1) currentIndex = 0;

      // Prevent default browser behavior to block accidental double-scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
      }

      let nextElement: HTMLElement | null = null;

      if (event.key === 'ArrowDown') {
        if (currentIndex < elements.length - 1) {
          nextElement = elements[currentIndex + 1];
        }
      } else if (event.key === 'ArrowUp') {
        if (currentIndex > 0) {
          nextElement = elements[currentIndex - 1];
        }
      }

      if (nextElement) {
        nextElement.focus();

        const container = nextElement.closest('.overflow-y-auto, main, aside') || window;
        if (container === window) {
          // Calculate precise offset position relative to the viewport
          const elementRect = nextElement.getBoundingClientRect();
          const absoluteTop = elementRect.top + window.pageYOffset;
          const middleOffset = absoluteTop - (window.innerHeight / 2);
          
          // Fallback structural scroll to ensure older TV engines move
          window.scrollTo({
            top: middleOffset,
            behavior: 'smooth'
          });
        } else {
          const containerEl = container as HTMLElement;
          const containerRect = containerEl.getBoundingClientRect();
          const elementRect = nextElement.getBoundingClientRect();
          const elementTop = elementRect.top - containerRect.top + containerEl.scrollTop;
          const middleOffset = elementTop - (containerEl.clientHeight / 2) + (elementRect.height / 2);
          
          containerEl.scrollTo({
            top: middleOffset,
            behavior: 'smooth'
          });
        }
      }
    };

    // 3. Custom virtual cursor boundary detection and edge scrolling
    let scrollInterval: any = null;
    let scrollDirection = 0;
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      const scrollZone = 50;
      const speed = 10;

      let newDirection = 0;
      if (mouseY < scrollZone) {
        newDirection = -1;
      } else if (window.innerHeight - mouseY < scrollZone) {
        newDirection = 1;
      }

      if (newDirection !== scrollDirection) {
        scrollDirection = newDirection;
        if (scrollInterval) clearInterval(scrollInterval);
        
        if (scrollDirection !== 0) {
          scrollInterval = setInterval(() => {
            const elementUnderCursor = document.elementFromPoint(mouseX, mouseY);
            const scrollContainer = elementUnderCursor?.closest('.overflow-y-auto, main, aside') || window;
            if (scrollContainer && typeof scrollContainer.scrollBy === 'function') {
              scrollContainer.scrollBy(0, scrollDirection * speed);
            } else if (scrollContainer === window) {
              window.scrollBy(0, scrollDirection * speed);
            }
          }, 30);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
      if (scrollInterval) clearInterval(scrollInterval);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-bg text-text-main relative">
      {/* Top Section: Sidebar + Main Content Area + Queue Panel */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Sidebar Navigation (Hidden on mobile) */}
        {(!isMobile || isTV) && (
          <div className="flex h-full flex-shrink-0 min-h-0">
            <Sidebar 
              currentView={currentView} 
              setCurrentView={handleNavigate} 
              setSelectedAlbum={setSelectedAlbum} 
            />
          </div>
        )}

        {/* Central Workspace */}
        <div className="flex-1 flex flex-col min-w-0 bg-bg-subtle">
          <Header 
            searchQuery={searchQuery} 
            setSearchQuery={setSearchQuery} 
            setCurrentView={handleNavigate}
            setSelectedAlbum={setSelectedAlbum}
            setSelectedArtist={setSelectedArtist}
          />

          <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto relative scroll-smooth">
            <div className="p-4 md:p-8 animate-[fadeIn_0.25s_ease-out]">
              <LibraryViews
                currentView={currentView}
                setCurrentView={handleNavigate}
                selectedAlbum={selectedAlbum}
                setSelectedAlbum={setSelectedAlbum}
                selectedArtist={selectedArtist}
                setSelectedArtist={setSelectedArtist}
                searchQuery={searchQuery}
                onBack={handleBack}
                canGoBack={history.length > 1}
                isTV={isTV}
              />
            </div>
            <ScrollProgress scrollContainerRef={mainRef} />
          </main>
        </div>

        {/* Collapsible Slide-in Queue Drawer (Desktop/Tablet) */}
        {showQueue && (
          <div className="hidden md:block h-full shrink-0 animate-[slideIn_0.2s_ease-out]">
            <Suspense fallback={<div className="w-80 h-full bg-bg border-l border-panel-border animate-pulse" />}>
              <QueuePanel onClose={() => setShowQueue(false)} />
            </Suspense>
          </div>
        )}
      </div>

      {/* Bottom Area: Docked Mini-Player and Mobile Navigation */}
      <footer className="flex-shrink-0 flex flex-col relative z-40">
        <div className="w-full">
          <BottomPlayer 
            showQueue={showQueue} 
            setShowQueue={setShowQueue} 
            setCurrentView={handleNavigate} 
            onExpand={() => setIsPlayerExpanded(true)}
          />
        </div>
        {isMobile && !isTV && (
          <div>
            <MobileNavBar 
              currentView={currentView} 
              setCurrentView={handleNavigate} 
              setSelectedAlbum={setSelectedAlbum}
            />
          </div>
        )}
      </footer>

      {/* Full Screen Slide-up Player Sheet (Active on all screen sizes when expanded) */}
      <Suspense fallback={null}>
        <FullScreenPlayer 
          isOpen={isPlayerExpanded} 
          onClose={() => setIsPlayerExpanded(false)} 
        />
      </Suspense>
    </div>
  );
}

export function App() {
  return (
    <MusicPlayerProvider>
      <AppContent />
    </MusicPlayerProvider>
  );
}

export default App;

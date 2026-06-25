import { useEffect, useState, useRef, useCallback } from 'react';

interface ScrollProgressProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export const ScrollProgress = ({ scrollContainerRef }: ScrollProgressProps) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showIndicator, setShowIndicator] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let rafId: number;

    const handleScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const maxScroll = scrollHeight - clientHeight;
        if (maxScroll <= 0) {
          setScrollProgress(0);
          setShowIndicator(false);
          return;
        }
        setScrollProgress(scrollTop / maxScroll);
        setShowIndicator(true);
      });
    };

    handleScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [scrollContainerRef]);

  const scrollUp = useCallback(() => {
    scrollContainerRef.current?.scrollBy({ top: -250, behavior: 'smooth' });
  }, [scrollContainerRef]);

  const scrollDown = useCallback(() => {
    scrollContainerRef.current?.scrollBy({ top: 250, behavior: 'smooth' });
  }, [scrollContainerRef]);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientY - rect.top) / rect.height;
    container.scrollTo({
      top: (container.scrollHeight - container.clientHeight) * percent,
      behavior: 'smooth'
    });
  };

  if (!showIndicator) return null;

  return (
    <div
      ref={containerRef}
      className="fixed right-3 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-1.5 group select-none"
    >
      <button
        onClick={scrollUp}
        className="w-6 h-6 rounded-full bg-bg-dark/70 backdrop-blur-md border border-panel-border text-text-dim hover:text-text-main hover:bg-primary hover:border-primary/40 transition-all duration-200 flex items-center justify-center cursor-pointer text-[8px] leading-none opacity-60 hover:opacity-100"
        title="Scroll up"
        aria-label="Scroll up"
      >
        ▲
      </button>

      <div
        onClick={handleTrackClick}
        className="w-1 h-36 md:h-48 rounded-full bg-hover-bg cursor-pointer relative overflow-hidden hover:bg-active-bg transition-colors duration-200 group/track"
      >
        <div
          className="absolute bottom-0 left-0 w-full rounded-full bg-gradient-to-t from-primary via-primary/80 to-primary/40 transition-all duration-150"
          style={{ height: `${scrollProgress * 100}%` }}
        />
        <div
          className="absolute left-1/2 w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(255,45,85,0.5)] border border-primary/30 transition-all duration-150 group-hover/track:scale-125"
          style={{
            bottom: `${scrollProgress * 100}%`,
            transform: `translate(-50%, 50%)`
          }}
        />
      </div>

      <button
        onClick={scrollDown}
        className="w-6 h-6 rounded-full bg-bg-dark/70 backdrop-blur-md border border-panel-border text-text-dim hover:text-text-main hover:bg-primary hover:border-primary/40 transition-all duration-200 flex items-center justify-center cursor-pointer text-[8px] leading-none opacity-60 hover:opacity-100"
        title="Scroll down"
        aria-label="Scroll down"
      >
        ▼
      </button>
    </div>
  );
};

export default ScrollProgress;

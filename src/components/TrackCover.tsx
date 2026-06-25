import { useState, useEffect, useRef, useMemo } from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { dbCache } from '../utils/dbCache';
import { generateTrackArtwork, svgToDataUri } from '../utils/artworkGenerator';

interface TrackCoverProps {
  src: string;
  title: string;
  artist?: string;
  album?: string;
  className?: string;
  alt?: string;
  format?: string;
  details?: string;
}

export const TrackCover = ({ src, title, artist, album, className = '', alt = '', format, details }: TrackCoverProps) => {
  const { tracks } = useMusicPlayer();

  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const generatedFallback = useMemo(
    () => svgToDataUri(generateTrackArtwork(title, artist || '', format, details)),
    [title, artist, format, details],
  );

  // Intersection Observer for Lazy Loading
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { rootMargin: '100px' } // Start loading 100px before entering viewport
    );

    observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  // Resolve image source paths (falls back to album or artist cover if track doesn't specify one)
  useEffect(() => {
    if (src) {
      setResolvedSrc(src);
      return;
    }

    // Tier 2: Album artwork cache
    if (album && tracks.length > 0) {
      const albumTracks = tracks.filter(t => t.album === album && t.cover);
      if (albumTracks.length > 0) {
        setResolvedSrc(albumTracks[0].cover);
        return;
      }
    }

    // Tier 3: Artist artwork cache
    if (artist && tracks.length > 0) {
      const artistTracks = tracks.filter(t => t.artist === artist && t.cover);
      if (artistTracks.length > 0) {
        setResolvedSrc(artistTracks[0].cover);
        return;
      }
    }

    setResolvedSrc(generatedFallback);
  }, [src, album, artist, tracks.length, generatedFallback]);

  // Handle IndexedDB caching
  useEffect(() => {
    if (!isVisible || !resolvedSrc) {
      setDisplaySrc(null);
      return;
    }

    if (resolvedSrc.startsWith('data:') || resolvedSrc.startsWith('blob:')) {
      setDisplaySrc(resolvedSrc);
      return;
    }

    let isMounted = true;

    const checkCacheAndFetch = async () => {
      // Check IndexedDB cache first
      const cachedBlobUrl = await dbCache.getArtwork(resolvedSrc);
      if (cachedBlobUrl && isMounted) {
        setDisplaySrc(cachedBlobUrl);
        return;
      }

      // Network fallback (first load)
      if (isMounted) {
        setDisplaySrc(resolvedSrc);
      }

      // Fetch and cache in background
      try {
        const response = await fetch(resolvedSrc);
        if (!response.ok) return;
        const blob = await response.blob();
        await dbCache.setArtwork(resolvedSrc, blob);
        const newBlobUrl = URL.createObjectURL(blob);
        if (isMounted) {
          setDisplaySrc(newBlobUrl);
        }
      } catch (err) {
        // Fallback is already displaying resolvedSrc
      }
    };

    checkCacheAndFetch();

    return () => {
      isMounted = false;
    };
  }, [resolvedSrc, isVisible]);

  const handleImageError = () => {
    if (resolvedSrc === src) {
      if (album && tracks.length > 0) {
        const albumTracks = tracks.filter(t => t.album === album && t.cover && t.cover !== src);
        if (albumTracks.length > 0) {
          setResolvedSrc(albumTracks[0].cover);
          return;
        }
      }
      if (artist && tracks.length > 0) {
        const artistTracks = tracks.filter(t => t.artist === artist && t.cover && t.cover !== src);
        if (artistTracks.length > 0) {
          setResolvedSrc(artistTracks[0].cover);
          return;
        }
      }
    }
    setResolvedSrc(null);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <img
        src={displaySrc || generatedFallback}
        alt={alt || title}
        onError={handleImageError}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
};

export default TrackCover;

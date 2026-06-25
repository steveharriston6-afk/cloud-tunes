import { useState, useMemo } from 'react';
import { generateArtistArtwork, svgToDataUri } from '../utils/artworkGenerator';

interface ArtistAvatarProps {
  name: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

const sizeMap: Record<string, string> = {
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-full h-full',
  xl: 'w-28 h-28',
  '2xl': 'w-48 h-48',
};

export const ArtistAvatar = ({ name, imageUrl, size = 'md', className = '' }: ArtistAvatarProps) => {
  const [hasError, setHasError] = useState(false);

  const fallbackArtwork = useMemo(
    () => svgToDataUri(generateArtistArtwork(name)),
    [name],
  );

  const showImage = imageUrl && !hasError;

  return (
    <div
      className={`flex items-center justify-center font-bold font-display select-none rounded-full overflow-hidden relative ${sizeMap[size]} ${className}`}
      title={name}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover transition-opacity duration-300"
          onError={() => setHasError(true)}
        />
      ) : (
        <img
          src={fallbackArtwork}
          alt={name}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
};

export default ArtistAvatar;

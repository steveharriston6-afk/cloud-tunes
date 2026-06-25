export interface ArtistColorScheme {
  from: string;
  to: string;
}

const gradientPairs: { from: string; to: string }[] = [
  { from: '#7c3aed', to: '#ec4899' },
  { from: '#3b82f6', to: '#06b6d4' },
  { from: '#f97316', to: '#ef4444' },
  { from: '#10b981', to: '#14b8a6' },
  { from: '#6366f1', to: '#8b5cf6' },
  { from: '#f59e0b', to: '#d97706' },
  { from: '#d946ef', to: '#f43f5e' },
  { from: '#059669', to: '#0d9488' },
  { from: '#a855f7', to: '#6366f1' },
  { from: '#ef4444', to: '#f97316' },
  { from: '#0ea5e9', to: '#22c55e' },
  { from: '#eab308', to: '#ef4444' },
];

export function getArtistColors(artistName: string): ArtistColorScheme {
  let hash = 0;
  const name = artistName.trim().toLowerCase();
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % gradientPairs.length;
  return gradientPairs[index];
}

export function getArtistInitials(artistName: string): string {
  const parts = artistName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return parts.slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }
  const name = parts[0] || '';
  if (name.length <= 2) return name.toUpperCase();
  let initials = '';
  for (const char of name) {
    if (char >= 'A' && char <= 'Z') initials += char;
  }
  return initials.slice(0, 2) || name.slice(0, 2).toUpperCase();
}

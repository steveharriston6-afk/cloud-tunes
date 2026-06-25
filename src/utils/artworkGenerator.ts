const COLORS = {
  accent: ['#7c3aed', '#ec4899'],
  accent2: ['#3b82f6', '#06b6d4'],
  accent3: ['#f97316', '#ef4444'],
  accent4: ['#10b981', '#14b8a6'],
  accent5: ['#6366f1', '#8b5cf6'],
  accent6: ['#f59e0b', '#d97706'],
  accent7: ['#d946ef', '#f43f5e'],
  accent8: ['#059669', '#0d9488'],
  accent9: ['#a855f7', '#6366f1'],
  accent10: ['#ef4444', '#f97316'],
  accent11: ['#0ea5e9', '#22c55e'],
  accent12: ['#eab308', '#ef4444'],
  accent13: ['#06b6d4', '#8b5cf6'],
  accent14: ['#f43f5e', '#eab308'],
  accent15: ['#14b8a6', '#6366f1'],
} as const;

const palettes = Object.values(COLORS);

function hashString(str: string): number {
  let hash = 0;
  const s = str.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function getDeterministicIndex(key: string, max: number): number {
  return hashString(key) % max;
}

export function getDeterministicPalette(key: string): readonly [string, string] {
  return palettes[getDeterministicIndex(key, palettes.length)];
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── 15 Premium SVG Template Backgrounds ───────────────────────

function templateNeonGradient(idx: number, [c1, c2]: readonly [string, string]): string {
  const id = `bg-${idx}`;
  return `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="${c1}" stop-opacity="0.9"/>
    <stop offset="50%" stop-color="${c2}" stop-opacity="0.7"/>
    <stop offset="100%" stop-color="${c1}" stop-opacity="0.95"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#${id})"/>
  <circle cx="80%" cy="20%" r="40%" fill="${c2}" opacity="0.3"/>
  <circle cx="20%" cy="80%" r="30%" fill="${c1}" opacity="0.25"/>`;
}

function templateGlassmorphism(idx: number, [c1]: readonly [string, string]): string {
  const id = `bg-${idx}`;
  return `<defs>
    <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1a2e"/>
      <stop offset="50%" stop-color="#16213e"/>
      <stop offset="100%" stop-color="#0f3460"/>
    </linearGradient>
    <radialGradient id="glow-${idx}"><stop offset="0%" stop-color="${c1}" stop-opacity="0.4"/><stop offset="100%" stop-color="${c1}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#${id})"/>
  <rect x="10%" y="10%" width="80%" height="80%" rx="8%" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
  <circle cx="50%" cy="50%" r="45%" fill="url(#glow-${idx})"/>`;
}

function templateVinylRecord(idx: number, [c1, c2]: readonly [string, string]): string {
  return `<defs><linearGradient id="bg-${idx}" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#1a1a1a"/><stop offset="100%" stop-color="#0d0d0d"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#bg-${idx})"/>
  <circle cx="50%" cy="50%" r="38%" fill="#111" stroke="#222" stroke-width="1"/>
  <circle cx="50%" cy="50%" r="35%" fill="none" stroke="#222" stroke-width="0.5"/>
  <circle cx="50%" cy="50%" r="28%" fill="none" stroke="#222" stroke-width="0.5"/>
  <circle cx="50%" cy="50%" r="21%" fill="none" stroke="#222" stroke-width="0.5"/>
  <circle cx="50%" cy="50%" r="14%" fill="none" stroke="#222" stroke-width="0.5"/>
  <circle cx="50%" cy="50%" r="8%" fill="${c1}"/>
  <circle cx="50%" cy="50%" r="4%" fill="${c2}"/>`;
}

function templateAudiophile(idx: number, [c1, c2]: readonly [string, string]): string {
  const id = `bg-${idx}`;
  return `<defs>
    <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0a0f"/><stop offset="100%" stop-color="#1a0a2e"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#${id})"/>
  <text x="50%" y="48%" font-family="system-ui" font-size="40" font-weight="900" fill="${c1}" opacity="0.12" text-anchor="middle" dominant-baseline="middle">♪</text>
  <rect x="15%" y="65%" width="70%" height="2" rx="1" fill="${c2}" opacity="0.15"/>
  <rect x="20%" y="70%" width="60%" height="1" rx="0.5" fill="${c2}" opacity="0.1"/>`;
}

function templateHiResAudio(idx: number, [c1, c2]: readonly [string, string]): string {
  const id = `bg-${idx}`;
  return `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#0f0f23"/><stop offset="100%" stop-color="#1a0a2e"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#${id})"/>
  <rect x="20%" y="25%" width="60%" height="1.5" rx="0.75" fill="${c1}" opacity="0.15"/>
  <rect x="25%" y="35%" width="50%" height="1.5" rx="0.75" fill="${c1}" opacity="0.1"/>
  <rect x="30%" y="45%" width="40%" height="1.5" rx="0.75" fill="${c1}" opacity="0.08"/>
  <rect x="20%" y="55%" width="60%" height="1.5" rx="0.75" fill="${c2}" opacity="0.1"/>
  <rect x="25%" y="65%" width="50%" height="1.5" rx="0.75" fill="${c2}" opacity="0.08"/>`;
}

function templateMinimalMonochrome(idx: number, _: readonly [string, string]): string {
  return `<defs><linearGradient id="bg-${idx}" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#1a1a1a"/><stop offset="100%" stop-color="#2a2a2a"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#bg-${idx})"/>
  <line x1="15%" y1="30%" x2="85%" y2="30%" stroke="#fff" stroke-width="0.5" opacity="0.05"/>
  <line x1="15%" y1="70%" x2="85%" y2="70%" stroke="#fff" stroke-width="0.5" opacity="0.05"/>
  <circle cx="50%" cy="50%" r="25%" fill="none" stroke="#fff" stroke-width="0.5" opacity="0.04"/>`;
}

function templateAbstractWaveforms(idx: number, [c1, c2]: readonly [string, string]): string {
  const id = `bg-${idx}`;
  return `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#0d0d1a"/><stop offset="100%" stop-color="#1a0d0d"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#${id})"/>
  <path d="M0,70 Q15,30 30,70 T60,70 T90,70 T120,70 L120,100 L0,100Z" fill="${c1}" opacity="0.08"/>
  <path d="M0,75 Q15,45 30,75 T60,75 T90,75 T120,75 L120,100 L0,100Z" fill="${c2}" opacity="0.06"/>
  <path d="M0,80 Q15,55 30,80 T60,80 T90,80 T120,80 L120,100 L0,100Z" fill="${c1}" opacity="0.04"/>`;
}

function templateSpectrumAnalyzer(idx: number, [c1, c2]: readonly [string, string]): string {
  const id = `bg-${idx}`;
  const bars = [10, 25, 40, 55, 70, 85, 100, 85, 70, 55, 40, 25, 10];
  const barSvgs = bars.map((h, i) =>
    `<rect x="${6 + i * 7.3}%" y="${100 - h * 0.55}%" width="4.5%" height="${h * 0.55}%" rx="2" fill="${i % 2 === 0 ? c1 : c2}" opacity="${0.06 + (h / 100) * 0.08}"/>`
  ).join('');
  return `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#050510"/><stop offset="100%" stop-color="#100505"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#${id})"/>${barSvgs}`;
}

function templateNightCityLights(idx: number, [c1, c2]: readonly [string, string]): string {
  const id = `bg-${idx}`;
  const buildings = Array.from({ length: 14 }, (_, i) => {
    const x = 2 + i * 7;
    const w = 4 + (i % 3) * 2;
    const h = 30 + (hashString(String(i * 7 + idx)) % 50);
    const lit = hashString(String(i * 13 + idx)) % 3 !== 0;
    return `<rect x="${x}%" y="${100 - h}%" width="${w}%" height="${h}%" fill="#1a1a2e" stroke="#222" stroke-width="0.3"/>${
      lit ? `<rect x="${x + 0.5}%" y="${100 - h + 3}%" width="${w - 1}%" height="3%" fill="${c1}" opacity="0.2" rx="0.5"/>` : ''
    }${lit ? `<rect x="${x + 1}%" y="${100 - h + 8}%" width="${w - 2}%" height="3%" fill="${c2}" opacity="0.15" rx="0.5"/>` : ''}`;
  }).join('');
  return `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#050510"/><stop offset="100%" stop-color="#0a0515"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#${id})"/>${buildings}`;
}

function templateSynthwave(idx: number, [c1, c2]: readonly [string, string]): string {
  const id = `bg-${idx}`;
  return `<defs>
    <linearGradient id="${id}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0a0015"/><stop offset="50%" stop-color="#150a2e"/><stop offset="100%" stop-color="#0a0015"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#${id})"/>
  <circle cx="50%" cy="35%" r="15%" fill="none" stroke="${c1}" stroke-width="2" opacity="0.15"/>
  <circle cx="50%" cy="35%" r="12%" fill="none" stroke="${c1}" stroke-width="1.5" opacity="0.1"/>
  <circle cx="50%" cy="35%" r="9%" fill="none" stroke="${c2}" stroke-width="1" opacity="0.08"/>
  <line x1="20%" y1="65%" x2="80%" y2="65%" stroke="${c1}" stroke-width="0.5" opacity="0.08"/>
  <line x1="25%" y1="72%" x2="75%" y2="72%" stroke="${c2}" stroke-width="0.5" opacity="0.06"/>
  <line x1="30%" y1="79%" x2="70%" y2="79%" stroke="${c1}" stroke-width="0.5" opacity="0.04"/>`;
}

function templateAmbientTextures(idx: number, [c1, c2]: readonly [string, string]): string {
  const id = `bg-${idx}`;
  const circles = Array.from({ length: 8 }, (_, i) => {
    const r = 15 + (i * 7) % 30;
    const x = 20 + (i * 23) % 60;
    const y = 20 + (i * 17) % 60;
    return `<circle cx="${x}%" cy="${y}%" r="${r}%" fill="${i % 2 === 0 ? c1 : c2}" opacity="${0.03 + i * 0.005}"/>`;
  }).join('');
  return `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0d0d0d"/><stop offset="100%" stop-color="#1a1a1a"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#${id})"/>${circles}`;
}

function templateElegantGeometric(idx: number, [c1, c2]: readonly [string, string]): string {
  const id = `bg-${idx}`;
  return `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#0f0f1a"/><stop offset="100%" stop-color="#1a0f1a"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#${id})"/>
  <polygon points="30,20 70,20 80,60 20,60" fill="none" stroke="${c1}" stroke-width="0.5" opacity="0.08"/>
  <polygon points="35,30 65,30 72,55 28,55" fill="none" stroke="${c2}" stroke-width="0.5" opacity="0.06"/>
  <polygon points="40,40 60,40 64,50 36,50" fill="none" stroke="${c1}" stroke-width="0.5" opacity="0.04"/>`;
}

function templatePremiumGold(idx: number, _: readonly [string, string]): string {
  const id = `bg-${idx}`;
  return `<defs>
    <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1500"/><stop offset="50%" stop-color="#2a2000"/><stop offset="100%" stop-color="#1a1500"/>
    </linearGradient>
    <linearGradient id="gold-${idx}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.3"/>
      <stop offset="50%" stop-color="#eab308" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#d97706" stop-opacity="0.3"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#${id})"/>
  <rect x="10%" y="10%" width="80%" height="80%" rx="5%" fill="url(#gold-${idx})"/>
  <rect x="15%" y="15%" width="70%" height="70%" rx="3%" fill="none" stroke="#f59e0b" stroke-width="0.5" opacity="0.1"/>`;
}

function templateStudioMonitor(idx: number, [c1, c2]: readonly [string, string]): string {
  const id = `bg-${idx}`;
  return `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#0d0d1a"/><stop offset="100%" stop-color="#1a1a2e"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#${id})"/>
  <rect x="20%" y="20%" width="60%" height="45%" rx="4%" fill="#0a0a15" stroke="#333" stroke-width="0.5"/>
  <rect x="22%" y="22%" width="56%" height="41%" rx="2%" fill="#050510"/>
  <rect x="45%" y="67%" width="10%" height="3%" rx="1" fill="#333"/>
  <rect x="42%" y="70%" width="16%" height="2%" rx="1" fill="#222"/>
  <line x1="30%" y1="30%" x2="70%" y2="30%" stroke="${c1}" stroke-width="1" opacity="0.12"/>
  <line x1="30%" y1="38%" x2="65%" y2="38%" stroke="${c1}" stroke-width="0.8" opacity="0.08"/>
  <line x1="30%" y1="46%" x2="50%" y2="46%" stroke="${c2}" stroke-width="0.8" opacity="0.06"/>
  <line x1="30%" y1="54%" x2="60%" y2="54%" stroke="${c2}" stroke-width="0.5" opacity="0.05"/>`;
}

function templateDarkCarbonFiber(idx: number, _: readonly [string, string]): string {
  const id = `bg-${idx}`;
  const patternId = `carbon-${idx}`;
  return `<defs>
    <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#111"/><stop offset="100%" stop-color="#1a1a1a"/>
    </linearGradient>
    <pattern id="${patternId}" width="10" height="10" patternUnits="userSpaceOnUse">
      <path d="M0,5 L5,0 L10,5 L5,10Z" fill="none" stroke="#222" stroke-width="0.3"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#${id})"/>
  <rect width="100%" height="100%" fill="url(#${patternId})" opacity="0.5"/>`;
}

const templateFns = [
  templateNeonGradient,
  templateGlassmorphism,
  templateVinylRecord,
  templateAudiophile,
  templateHiResAudio,
  templateMinimalMonochrome,
  templateAbstractWaveforms,
  templateSpectrumAnalyzer,
  templateNightCityLights,
  templateSynthwave,
  templateAmbientTextures,
  templateElegantGeometric,
  templatePremiumGold,
  templateStudioMonitor,
  templateDarkCarbonFiber,
];

// ─── Artwork Generation ────────────────────────────────────────

export function generateTrackArtwork(
  title: string,
  artist: string,
  format?: string,
  details?: string,
): string {
  const key = `${title}|${artist}`;
  const idx = getDeterministicIndex(key, templateFns.length);
  const palette = getDeterministicPalette(key);
  const bgSvg = templateFns[idx](idx, palette);

  const safeTitle = escapeXml(title || 'Unknown');
  const safeArtist = escapeXml(artist || 'Unknown Artist');

  const qualityBadge = details ? escapeXml(details) : format ? escapeXml(format) : '';

  const fontSize = safeTitle.length > 20 ? 14 : safeTitle.length > 10 ? 18 : 22;
  const artistFontSize = safeArtist.length > 20 ? 10 : 12;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    ${bgSvg}
    <rect x="0" y="0" width="400" height="400" fill="url(#overlay-${idx})"/>
    <defs>
      <linearGradient id="overlay-${idx}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="60%" stop-color="#000" stop-opacity="0"/>
        <stop offset="95%" stop-color="#000" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.7"/>
      </linearGradient>
    </defs>
    <text x="24" y="334" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="${fontSize}" fill="#fff" letter-spacing="0.3">${safeTitle}</text>
    <text x="24" y="356" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="${artistFontSize}" fill="rgba(255,255,255,0.65)" letter-spacing="0.2">${safeArtist}</text>
    ${qualityBadge ? `<rect x="24" y="368" width="${qualityBadge.length * 6.5 + 16}" height="18" rx="4" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" stroke-width="0.5"/>
    <text x="32" y="381" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="9" fill="rgba(255,255,255,0.8)" letter-spacing="0.5">${qualityBadge}</text>` : ''}
  </svg>`;
}

export function generateArtistArtwork(name: string): string {
  const palette = getDeterministicPalette(name);
  const initials = getInitials(name);
  const [c1, c2] = palette;
  const id = `artist-${hashString(name) % 1000}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <defs>
      <radialGradient id="${id}" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stop-color="${c1}" stop-opacity="0.9"/>
        <stop offset="70%" stop-color="${c2}" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="${c2}" stop-opacity="1"/>
      </radialGradient>
    </defs>
    <rect width="200" height="200" rx="100" fill="url(#${id})"/>
    <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
    <text x="100" y="105" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="${initials.length <= 2 ? 56 : 40}" fill="#fff" text-anchor="middle" dominant-baseline="middle" letter-spacing="2">${escapeXml(initials)}</text>
  </svg>`;
}

export function generatePlaylistMosaic(
  title: string,
  covers: (string | null)[],
): string {
  if (covers.length >= 4 && covers.filter(Boolean).length === 4) {
    const cells = covers.map((c, i) => {
      if (!c) return '';
      const x = i % 2 === 0 ? 0 : 200;
      const y = i < 2 ? 0 : 200;
      return `<image x="${x}" y="${y}" width="200" height="200" href="${escapeXml(c)}" preserveAspectRatio="cover"/>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
      <defs><clipPath id="mc"><rect width="400" height="400" rx="8"/></clipPath></defs>
      <g clip-path="url(#mc)">${cells}</g>
    </svg>`;
  }

  const palette = getDeterministicPalette(title);
  const idx = getDeterministicIndex(title, templateFns.length);
  const bgSvg = templateFns[idx](hashString(title) % 1000, palette);
  const safeTitle = escapeXml(title || 'Playlist');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    ${bgSvg}
    <rect x="0" y="0" width="400" height="400" fill="url(#playlist-overlay-${idx})"/>
    <defs>
      <linearGradient id="playlist-overlay-${idx}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="50%" stop-color="#000" stop-opacity="0"/>
        <stop offset="90%" stop-color="#000" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.7"/>
      </linearGradient>
    </defs>
    <text x="200" y="340" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="20" fill="#fff" text-anchor="middle" letter-spacing="0.3">${safeTitle}</text>
    <text x="200" y="365" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="11" fill="rgba(255,255,255,0.5)" text-anchor="middle">Playlist</text>
  </svg>`;
}

// ─── SVG to Data URI ───────────────────────────────────────────

export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

interface DspIconProps {
  name: string;
  className?: string;
}

export const DspIcon = ({ name, className = "w-4 h-4" }: DspIconProps) => {
  const baseSvgProps = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  switch (name.toLowerCase()) {
    case 'original': // Studio Mode / Bit-Perfect
      return (
        <svg {...baseSvgProps}>
          {/* Studio Monitor Speaker */}
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <circle cx="12" cy="8" r="2" />
          <circle cx="12" cy="15" r="3.5" />
          <circle cx="12" cy="15" r="1" />
        </svg>
      );

    case 'bass': // Bass Boost
      return (
        <svg {...baseSvgProps}>
          {/* Subwoofer cabinet with expanding low frequencies */}
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 9a3 3 0 0 0 0 6" />
          <path d="M6 18h.01M18 18h.01" />
        </svg>
      );

    case 'vocal': // Vocal Enhancement / Vocal Boost
      return (
        <svg {...baseSvgProps}>
          {/* Condenser microphone */}
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="9" y1="22" x2="15" y2="22" />
        </svg>
      );

    case 'wide': // Wide Stereo
      return (
        <svg {...baseSvgProps}>
          {/* Bidirectional Haas expansion arrows with speaker cones */}
          <path d="M8 7L3 12l5 5M16 7l5 5-5 5" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <path d="M12 8v8" />
        </svg>
      );

    case '8d': // 8D Audio
      return (
        <svg {...baseSvgProps}>
          {/* Orbital path around head */}
          <ellipse cx="12" cy="12" rx="9" ry="5" transform="rotate(-15 12 12)" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <path d="M20 9.5a1 1 0 0 1-1-1v-2" />
          <path d="M4 14.5a1 1 0 0 1 1 1v2" />
        </svg>
      );

    case '360': // 360 Audio
      return (
        <svg {...baseSvgProps}>
          {/* Globe representation for spherical HRTF */}
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          <path d="M2 12h20" />
        </svg>
      );

    case 'spatial': // Spatial Audio
      return (
        <svg {...baseSvgProps}>
          {/* Headphone with acoustic surround fields */}
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <rect x="21" y="14" width="2" height="4" rx="1" />
          <rect x="1" y="14" width="2" height="4" rx="1" />
          <path d="M6 12a6 6 0 0 1 12 0" />
        </svg>
      );

    case 'surround': // Virtual Surround
      return (
        <svg {...baseSvgProps}>
          {/* Multi-angle sound projection */}
          <path d="M12 3v18" />
          <path d="M17 6.5a7.5 7.5 0 0 1 0 11" />
          <path d="M7 6.5a7.5 7.5 0 0 0 0 11" />
          <path d="M21 9a11.5 11.5 0 0 1 0 6" />
          <path d="M3 9a11.5 11.5 0 0 0 0 6" />
        </svg>
      );

    case 'cinema': // Cinema Mode
      return (
        <svg {...baseSvgProps}>
          {/* Wide format screen and projection ray */}
          <rect x="3" y="5" width="18" height="10" rx="1" />
          <path d="M6 19l2-4h8l2 4" />
          <line x1="3" y1="12" x2="21" y2="12" strokeWidth="1" strokeDasharray="2 2" />
        </svg>
      );

    case 'lofi': // Lo-Fi Chill
      return (
        <svg {...baseSvgProps}>
          {/* Vintage compact cassette tape */}
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8" cy="12" r="2" />
          <circle cx="16" cy="12" r="2" />
          <path d="M6 16h12" />
          <path d="M10 12h4" />
        </svg>
      );

    case 'night': // Night Mode
      return (
        <svg {...baseSvgProps}>
          {/* Crescent moon with soft dampening wave */}
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          <path d="M19 19h2M15 19h1" strokeWidth="1.2" />
        </svg>
      );

    case 'lossless': // Lossless Playback Badge
      return (
        <svg {...baseSvgProps}>
          {/* Audiophile Diamond Badge */}
          <path d="M12 2L2 12l10 10 10-10L12 2z" />
          <path d="M12 6l6 6-6 6-6-6 6-6z" strokeWidth="1" />
        </svg>
      );

    case 'hires': // High Resolution Badge
      return (
        <svg {...baseSvgProps}>
          {/* High-res spectrum waves */}
          <path d="M4 10v4M8 6v12M12 3v18M16 8v8M20 11v2" />
          <circle cx="16" cy="4" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );

    case 'equalizer': // Equalizer Sliders
      return (
        <svg {...baseSvgProps}>
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <circle cx="4" cy="12" r="2" />
          <circle cx="12" cy="10" r="2" />
          <circle cx="20" cy="14" r="2" />
        </svg>
      );

    case 'effects': // Audio Effects
      return (
        <svg {...baseSvgProps}>
          <path d="M12 2v20M17 5v14M22 9v6M7 7v10M2 11v2" />
        </svg>
      );

    case 'quality': // Streaming Quality / Signal strength
      return (
        <svg {...baseSvgProps}>
          <path d="M12 20h.01M8 20h.01M16 20h.01M4 20h.01M20 20h.01M12 16c2-2 5-2 7 0M5 16c2-2 5-2 7 0M12 12c4.5-4.5 9.5-4.5 14 0" />
        </svg>
      );

    default:
      return (
        <svg {...baseSvgProps}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
};

export default DspIcon;

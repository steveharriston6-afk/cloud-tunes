import type { ChangeEvent } from 'react';
import type { EffectMode } from '../audio/AudioEngine';
import { EFFECT_CATEGORIES, EFFECT_META } from '../audio/AudioEngine';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { Visualizer } from './Visualizer';
import { DspIcon } from './DspIcons';
import { 
  Sparkles, 
  Settings, 
  Info,
  Sliders,
  Check,
  Headphones,
  Globe,
  Theater
} from 'lucide-react';

interface CategorySection {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  modes: EffectMode[];
  accentClass: string;
}

export const DspSettings = () => {
  const {
    isPlaying,
    currentTrack,
    effectMode,
    setEffectMode,
    spatialSettings,
    updateSpatialSettings
  } = useMusicPlayer();

  const categories: CategorySection[] = [
    {
      key: 'main',
      title: 'Core Effects',
      subtitle: 'Essential audio enhancement modes',
      icon: <Sparkles className="w-4.5 h-4.5" />,
      modes: EFFECT_CATEGORIES.main,
      accentClass: 'text-primary',
    },
    {
      key: 'immersive',
      title: 'Immersive & 3D',
      subtitle: '360° spatial and head-tracked audio',
      icon: <Globe className="w-4.5 h-4.5" />,
      modes: EFFECT_CATEGORIES.immersive,
      accentClass: 'text-cyan-400',
    },
    {
      key: 'environment',
      title: 'Environment & Mood',
      subtitle: 'Room simulation and listening modes',
      icon: <Theater className="w-4.5 h-4.5" />,
      modes: EFFECT_CATEGORIES.environment,
      accentClass: 'text-purple-400',
    },
  ];

  const handleModeChange = (mode: EffectMode) => {
    setEffectMode(mode);
  };

  const handleIntensityChange = (e: ChangeEvent<HTMLInputElement>) => {
    updateSpatialSettings({ intensity: parseFloat(e.target.value) });
  };

  const handleHeightChange = (e: ChangeEvent<HTMLInputElement>) => {
    updateSpatialSettings({ height: parseFloat(e.target.value) });
  };

  const handleRoomSizeChange = (size: 'Small' | 'Medium' | 'Large') => {
    updateSpatialSettings({ roomSize: size });
  };

  const handleToggleSpatial = () => {
    updateSpatialSettings({ spatialEnabled: !spatialSettings.spatialEnabled });
  };

  const showAdvancedControls = effectMode !== 'Original' && 
                               effectMode !== 'Vocal Boost' && 
                               effectMode !== 'Bass Boost' &&
                               effectMode !== 'Night Mode' &&
                               effectMode !== 'Lo-Fi';

  const getCategoryAccent = (mode: EffectMode): string => {
    if (EFFECT_CATEGORIES.immersive.includes(mode)) return 'border-cyan-500 shadow-cyan-500/15';
    if (EFFECT_CATEGORIES.environment.includes(mode)) return 'border-purple-500 shadow-purple-500/15';
    return 'border-primary shadow-primary-glow/10';
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto select-none">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-text-main tracking-tight flex items-center gap-2.5">
            <Sliders className="text-primary w-8 h-8" />
            Audio DSP & Effects
          </h1>
          <p className="text-sm text-text-dim mt-1">
            Real-time audio enhancement — zero-latency hot-swap engine.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold text-green-400">Live DSP</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Columns: Mode Categories (2/3) */}
        <div className="md:col-span-2 space-y-6">
          {categories.map((cat) => (
            <div key={cat.key} className="bg-bg-subtle p-5 rounded-xl space-y-3.5">
              <div className="flex items-center gap-2 mb-1">
                <span className={cat.accentClass}>{cat.icon}</span>
                <div>
                  <h2 className="text-sm font-semibold text-text-main">{cat.title}</h2>
                  <p className="text-[11px] text-text-dim">{cat.subtitle}</p>
                </div>
              </div>
              <div className={`grid gap-2.5 ${cat.modes.length <= 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                {cat.modes.map((modeName) => {
                  const meta = EFFECT_META[modeName];
                  const isActive = effectMode === modeName;
                  return (
                    <button
                      key={modeName}
                      onClick={() => handleModeChange(modeName)}
                      className={`text-left p-3.5 rounded-xl transition-all duration-200 cursor-pointer relative group ${
                        isActive 
                          ? `bg-gradient-to-br from-hover-bg to-active-bg ${getCategoryAccent(modeName)}` 
                          : 'bg-bg-subtle hover:bg-hover-bg'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5">
                          <DspIcon name={meta.icon} className="w-4.5 h-4.5 text-text-main" />
                          <span className="font-semibold text-xs text-text-main leading-tight">{meta.label}</span>
                        </div>
                        {isActive && (
                          <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 text-white stroke-[3px]" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-text-dim mt-1.5 line-clamp-2 leading-relaxed">
                        {meta.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Visualizer & Live Details (1/3) */}
        <div className="space-y-6">
          {/* Real-time visualizer canvas */}
          <div className="bg-bg-subtle p-6 rounded-xl flex flex-col h-64 space-y-4">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-text-muted tracking-wider uppercase">Live Spectrum</span>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            <div className="flex-1 min-h-0">
              <Visualizer isPlaying={isPlaying} activeColor={effectMode === 'Original' ? 'primary' : 'gradient'} />
            </div>
          </div>

          {/* Active Audio Mode Info */}
          <div className="bg-bg-subtle p-6 rounded-xl space-y-4">
            <h3 className="text-sm font-semibold text-text-muted tracking-wider uppercase flex items-center gap-1.5">
              <Info className="w-4 h-4 text-text-dim" /> Processing Stats
            </h3>
            <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5">
                <span className="text-text-dim">Lossless Pipeline</span>
                <span className={currentTrack?.format === 'FLAC' ? 'text-green-400 font-semibold' : 'text-text-muted'}>
                  {currentTrack?.format === 'FLAC' ? 'Active (Hi-Res)' : 'Standard'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-text-dim">Effect Mode</span>
                <span className="text-text-main font-semibold flex items-center gap-1.5">
                  <DspIcon name={EFFECT_META[effectMode]?.icon || 'original'} className="w-4 h-4 text-text-main" /> {effectMode}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-text-dim">Gain Staging</span>
                <span className="text-green-400 font-semibold">
                  {effectMode === 'Original' ? 'Bypass' : 'Headroom-Managed'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-text-dim">Peak Limiter</span>
                <span className={effectMode !== 'Original' ? 'text-green-400 font-semibold' : 'text-text-dim'}>
                  {effectMode !== 'Original' ? 'Brickwall −1dB ✓' : 'Not needed'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-text-dim">Processing</span>
                <span className="text-text-muted font-mono">
                  {effectMode !== 'Original' ? '32-bit float / 48kHz' : 'Native passthrough'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-text-dim">Switch Latency</span>
                <span className="text-green-400 font-mono font-bold">0ms</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-text-dim">Clipping Risk</span>
                <span className="text-green-400 font-semibold">None ✓</span>
              </div>
            </div>
          </div>

          {/* Best with headphones notice */}
          {EFFECT_CATEGORIES.immersive.includes(effectMode) && (
            <div className="p-4 rounded-xl bg-cyan-500/5">
              <div className="flex items-center gap-2 text-cyan-400">
                <Headphones className="w-4 h-4" />
                <span className="text-xs font-semibold">Best experienced with headphones</span>
              </div>
              <p className="text-[10px] text-text-dim mt-1">
                HRTF-based spatial effects require stereo headphones for full 3D immersion.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className={`transition-all duration-300 ${showAdvancedControls ? 'opacity-100 transform translate-y-0' : 'opacity-40 pointer-events-none'}`}>
        <div className="bg-bg-subtle p-6 rounded-xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-main flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Advanced Controls & Tuning
              </h2>
              <p className="text-xs text-text-dim mt-0.5">Adjust coordinates, delays, and intensity of the spatial matrix.</p>
            </div>
            <button 
              onClick={handleToggleSpatial}
              disabled={effectMode === 'Original'}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                spatialSettings.spatialEnabled 
                  ? 'bg-primary/20 text-primary' 
                  : 'bg-hover-bg text-text-muted'
              }`}
            >
              Spatial DSP: {spatialSettings.spatialEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-2">
            {/* Intensity Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-text-muted">Spatial Intensity</span>
                <span className="font-mono text-primary font-bold">{(spatialSettings.intensity * 100).toFixed(0)}%</span>
              </div>
              <input 
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={spatialSettings.intensity}
                onChange={handleIntensityChange}
                disabled={!spatialSettings.spatialEnabled || effectMode === 'Original'}
                className="w-full accent-primary"
              />
              <span className="text-[10px] text-text-dim block">Scales delay sizes and cross-feed volume levels.</span>
            </div>

            {/* Height Slider */}
            <div className={`space-y-2 transition-opacity ${effectMode === 'Spatial Audio' || effectMode === '360 Audio' ? 'opacity-100' : 'opacity-30'}`}>
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-text-muted">Height Effect (3D Y-Axis)</span>
                <span className="font-mono text-primary font-bold">{(spatialSettings.height * 10).toFixed(1)}m</span>
              </div>
              <input 
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={spatialSettings.height}
                onChange={handleHeightChange}
                disabled={!spatialSettings.spatialEnabled || (effectMode !== 'Spatial Audio' && effectMode !== '360 Audio')}
                className="w-full accent-primary"
              />
              <span className="text-[10px] text-text-dim block">Applies virtual soundstage elevation heights.</span>
            </div>

            {/* Room Size Selector */}
            <div className={`space-y-3.5 transition-opacity ${effectMode === 'Cinema Mode' ? 'opacity-100' : 'opacity-30'}`}>
              <span className="text-xs font-semibold text-text-muted block">Simulated Room Size</span>
              <div className="flex gap-2">
                {(['Small', 'Medium', 'Large'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => handleRoomSizeChange(size)}
                    disabled={!spatialSettings.spatialEnabled || effectMode !== 'Cinema Mode'}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      spatialSettings.roomSize === size 
                        ? 'bg-primary text-white' 
                        : 'bg-hover-bg text-text-muted hover:bg-active-bg'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-text-dim block">Sets the acoustic reflection delay boundary limits.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default DspSettings;

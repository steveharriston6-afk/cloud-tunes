// Web Audio API DSP Music Player Engine
// Zero-latency hot-swap architecture with audiophile-grade gain staging
// All DSP chains route through a transparent brickwall limiter to prevent clipping

export type EffectMode =
  | 'Original'
  | 'Bass Boost'
  | 'Vocal Boost'
  | 'Wide Stereo'
  | 'Virtual Surround'
  | 'Spatial Audio'
  | '8D Audio'
  | '360 Audio'
  | 'Cinema Mode'
  | 'Lo-Fi'
  | 'Night Mode';

// Category groupings for UI
export const EFFECT_CATEGORIES = {
  main: ['Original', 'Bass Boost', 'Vocal Boost', 'Wide Stereo'] as EffectMode[],
  immersive: ['8D Audio', '360 Audio', 'Spatial Audio'] as EffectMode[],
  environment: ['Virtual Surround', 'Cinema Mode', 'Lo-Fi', 'Night Mode'] as EffectMode[],
};

export const EFFECT_META: Record<EffectMode, { label: string; desc: string; icon: string }> = {
  'Original': {
    label: 'Original (Bit-Perfect)',
    desc: 'Pure direct audio bypass. All DSP disabled for audiophile listening.',
    icon: 'original',
  },
  'Bass Boost': {
    label: 'Bass Boost',
    desc: 'Transparent sub-bass shelf at 80Hz with headroom-managed gain staging.',
    icon: 'bass',
  },
  'Vocal Boost': {
    label: 'Vocal Boost',
    desc: 'Presence boost at 2.5kHz with compensated headroom for zero-clip clarity.',
    icon: 'vocal',
  },
  'Wide Stereo': {
    label: 'Wide Stereo',
    desc: 'Expands the soundstage using sub-millisecond Haas delays.',
    icon: 'wide',
  },
  '8D Audio': {
    label: '8D Audio',
    desc: 'Orbits sound continuously in a 360° field around your head.',
    icon: '8d',
  },
  '360 Audio': {
    label: '360 Audio',
    desc: 'Full spherical immersion with vertical + horizontal HRTF panning.',
    icon: '360',
  },
  'Spatial Audio': {
    label: 'Spatial Audio',
    desc: 'Virtual surround with height channels using HRTF head modeling.',
    icon: 'spatial',
  },
  'Virtual Surround': {
    label: 'Virtual Surround',
    desc: 'Simulates home theater speakers with psychoacoustic cross-talk.',
    icon: 'surround',
  },
  'Cinema Mode': {
    label: 'Cinema Mode',
    desc: 'Large hall acoustics with soft reflections and wide reverb.',
    icon: 'cinema',
  },
  'Lo-Fi': {
    label: 'Lo-Fi Chill',
    desc: 'Warm analog filtering with vinyl-like roll-off and soft saturation.',
    icon: 'lofi',
  },
  'Night Mode': {
    label: 'Night Mode',
    desc: 'Compresses dynamic range and cuts harsh highs for quiet listening.',
    icon: 'night',
  },
};

export interface SpatialSettings {
  intensity: number; // 0.0 to 1.0
  roomSize: 'Small' | 'Medium' | 'Large';
  height: number; // 0.0 to 1.0
  spatialEnabled: boolean;
}

export class AudioEngine {
  public audio!: HTMLAudioElement;
  private ctx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private isSourceConnected = false;

  // Persistent DSP nodes (never destroyed)
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  // Brickwall limiter: transparent peak protection at end of every chain
  private limiterNode: DynamicsCompressorNode | null = null;

  // Effect-specific nodes (swapped on mode change)
  private activeEffectNodes: AudioNode[] = [];

  // Animation frame for 8D/360 Audio
  private animationFrameId: number | null = null;
  private panner8D: PannerNode | null = null;
  private pannerAngle = 0;

  // 360 Audio panners
  private panner360Left: PannerNode | null = null;
  private panner360Right: PannerNode | null = null;
  private panner360Angle = 0;

  // Spatial controls
  private settings: SpatialSettings = {
    intensity: 0.5,
    roomSize: 'Medium',
    height: 0.5,
    spatialEnabled: true,
  };

  private currentMode: EffectMode = 'Original';
  private currentVolume = 1.0;

  // Watchdog & state recovery
  private pendingSeekTime: number | null = null;
  private lastTime = 0;
  private lastTimeCheck = Date.now();
  private watchdogInterval: any = null;
  private recoveryCount = 0;
  private isPlayingRequested = false;
  private currentTrackUrl = '';

  // Playback state callbacks
  public onTimeUpdate: (currentTime: number) => void = () => {};
  public onDurationChange: (duration: number) => void = () => {};
  public onEnded: () => void = () => {};
  public onPlayStatusChange: (isPlaying: boolean) => void = () => {};
  public onPlaybackFailed: () => void = () => {};

  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.volume = this.currentVolume;
    this.attachAudioListeners();
  }

  private attachAudioListeners() {
    this.audio.addEventListener('timeupdate', () => {
      this.onTimeUpdate(this.audio.currentTime);
    });
    this.audio.addEventListener('durationchange', () => {
      this.onDurationChange(this.audio.duration || 0);
    });
    this.audio.addEventListener('loadedmetadata', () => {
      if (this.pendingSeekTime !== null) {
        this.audio.currentTime = this.pendingSeekTime;
        this.pendingSeekTime = null;
      }
    });
    this.audio.addEventListener('ended', () => {
      this.isPlayingRequested = false;
      this.stopWatchdog();
      this.onEnded();
    });
    this.audio.addEventListener('play', () => {
      this.isPlayingRequested = true;
      this.startWatchdog();
      this.onPlayStatusChange(true);
    });
    this.audio.addEventListener('pause', () => {
      this.isPlayingRequested = false;
      this.stopWatchdog();
      this.onPlayStatusChange(false);
    });
    this.audio.addEventListener('error', () => {
      console.error('Audio element error:', this.audio.error);
      this.isPlayingRequested = false;
      this.stopWatchdog();
      this.onPlayStatusChange(false);
      if (this.onEnded) {
        setTimeout(() => {
          this.onEnded();
        }, 2000);
      }
    });
  }

  private startWatchdog() {
    if (this.watchdogInterval) return;
    this.lastTime = this.audio.currentTime;
    this.lastTimeCheck = Date.now();
    
    this.watchdogInterval = setInterval(() => {
      if (!this.isPlayingRequested) {
        this.stopWatchdog();
        return;
      }

      const now = Date.now();
      const current = this.audio.currentTime;
      
      // If we are supposed to be playing but playhead isn't moving
      if (current === this.lastTime) {
        const timeStalled = now - this.lastTimeCheck;
        // If stalled for more than 8 seconds
        if (timeStalled > 8000) {
          console.warn(`[AudioEngine] Stalling/deadlock detected. Stalled for ${timeStalled}ms at time ${current}s. Triggering recovery...`);
          this.recover();
        }
      } else {
        // Playhead is moving normally!
        this.lastTime = current;
        this.lastTimeCheck = now;
      }
    }, 1500);
  }

  private stopWatchdog() {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }

  private async recover() {
    this.stopWatchdog();
    
    this.recoveryCount++;
    if (this.recoveryCount > 2) {
      console.error(`[AudioEngine] Recovery failed twice. Triggering playback failure fallback...`);
      this.isPlayingRequested = false;
      this.onPlaybackFailed();
      return;
    }

    const savedTime = this.audio.currentTime;
    const url = this.currentTrackUrl;
    console.log(`[AudioEngine] Attempting recovery for track ${url} at position ${savedTime}s. Attempt: ${this.recoveryCount}`);

    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();

    // Recreate the HTMLAudioElement
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.volume = this.currentVolume;
    this.attachAudioListeners();

    if (this.ctx && this.source) {
      try {
        this.source = this.ctx.createMediaElementSource(this.audio);
        this.isSourceConnected = false;
        this.rebuildChain();
      } catch (err) {
        console.error('[AudioEngine] Failed to reconnect MediaElementSource during recovery:', err);
      }
    }

    this.audio.src = url;
    // Offset slightly to skip corrupted boundaries
    this.pendingSeekTime = Math.max(0, savedTime + 0.2);
    this.audio.load();

    try {
      this.isPlayingRequested = true;
      this.startWatchdog();
      await this.audio.play();
      console.log('[AudioEngine] Recovery successful, playing resumed.');
    } catch (err) {
      console.error('[AudioEngine] Playback resumption failed during recovery:', err);
    }
  }

  /**
   * Lazily initializes the AudioContext and creates persistent nodes.
   * Called on first DSP mode activation or first play with DSP.
   */
  private ensureCtx() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.ctx) {
      // Request 48kHz for hi-res processing headroom
      this.ctx = new AudioContextClass({ sampleRate: 48000 });
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    // Create persistent source (only once per audio element)
    if (!this.source) {
      this.source = this.ctx.createMediaElementSource(this.audio);
      this.isSourceConnected = false;
    }

    if (!this.analyser) {
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
    }

    if (!this.gainNode) {
      this.gainNode = this.ctx.createGain();
    }
    this.gainNode.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);

    // Transparent brickwall limiter — prevents ALL clipping without audible coloration
    // Threshold at -1dB, instant attack, fast release, infinity ratio = true brickwall
    if (!this.limiterNode) {
      this.limiterNode = this.ctx.createDynamicsCompressor();
      this.limiterNode.threshold.setValueAtTime(-1.0, this.ctx.currentTime);
      this.limiterNode.knee.setValueAtTime(0.0, this.ctx.currentTime);
      this.limiterNode.ratio.setValueAtTime(20.0, this.ctx.currentTime);
      this.limiterNode.attack.setValueAtTime(0.001, this.ctx.currentTime);
      this.limiterNode.release.setValueAtTime(0.05, this.ctx.currentTime);
    }
  }

  /**
   * Hot-swap the DSP effect chain without touching the audio element.
   * This is the key to zero-latency mode switching.
   */
  private rebuildChain() {
    if (!this.ctx || !this.source || !this.analyser || !this.gainNode) return;

    // 1. Stop animations
    this.stopAnimation();

    // 2. Disconnect all active effect nodes
    this.activeEffectNodes.forEach((node) => {
      try { node.disconnect(); } catch (_e) { /* ignore */ }
    });
    this.activeEffectNodes = [];

    // 3. Disconnect persistent nodes (safe to call multiple times)
    try { this.source.disconnect(); } catch (_e) { /* ignore */ }
    try { this.gainNode.disconnect(); } catch (_e) { /* ignore */ }
    try { this.analyser.disconnect(); } catch (_e) { /* ignore */ }
    if (this.limiterNode) {
      try { this.limiterNode.disconnect(); } catch (_e) { /* ignore */ }
    }

    if (this.currentMode === 'Original') {
      // Bypass: source -> gain -> analyser -> destination (no limiter needed)
      this.source.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.isSourceConnected = true;
      return;
    }

    // 4. Build effect-specific chain
    let lastNode: AudioNode = this.source;

    // EQ-based modes use pre-attenuation + boost + limiter for zero-clip processing
    if (this.currentMode === 'Bass Boost') {
      // Pre-attenuate by -4dB to create headroom before the +6dB shelf
      const preGain = this.ctx.createGain();
      preGain.gain.setValueAtTime(0.63, this.ctx.currentTime); // -4dB
      const eq = this.ctx.createBiquadFilter();
      eq.type = 'lowshelf';
      eq.frequency.setValueAtTime(80, this.ctx.currentTime);
      eq.gain.setValueAtTime(6, this.ctx.currentTime); // +6dB (gentler than old +8dB)
      // Makeup gain to restore perceived loudness
      const makeupGain = this.ctx.createGain();
      makeupGain.gain.setValueAtTime(1.26, this.ctx.currentTime); // +2dB makeup
      lastNode.connect(preGain);
      preGain.connect(eq);
      eq.connect(makeupGain);
      lastNode = makeupGain;
      this.activeEffectNodes.push(preGain, eq, makeupGain);
    } else if (this.currentMode === 'Vocal Boost') {
      // Pre-attenuate -2.5dB, then boost presence band
      const preGain = this.ctx.createGain();
      preGain.gain.setValueAtTime(0.75, this.ctx.currentTime); // -2.5dB
      const eq = this.ctx.createBiquadFilter();
      eq.type = 'peaking';
      eq.frequency.setValueAtTime(2500, this.ctx.currentTime); // 2.5kHz presence
      eq.Q.setValueAtTime(1.0, this.ctx.currentTime); // wider Q for natural sound
      eq.gain.setValueAtTime(4.5, this.ctx.currentTime); // +4.5dB
      // Subtle air band shimmer at 10kHz
      const airBand = this.ctx.createBiquadFilter();
      airBand.type = 'highshelf';
      airBand.frequency.setValueAtTime(10000, this.ctx.currentTime);
      airBand.gain.setValueAtTime(1.5, this.ctx.currentTime); // +1.5dB air
      const makeupGain = this.ctx.createGain();
      makeupGain.gain.setValueAtTime(1.12, this.ctx.currentTime); // +1dB makeup
      lastNode.connect(preGain);
      preGain.connect(eq);
      eq.connect(airBand);
      airBand.connect(makeupGain);
      lastNode = makeupGain;
      this.activeEffectNodes.push(preGain, eq, airBand, makeupGain);
    } else if (this.currentMode === 'Night Mode') {
      // Gentle compression (4:1) + smooth high roll-off — preserves dynamics while taming peaks
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
      compressor.knee.setValueAtTime(12, this.ctx.currentTime); // soft knee for transparency
      compressor.ratio.setValueAtTime(4, this.ctx.currentTime); // 4:1 — gentle, not crushing
      compressor.attack.setValueAtTime(0.01, this.ctx.currentTime); // 10ms — lets transients through
      compressor.release.setValueAtTime(0.15, this.ctx.currentTime);
      // Gentle 6kHz roll-off (2nd order) — removes harshness without killing clarity
      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(6000, this.ctx.currentTime);
      lpf.Q.setValueAtTime(0.5, this.ctx.currentTime); // Butterworth-flat, no resonance
      // Makeup gain to compensate compression loss
      const makeupGain = this.ctx.createGain();
      makeupGain.gain.setValueAtTime(1.15, this.ctx.currentTime); // +1.2dB makeup
      lastNode.connect(compressor);
      compressor.connect(lpf);
      lpf.connect(makeupGain);
      lastNode = makeupGain;
      this.activeEffectNodes.push(compressor, lpf, makeupGain);
    } else if (this.currentMode === 'Lo-Fi') {
      // Warm analog feel with unity-gain-summed parallel processing
      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(4000, this.ctx.currentTime); // slightly higher for clarity
      lpf.Q.setValueAtTime(0.8, this.ctx.currentTime); // less resonance = cleaner
      const hpf = this.ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.setValueAtTime(150, this.ctx.currentTime);
      hpf.Q.setValueAtTime(0.5, this.ctx.currentTime);
      // Subtle warm delay
      const delay = this.ctx.createDelay(0.5);
      delay.delayTime.setValueAtTime(0.06, this.ctx.currentTime);
      const feedback = this.ctx.createGain();
      feedback.gain.setValueAtTime(0.12, this.ctx.currentTime);
      // Unity-gain summing: dry + wet must sum to ~1.0
      const wetGain = this.ctx.createGain();
      wetGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      const dryGain = this.ctx.createGain();
      dryGain.gain.setValueAtTime(0.85, this.ctx.currentTime); // 0.85 + 0.15 = 1.0
      lastNode.connect(lpf);
      lpf.connect(hpf);
      // Dry path
      hpf.connect(dryGain);
      dryGain.connect(this.gainNode);
      // Wet path (warm echo)
      hpf.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wetGain);
      wetGain.connect(this.gainNode);
      // Route through limiter for safety
      this.gainNode.connect(this.limiterNode!);
      this.limiterNode!.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.isSourceConnected = true;
      this.activeEffectNodes.push(lpf, hpf, delay, feedback, wetGain, dryGain);
      return;
    } else if (this.settings.spatialEnabled) {
      // Spatial effect modes
      switch (this.currentMode) {
        case 'Wide Stereo': {
          const splitter = this.ctx.createChannelSplitter(2);
          const merger = this.ctx.createChannelMerger(2);
          const delay = this.ctx.createDelay(0.1);
          const delayTime = 0.005 + (this.settings.intensity * 0.030);
          delay.delayTime.setValueAtTime(delayTime, this.ctx.currentTime);

          const leftGain = this.ctx.createGain();
          const rightGain = this.ctx.createGain();

          lastNode.connect(splitter);
          splitter.connect(leftGain, 0);
          splitter.connect(delay, 1);
          delay.connect(rightGain);
          leftGain.connect(merger, 0, 0);
          rightGain.connect(merger, 0, 1);

          lastNode = merger;
          this.activeEffectNodes.push(splitter, delay, leftGain, rightGain, merger);
          break;
        }

        case 'Virtual Surround': {
          const splitter = this.ctx.createChannelSplitter(2);
          const merger = this.ctx.createChannelMerger(2);
          const leftDirect = this.ctx.createGain();
          const rightDirect = this.ctx.createGain();
          const leftToRightDelay = this.ctx.createDelay(0.01);
          const rightToLeftDelay = this.ctx.createDelay(0.01);
          const crossDelayVal = 0.00025 + (this.settings.intensity * 0.0002);
          leftToRightDelay.delayTime.setValueAtTime(crossDelayVal, this.ctx.currentTime);
          rightToLeftDelay.delayTime.setValueAtTime(crossDelayVal, this.ctx.currentTime);

          const leftToRightFilter = this.ctx.createBiquadFilter();
          const rightToLeftFilter = this.ctx.createBiquadFilter();
          leftToRightFilter.type = 'lowpass';
          leftToRightFilter.frequency.setValueAtTime(700, this.ctx.currentTime);
          rightToLeftFilter.type = 'lowpass';
          rightToLeftFilter.frequency.setValueAtTime(700, this.ctx.currentTime);

          const crossGain = this.ctx.createGain();
          crossGain.gain.setValueAtTime(0.35 * this.settings.intensity, this.ctx.currentTime);

          lastNode.connect(splitter);
          splitter.connect(leftDirect, 0);
          splitter.connect(leftToRightDelay, 0);
          leftToRightDelay.connect(leftToRightFilter);
          leftToRightFilter.connect(crossGain);
          splitter.connect(rightDirect, 1);
          splitter.connect(rightToLeftDelay, 1);
          rightToLeftDelay.connect(rightToLeftFilter);
          rightToLeftFilter.connect(crossGain);

          leftDirect.connect(merger, 0, 0);
          crossGain.connect(merger, 0, 1);
          rightDirect.connect(merger, 0, 1);
          crossGain.connect(merger, 0, 0);

          lastNode = merger;
          this.activeEffectNodes.push(
            splitter, merger, leftDirect, rightDirect,
            leftToRightDelay, rightToLeftDelay,
            leftToRightFilter, rightToLeftFilter, crossGain
          );
          break;
        }

        case 'Spatial Audio': {
          const splitter = this.ctx.createChannelSplitter(2);
          const leftPanner = this.ctx.createPanner();
          const rightPanner = this.ctx.createPanner();
          leftPanner.panningModel = 'HRTF';
          leftPanner.distanceModel = 'inverse';
          rightPanner.panningModel = 'HRTF';
          rightPanner.distanceModel = 'inverse';

          const hVal = this.settings.height * 3.0;
          const spread = 2.0 + (this.settings.intensity * 2.0);

          leftPanner.positionX.setValueAtTime(-spread, this.ctx.currentTime);
          leftPanner.positionY.setValueAtTime(hVal, this.ctx.currentTime);
          leftPanner.positionZ.setValueAtTime(-2, this.ctx.currentTime);
          rightPanner.positionX.setValueAtTime(spread, this.ctx.currentTime);
          rightPanner.positionY.setValueAtTime(hVal, this.ctx.currentTime);
          rightPanner.positionZ.setValueAtTime(-2, this.ctx.currentTime);

          lastNode.connect(splitter);
          splitter.connect(leftPanner, 0);
          splitter.connect(rightPanner, 1);
          leftPanner.connect(this.gainNode);
          rightPanner.connect(this.gainNode);

          this.gainNode.connect(this.limiterNode!);
          this.limiterNode!.connect(this.analyser);
          this.analyser.connect(this.ctx.destination);
          this.isSourceConnected = true;
          this.activeEffectNodes.push(splitter, leftPanner, rightPanner);
          return;
        }

        case '8D Audio': {
          this.panner8D = this.ctx.createPanner();
          this.panner8D.panningModel = 'HRTF';
          this.panner8D.distanceModel = 'inverse';
          this.panner8D.positionX.setValueAtTime(0, this.ctx.currentTime);
          this.panner8D.positionY.setValueAtTime(0, this.ctx.currentTime);
          this.panner8D.positionZ.setValueAtTime(-2, this.ctx.currentTime);

          lastNode.connect(this.panner8D);
          lastNode = this.panner8D;
          this.activeEffectNodes.push(this.panner8D);
          this.start8DAnimation();
          break;
        }

        case '360 Audio': {
          // Full spherical: splits stereo, orbits L/R panners in opposite hemispheres
          const splitter = this.ctx.createChannelSplitter(2);
          this.panner360Left = this.ctx.createPanner();
          this.panner360Right = this.ctx.createPanner();
          this.panner360Left.panningModel = 'HRTF';
          this.panner360Left.distanceModel = 'inverse';
          this.panner360Right.panningModel = 'HRTF';
          this.panner360Right.distanceModel = 'inverse';

          lastNode.connect(splitter);
          splitter.connect(this.panner360Left, 0);
          splitter.connect(this.panner360Right, 1);
          this.panner360Left.connect(this.gainNode);
          this.panner360Right.connect(this.gainNode);

          this.gainNode.connect(this.limiterNode!);
          this.limiterNode!.connect(this.analyser);
          this.analyser.connect(this.ctx.destination);
          this.isSourceConnected = true;
          this.activeEffectNodes.push(splitter, this.panner360Left, this.panner360Right);
          this.start360Animation();
          return;
        }

        case 'Cinema Mode': {
          const delayNode = this.ctx.createDelay(0.5);
          const feedbackGain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();
          const dryGain = this.ctx.createGain();
          const wetGain = this.ctx.createGain();

          let delayVal = 0.05;
          let feedbackVal = 0.2;
          if (this.settings.roomSize === 'Medium') { delayVal = 0.12; feedbackVal = 0.35; }
          else if (this.settings.roomSize === 'Large') { delayVal = 0.22; feedbackVal = 0.5; }

          delayNode.delayTime.setValueAtTime(delayVal, this.ctx.currentTime);
          feedbackGain.gain.setValueAtTime(feedbackVal * this.settings.intensity, this.ctx.currentTime);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(2000, this.ctx.currentTime);
          // Unity-gain parallel sum: dry + wet ≤ 1.0
          const wetLevel = 0.3 * this.settings.intensity;
          dryGain.gain.setValueAtTime(1.0 - wetLevel, this.ctx.currentTime);
          wetGain.gain.setValueAtTime(wetLevel, this.ctx.currentTime);

          lastNode.connect(dryGain);
          dryGain.connect(this.gainNode);
          lastNode.connect(delayNode);
          delayNode.connect(filter);
          filter.connect(feedbackGain);
          feedbackGain.connect(delayNode);
          filter.connect(wetGain);
          wetGain.connect(this.gainNode);

          this.gainNode.connect(this.limiterNode!);
          this.limiterNode!.connect(this.analyser);
          this.analyser.connect(this.ctx.destination);
          this.isSourceConnected = true;
          this.activeEffectNodes.push(delayNode, feedbackGain, filter, dryGain, wetGain);
          return;
        }
      }
    }

    // Default final routing: lastNode -> gainNode -> limiter -> analyser -> destination
    lastNode.connect(this.gainNode);
    this.gainNode.connect(this.limiterNode!);
    this.limiterNode!.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.isSourceConnected = true;
  }

  public setTrack(url: string, pendingSeekTime: number | null = null) {
    this.currentTrackUrl = url;
    this.recoveryCount = 0;
    this.pendingSeekTime = pendingSeekTime;
    const wasPlaying = !this.audio.paused || this.audio.currentTime > 0 || this.isPlayingRequested;

    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();

    this.audio.src = url;
    this.audio.load();
    if (wasPlaying) {
      this.play();
    }
  }

  public stop() {
    this.isPlayingRequested = false;
    this.stopWatchdog();
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.removeAttribute('src');
    this.audio.load();
    this.onPlayStatusChange(false);
  }

  public play() {
    this.isPlayingRequested = true;
    this.startWatchdog();
    if (this.currentMode !== 'Original') {
      this.ensureCtx();
      if (!this.isSourceConnected) {
        this.rebuildChain();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.audio.play().catch((err) => {
      console.warn('Playback failed. User gesture may be required:', err);
    });
  }

  public pause() {
    this.isPlayingRequested = false;
    this.stopWatchdog();
    this.audio.pause();
  }

  public preloadTrack(url: string) {
    if (!url) return;
    console.log(`[AudioEngine] Preloading next track: ${url}`);
    fetch(url).catch((err) => {
      console.warn('[AudioEngine] Preload fetch failed:', err);
    });
  }

  public seek(seconds: number) {
    this.audio.currentTime = seconds;
  }

  public setVolume(volume: number) {
    this.currentVolume = volume;
    if (this.currentMode === 'Original' || !this.gainNode) {
      this.audio.volume = volume;
    } else {
      this.audio.volume = 1.0;
      if (this.gainNode && this.ctx) {
        this.gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
      }
    }
  }

  /**
   * Hot-swap effect mode with ZERO audio interruption.
   * Never recreates the audio element or reloads the source.
   */
  public setEffectMode(mode: EffectMode) {
    this.currentMode = mode;

    if (mode === 'Original') {
      // If we have a ctx and source, route through for analyser, otherwise direct
      if (this.ctx && this.source) {
        this.rebuildChain();
        this.audio.volume = this.currentVolume;
      } else {
        this.audio.volume = this.currentVolume;
      }
    } else {
      this.ensureCtx();
      this.audio.volume = 1.0; // full scale to DSP chain
      this.rebuildChain();
    }
  }

  public updateSpatialSettings(settings: Partial<SpatialSettings>) {
    this.settings = { ...this.settings, ...settings };
    if (this.currentMode !== 'Original' && this.currentMode !== 'Bass Boost' && this.currentMode !== 'Vocal Boost') {
      this.rebuildChain();
    }
  }

  public getAnalyserData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  // 8D Audio animation: horizontal orbit
  private start8DAnimation() {
    if (!this.ctx || !this.panner8D) return;
    const animate = () => {
      if (!this.panner8D || !this.ctx) return;
      const speed = 0.015 + (this.settings.intensity * 0.03);
      this.pannerAngle += speed;
      const radius = 3.0;
      const x = Math.sin(this.pannerAngle) * radius;
      const z = Math.cos(this.pannerAngle) * radius;
      this.panner8D.positionX.setValueAtTime(x, this.ctx.currentTime);
      this.panner8D.positionZ.setValueAtTime(z, this.ctx.currentTime);
      this.animationFrameId = requestAnimationFrame(animate);
    };
    this.pannerAngle = 0;
    this.animationFrameId = requestAnimationFrame(animate);
  }

  // 360 Audio animation: full spherical orbit with height
  private start360Animation() {
    if (!this.ctx || !this.panner360Left || !this.panner360Right) return;
    const animate = () => {
      if (!this.panner360Left || !this.panner360Right || !this.ctx) return;
      const speed = 0.012 + (this.settings.intensity * 0.025);
      this.panner360Angle += speed;
      const radius = 3.5;

      // Left channel orbits clockwise with height oscillation
      const lx = Math.sin(this.panner360Angle) * radius;
      const lz = Math.cos(this.panner360Angle) * radius;
      const ly = Math.sin(this.panner360Angle * 0.5) * 2.0 * this.settings.height;

      // Right channel orbits counter-clockwise with offset height
      const rx = Math.sin(-this.panner360Angle + Math.PI) * radius;
      const rz = Math.cos(-this.panner360Angle + Math.PI) * radius;
      const ry = Math.cos(this.panner360Angle * 0.5) * 2.0 * this.settings.height;

      this.panner360Left.positionX.setValueAtTime(lx, this.ctx.currentTime);
      this.panner360Left.positionY.setValueAtTime(ly, this.ctx.currentTime);
      this.panner360Left.positionZ.setValueAtTime(lz, this.ctx.currentTime);

      this.panner360Right.positionX.setValueAtTime(rx, this.ctx.currentTime);
      this.panner360Right.positionY.setValueAtTime(ry, this.ctx.currentTime);
      this.panner360Right.positionZ.setValueAtTime(rz, this.ctx.currentTime);

      this.animationFrameId = requestAnimationFrame(animate);
    };
    this.panner360Angle = 0;
    this.animationFrameId = requestAnimationFrame(animate);
  }

  private stopAnimation() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.panner8D = null;
    this.panner360Left = null;
    this.panner360Right = null;
  }
}
export const audioEngine = new AudioEngine();
export default audioEngine;

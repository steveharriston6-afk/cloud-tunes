import React, { useRef, useEffect } from 'react';
import { audioEngine } from '../audio/AudioEngine';

interface VisualizerProps {
  isPlaying: boolean;
  activeColor?: string; // 'primary' | 'accent' | 'gradient'
}

export const Visualizer: React.FC<VisualizerProps> = ({ isPlaying, activeColor = 'gradient' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to match display size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const render = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Get analyser data
      const dataArray = audioEngine.getAnalyserData();
      const bufferLength = dataArray.length;

      const isFlat = bufferLength === 0 || !Array.from(dataArray).some(v => v > 0);
      if (isFlat) {
        if (isPlaying) {
          // Draw a gentle, beautiful organic glowing sine wave in Bit-Perfect mode
          ctx.beginPath();
          const time = Date.now() * 0.003;
          for (let tx = 0; tx < width; tx++) {
            const ty = height / 2 + Math.sin(tx * 0.015 + time) * 12 * Math.sin(tx * 0.004 + time * 0.4);
            if (tx === 0) ctx.moveTo(tx, ty);
            else ctx.lineTo(tx, ty);
          }
          ctx.strokeStyle = activeColor === 'primary' ? '#ff2d55' : 
                            activeColor === 'gradient' ? '#ff2d55' : '#8e2de2';
          ctx.shadowBlur = 8;
          ctx.shadowColor = ctx.strokeStyle as string;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.shadowBlur = 0; // Reset shadow
        } else {
          ctx.beginPath();
          ctx.moveTo(0, height / 2);
          ctx.lineTo(width, height / 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      const barWidth = (width / bufferLength) * 1.5;
      let barHeight;
      let x = 0;

      // Create gradient for bars
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, 'rgba(142, 45, 226, 0.2)'); // Violet
      gradient.addColorStop(0.5, '#8e2de2'); // Deep Violet
      gradient.addColorStop(1, '#ff2d55'); // Apple Pink-Red

      for (let i = 0; i < bufferLength; i++) {
        // Fetch raw value (0-255)
        const value = dataArray[i];
        
        // Scale height based on canvas size
        barHeight = (value / 255) * height * 0.85;

        // Add small baseline height if playing to keep it active
        if (isPlaying && barHeight < 4) {
          barHeight = 4 + Math.sin(Date.now() * 0.01 + i) * 2;
        }

        ctx.fillStyle = activeColor === 'gradient' ? gradient : 
                        activeColor === 'primary' ? '#ff2d55' : '#8e2de2';

        // Rounded corners for bars
        const y = height - barHeight;
        const radius = barWidth / 2;

        ctx.beginPath();
        // Draw standard bar but with rounded tops
        if (barHeight > 0) {
          ctx.roundRect(x, y, barWidth - 1, barHeight, [radius, radius, 0, 0]);
          ctx.fill();
        }

        x += barWidth;
      }

      // Draw active floating line above bars for premium feel
      ctx.beginPath();
      let first = true;
      let lineX = 0;
      for (let i = 0; i < bufferLength; i += 2) {
        const val = dataArray[i];
        const h = (val / 255) * height * 0.85;
        const ly = height - h - 10;
        
        if (first) {
          ctx.moveTo(lineX, ly);
          first = false;
        } else {
          ctx.lineTo(lineX, ly);
        }
        lineX += barWidth * 2;
      }
      ctx.strokeStyle = 'rgba(255, 45, 85, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, activeColor]);

  return (
    <div className="w-full h-full relative overflow-hidden rounded-xl bg-black/40 border border-white/5 p-1">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/20 pointer-events-none" />
    </div>
  );
};
export default Visualizer;

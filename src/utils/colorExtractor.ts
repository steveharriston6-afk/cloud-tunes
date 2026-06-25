// Utility to extract dominant colors from album artwork images
// and apply them as CSS variables for the fluid glassmorphic theme.

export interface AlbumColors {
  primary: string;
  secondary: string;
  startGradient: string;
  endGradient: string;
}

export function extractColorsFromImage(imageUrl: string): Promise<AlbumColors> {
  return new Promise((resolve) => {
    const defaultColors: AlbumColors = {
      primary: '#ff2d55',
      secondary: '#8e2de2',
      startGradient: 'rgba(255, 45, 85, 0.15)',
      endGradient: 'rgba(142, 45, 226, 0.15)',
    };

    if (!imageUrl) {
      resolve(defaultColors);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(defaultColors);
          return;
        }

        // Draw image downscaled to 10x10 to average out colors and retrieve a palette
        canvas.width = 10;
        canvas.height = 10;
        ctx.drawImage(img, 0, 0, 10, 10);

        const imgData = ctx.getImageData(0, 0, 10, 10).data;
        const colors: { r: number; g: number; b: number }[] = [];

        // Sample a few pixels from the grid
        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          // Filter out transparent and pure white/black pixels
          if (a > 200 && !((r > 245 && g > 245 && b > 245) || (r < 10 && g < 10 && b < 10))) {
            colors.push({ r, g, b });
          }
        }

        if (colors.length === 0) {
          resolve(defaultColors);
          return;
        }

        // Calculate average color for primary
        let totalR = 0, totalG = 0, totalB = 0;
        colors.forEach(c => {
          totalR += c.r;
          totalG += c.g;
          totalB += c.b;
        });

        const avgR = Math.round(totalR / colors.length);
        const avgG = Math.round(totalG / colors.length);
        const avgB = Math.round(totalB / colors.length);

        // Find a secondary color that is most different from average to create a pretty gradient
        let secondary = colors[0];
        let maxDist = -1;
        colors.forEach(c => {
          const dist = Math.pow(c.r - avgR, 2) + Math.pow(c.g - avgG, 2) + Math.pow(c.b - avgB, 2);
          if (dist > maxDist) {
            maxDist = dist;
            secondary = c;
          }
        });

        const rgbToHex = (r: number, g: number, b: number) => {
          return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        };

        const primaryHex = rgbToHex(avgR, avgG, avgB);
        const secondaryHex = rgbToHex(secondary.r, secondary.g, secondary.b);

        // Compute alpha gradient variables (used in blurred backgrounds)
        const startGradient = `rgba(${avgR}, ${avgG}, ${avgB}, 0.22)`;
        const endGradient = `rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.22)`;

        resolve({
          primary: primaryHex,
          secondary: secondaryHex,
          startGradient,
          endGradient
        });
      } catch (e) {
        // Fallback on canvas security/CORS failures
        resolve(defaultColors);
      }
    };

    img.onerror = () => {
      resolve(defaultColors);
    };
  });
}

// Applies colors directly to the CSS custom properties of the root document node
export function applyAlbumColors(colors: AlbumColors) {
  const root = document.documentElement;
  root.style.setProperty('--album-color-solid', colors.primary);
  root.style.setProperty('--album-color-solid-muted', colors.primary + '80'); // 50% opacity hex
  root.style.setProperty('--album-color-start', colors.startGradient);
  root.style.setProperty('--album-color-end', colors.endGradient);
}

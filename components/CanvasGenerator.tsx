import React, { useEffect, forwardRef } from 'react';

interface CanvasGeneratorProps {
  text: string;
  imageUrl: string;
  width: number;
  height: number;
  fontSize: number;
  fontColor: string;
  x: number;
  y: number;
  backgroundSize: string;
  backgroundPosition: string;
  onLoad?: () => void;
}

const CanvasGenerator = forwardRef<HTMLCanvasElement, CanvasGeneratorProps>(({
  text,
  imageUrl,
  width,
  height,
  fontSize,
  fontColor,
  x,
  y,
  backgroundSize,
  backgroundPosition,
  onLoad
}, ref) => {
  const canvasRef = ref as React.RefObject<HTMLCanvasElement>;

  useEffect(() => {
    async function loadFontAndDraw() {
      const canvas = canvasRef?.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      try {
        // Load custom font
        const font = new FontFace(
          'HelveticaNeue-Condensed',
          'url(https://jarrang-font.s3.eu-west-2.amazonaws.com/milwaukee/HelveticaNeue-Condensed+Bold.ttf)'
        );

        await font.load();
        document.fonts.add(font);

        // Check if font is available
        if (!document.fonts.check(`${fontSize}px "HelveticaNeue-Condensed"`)) {
          console.warn('Font failed to load:', 'HelveticaNeue-Condensed');
        }

        // Prepare image URL with proxy if needed
        const isSFMCUrl = imageUrl.includes('mail.milwaukeetool') || 
                         imageUrl.includes('salesforce.com') || 
                         imageUrl.includes('exacttarget.com');
        
        const finalImageUrl = isSFMCUrl 
          ? `/api/overlay?proxy=true&url=${encodeURIComponent(imageUrl)}`
          : imageUrl;

        // Load image with prepared URL
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        const imageLoadPromise = new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = (e) => {
            console.error('Image load error:', e);
            reject(new Error('Failed to load image'));
          }
        });

        img.src = finalImageUrl;

        // Wait for image to load
        await imageLoadPromise;

        // Clear and draw
        ctx.clearRect(0, 0, width, height);

        // Calculate image parameters
        let drawWidth = width;
        let drawHeight = height;
        let drawX = 0;
        let drawY = 0;

        if (backgroundSize === 'cover') {
          const scale = Math.max(width / img.width, height / img.height);
          drawWidth = img.width * scale;
          drawHeight = img.height * scale;
          drawX = (width - drawWidth) / 2;
          drawY = (height - drawHeight) / 2;
        } else if (backgroundSize === 'contain') {
          const scale = Math.min(width / img.width, height / img.height);
          drawWidth = img.width * scale;
          drawHeight = img.height * scale;
          drawX = (width - drawWidth) / 2;
          drawY = (height - drawHeight) / 2;
        }

        // Adjust position
        if (backgroundPosition === 'top') drawY = 0;
        else if (backgroundPosition === 'bottom') drawY = height - drawHeight;
        else if (backgroundPosition === 'left') drawX = 0;
        else if (backgroundPosition === 'right') drawX = width - drawWidth;

        // Draw image and text
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        ctx.fillStyle = fontColor;
        ctx.font = `${fontSize}px HelveticaNeue-Condensed`;
        ctx.fillText(text, x, y);

        onLoad?.();
      } catch (error) {
        console.error('Error in canvas rendering:', error);
        onLoad?.();
      }
    }

    loadFontAndDraw();
  }, [text, imageUrl, width, height, fontSize, fontColor, x, y, backgroundSize, backgroundPosition, canvasRef]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
});

CanvasGenerator.displayName = 'CanvasGenerator';

export default CanvasGenerator;

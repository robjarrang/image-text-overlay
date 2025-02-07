import React, { useEffect, forwardRef, useRef } from 'react';

interface TextStyle {
  text: string;
  isSuperscript?: boolean;
}

interface TextLine {
  segments: TextStyle[];
  alignment: 'left' | 'center' | 'right';
}

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
  const initialLoadRef = useRef(true);

  // Parse the text into structured format
  const parseText = (text: string): TextLine[] => {
    return text.split('\\n').map(line => {
      const segments: TextStyle[] = [];
      let currentText = '';
      let alignment: 'left' | 'center' | 'right' = line.startsWith('[center]') ? 'center' :
                                                   line.startsWith('[right]') ? 'right' :
                                                   line.startsWith('[left]') ? 'left' : 'left';

      // Remove any alignment markers at the start of the line
      if (line.startsWith('[center]')) {
        line = line.substring(8);
      } else if (line.startsWith('[right]')) {
        line = line.substring(7);
      } else if (line.startsWith('[left]')) {
        line = line.substring(6);
      }

      // Parse superscript markers
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '^' && line[i + 1] === '{') {
          if (currentText) {
            segments.push({ text: currentText });
            currentText = '';
          }
          let superText = '';
          i += 2; // Skip ^{
          while (i < line.length && line[i] !== '}') {
            superText += line[i];
            i++;
          }
          segments.push({ text: superText, isSuperscript: true });
        } else {
          currentText += line[i];
        }
      }
      if (currentText) {
        segments.push({ text: currentText });
      }

      return { segments, alignment };
    });
  };

  useEffect(() => {
    let mounted = true;

    async function loadFontAndDraw() {
      if (!mounted) return;

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

        // Only continue if component is still mounted
        if (!mounted) return;

        // Prepare image URL with proxy if needed
        const isSFMCUrl = imageUrl.includes('mail.milwaukeetool') || 
                         imageUrl.includes('salesforce.com') || 
                         imageUrl.includes('exacttarget.com');
        
        const finalImageUrl = isSFMCUrl 
          ? `/api/overlay?proxy=true&url=${encodeURIComponent(imageUrl)}`
          : imageUrl;

        // Load image
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

        // Only continue if component is still mounted
        if (!mounted) return;

        // Draw image and text
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

        // Adjust position based on backgroundPosition
        if (backgroundPosition === 'top') drawY = 0;
        else if (backgroundPosition === 'bottom') drawY = height - drawHeight;
        else if (backgroundPosition === 'left') drawX = 0;
        else if (backgroundPosition === 'right') drawX = width - drawWidth;

        // Draw image
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

        // Parse and draw text
        const lines = parseText(text);
        let currentY = y;
        const lineHeight = fontSize * 1.2;

        ctx.fillStyle = fontColor;
        lines.forEach(line => {
          let currentX = x;
          let lineWidth = 0;

          // Calculate total width of the line first
          line.segments.forEach(segment => {
            const segmentFont = segment.isSuperscript
              ? `${fontSize * 0.7}px HelveticaNeue-Condensed`
              : `${fontSize}px HelveticaNeue-Condensed`;
            ctx.font = segmentFont;
            lineWidth += ctx.measureText(segment.text).width;
          });

          // Adjust starting X based on alignment
          if (line.alignment === 'center') {
            currentX = (width - lineWidth) / 2;
          } else if (line.alignment === 'right') {
            currentX = width - lineWidth - x;
          }

          // Draw each segment
          line.segments.forEach(segment => {
            if (segment.isSuperscript) {
              ctx.font = `${fontSize * 0.7}px HelveticaNeue-Condensed`;
              ctx.fillText(segment.text, currentX, currentY - fontSize * 0.3);
            } else {
              ctx.font = `${fontSize}px HelveticaNeue-Condensed`;
              ctx.fillText(segment.text, currentX, currentY);
            }
            currentX += ctx.measureText(segment.text).width;
          });

          currentY += lineHeight;
        });

        if (mounted) {
          onLoad?.();
        }
      } catch (error) {
        console.error('Error in canvas rendering:', error);
        if (mounted) {
          onLoad?.();
        }
      }
    }

    // If this is the initial load or we have all necessary props, render
    if (initialLoadRef.current || (text && imageUrl && width && height)) {
      initialLoadRef.current = false;
      loadFontAndDraw();
    }

    return () => {
      mounted = false;
    };
  }, [text, imageUrl, width, height, fontSize, fontColor, x, y, backgroundSize, backgroundPosition, onLoad]);

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

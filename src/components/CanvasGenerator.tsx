import { useEffect, useRef, useState } from 'react';

interface CanvasGeneratorProps {
  text: string;
  imageUrl: string;
  fontSize: number;
  fontColor: string;
  x: number;
  y: number;
  width: number;
  height: number;
  onLoad: () => void;
  onError: (message: string) => void;
  onImageLoad?: (dimensions: { width: number; height: number }) => void;
}

export function CanvasGenerator({
  text,
  imageUrl,
  fontSize,
  fontColor,
  x,
  y,
  width,
  height,
  onLoad,
  onError,
  onImageLoad
}: CanvasGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(1);
  const [fontLoaded, setFontLoaded] = useState(false);
  const fontLoadingAttempted = useRef(false);

  // Improved font loading with retry mechanism
  useEffect(() => {
    if (fontLoadingAttempted.current) return;
    fontLoadingAttempted.current = true;

    const loadFont = async () => {
      try {
        // Try loading from local first
        const font = new FontFace(
          'HelveticaNeue-Condensed',
          'url(/fonts/HelveticaNeue-Condensed-Bold.ttf)'
        );

        await font.load();
        document.fonts.add(font);
        setFontLoaded(true);
      } catch (localError) {
        console.warn('Failed to load font locally, trying backup URL:', localError);
        
        try {
          // Fallback to S3 URL
          const font = new FontFace(
            'HelveticaNeue-Condensed',
            'url(https://jarrang-font.s3.eu-west-2.amazonaws.com/milwaukee/HelveticaNeue-Condensed+Bold.ttf)'
          );

          await font.load();
          document.fonts.add(font);
          setFontLoaded(true);
        } catch (backupError) {
          console.error('Failed to load font from backup source:', backupError);
          // Continue with system fonts
          setFontLoaded(true);
        }
      }
    };

    loadFont();
  }, []);

  const processText = (text: string) => {
    return text.split('\n').map(line => {
      let align = 'left';
      line = line.replace(/\[(center|left|right)\]/g, (_, a) => {
        align = a;
        return '';
      });
      
      const parts: Array<{ text: string; isSuper: boolean }> = [];
      let currentIndex = 0;
      
      const superscriptRegex = /\^{([^}]+)}/g;
      let match;
      
      while ((match = superscriptRegex.exec(line)) !== null) {
        if (match.index > currentIndex) {
          parts.push({
            text: line.slice(currentIndex, match.index),
            isSuper: false
          });
        }
        
        parts.push({
          text: match[1],
          isSuper: true
        });
        
        currentIndex = match.index + match[0].length;
      }
      
      if (currentIndex < line.length) {
        parts.push({
          text: line.slice(currentIndex),
          isSuper: false
        });
      }
      
      return { parts, align };
    });
  };

  useEffect(() => {
    if (!fontLoaded) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const image = new Image();
    image.crossOrigin = 'anonymous';
    
    image.onload = () => {
      const imageWidth = image.width;
      const imageHeight = image.height;
      setImageAspectRatio(imageWidth / imageHeight);
      
      onImageLoad?.({ width: imageWidth, height: imageHeight });
      
      // Create a higher resolution offscreen canvas
      const scale = 2; // Increase resolution by 2x
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = imageWidth * scale;
      offscreenCanvas.height = imageHeight * scale;
      const offscreenCtx = offscreenCanvas.getContext('2d');
      
      if (!offscreenCtx) return;
      
      // Scale everything up
      offscreenCtx.scale(scale, scale);
      
      // Draw the image
      offscreenCtx.drawImage(image, 0, 0, imageWidth, imageHeight);
      
      // Set the display canvas size
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      
      const actualX = (x / 100) * imageWidth;
      const actualY = (y / 100) * imageHeight;
      
      const scaledFontSize = (fontSize / 100) * imageWidth;
      
      const lines = processText(text);
      
      // Draw text on high-res canvas
      lines.forEach((line, lineIndex) => {
        let currentX = actualX;
        const lineHeight = scaledFontSize * 1.2;
        const currentY = actualY + lineIndex * lineHeight;
        
        let totalWidth = 0;
        line.parts.forEach(part => {
          offscreenCtx.font = `${part.isSuper ? scaledFontSize * 0.7 : scaledFontSize}px HelveticaNeue-Condensed`;
          totalWidth += offscreenCtx.measureText(part.text).width;
        });
        
        if (line.align === 'center') {
          currentX = actualX + (imageWidth - totalWidth) / 2;
        } else if (line.align === 'right') {
          currentX = actualX + imageWidth - totalWidth;
        }
        
        line.parts.forEach(part => {
          offscreenCtx.font = `${part.isSuper ? scaledFontSize * 0.7 : scaledFontSize}px HelveticaNeue-Condensed`;
          offscreenCtx.fillStyle = fontColor;
          offscreenCtx.fillText(
            part.text,
            currentX,
            currentY - (part.isSuper ? scaledFontSize * 0.3 : 0)
          );
          currentX += offscreenCtx.measureText(part.text).width;
        });
      });
      
      // Draw the high-res canvas onto the display canvas with smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(offscreenCanvas, 0, 0, imageWidth * scale, imageHeight * scale, 0, 0, imageWidth, imageHeight);
      
      onLoad();
    };
    
    image.onerror = () => {
      onError('Failed to load image');
    };
    
    if (imageUrl) {
      image.src = imageUrl;
    } else {
      canvas.width = 800;
      canvas.height = 600;
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666666';
      ctx.font = '16px HelveticaNeue-Condensed';
      ctx.textAlign = 'center';
      ctx.fillText('Please enter an image URL', canvas.width / 2, canvas.height / 2);
    }
  }, [text, imageUrl, fontSize, fontColor, x, y, width, height, onLoad, onError, onImageLoad, fontLoaded]);

  return (
    <canvas
      ref={canvasRef}
      className="slds-border_around"
      style={{
        maxWidth: '100%',
        height: 'auto',
        aspectRatio: imageAspectRatio
      }}
    />
  );
}
import { useEffect, useRef, useState } from 'react';
import { Icons } from './Icons';

interface CanvasGeneratorProps {
  text: string;
  imageUrl: string;
  fontSize: number;
  fontColor: string;
  x: number;
  y: number;
  width: number;
  height: number;
  brightness: number; // Added brightness property
  imageZoom: number; // New: Control image zoom level (1 = 100%)
  imageX: number; // New: Control image horizontal position (0-100)
  imageY: number; // New: Control image vertical position (0-100)
  onLoad: () => void;
  onError: (message: string) => void;
  onImageLoad?: (dimensions: { width: number; height: number }) => void;
  onPositionChange?: (newX: number, newY: number) => void;
  onImageTransformChange?: (transform: { zoom: number; x: number; y: number }) => void;
  className?: string;
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
  brightness = 100, // Default to normal brightness (100%)
  imageZoom = 1, // Default to no zoom (100%)
  imageX = 0, // Default to no horizontal offset
  imageY = 0, // Default to no vertical offset
  onLoad,
  onError,
  onImageLoad,
  onPositionChange,
  onImageTransformChange,
  className = ''
}: CanvasGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(1);
  const [fontLoaded, setFontLoaded] = useState(false);
  const fontLoadingAttempted = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showDragHint, setShowDragHint] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

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

  // Apply brightness filter to the image
  const applyBrightnessFilter = (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, brightnessValue: number) => {
    // Only apply if brightness is not 100% (normal)
    if (brightnessValue !== 100) {
      const brightnessRatio = brightnessValue / 100;
      
      // Get the current image data for the full canvas dimensions
      const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      const data = imageData.data;
      
      // Apply brightness adjustment
      for (let i = 0; i < data.length; i += 4) {
        // Adjust RGB values based on brightness ratio
        data[i] = Math.min(255, Math.max(0, data[i] * brightnessRatio));         // Red
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * brightnessRatio)); // Green
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * brightnessRatio)); // Blue
        // Alpha (i+3) remains unchanged
      }
      
      // Put the modified image data back on the full canvas
      ctx.putImageData(imageData, 0, 0);
    }
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
      
      // Set the display canvas size
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      
      const displayCtx = canvas.getContext('2d');
      if (!displayCtx) return;

      // Calculate scaled dimensions based on zoom
      const scaledWidth = imageWidth * imageZoom;
      const scaledHeight = imageHeight * imageZoom;
      
      // Calculate position offsets
      const offsetX = ((imageX / 100) * (scaledWidth - imageWidth));
      const offsetY = ((imageY / 100) * (scaledHeight - imageHeight));
      
      // Clear the canvas
      displayCtx.clearRect(0, 0, imageWidth, imageHeight);
      
      // Draw the image with transformations
      displayCtx.save();
      displayCtx.translate(-offsetX, -offsetY);
      displayCtx.drawImage(image, 0, 0, scaledWidth, scaledHeight);
      displayCtx.restore();
      
      // Apply brightness filter
      applyBrightnessFilter(displayCtx, imageWidth, imageHeight, brightness);

      // Draw text overlays
      const actualX = (x / 100) * imageWidth;
      const actualY = (y / 100) * imageHeight;
      const scaledFontSize = (fontSize / 100) * imageWidth;
      const lines = processText(text);
      
      // Now draw text directly on the display canvas with the brightness already applied
      lines.forEach((line, lineIndex) => {
        let currentX = actualX;
        const lineHeight = scaledFontSize * 1.2;
        const currentY = actualY + lineIndex * lineHeight;
        
        let totalWidth = 0;
        line.parts.forEach(part => {
          displayCtx.font = `${part.isSuper ? scaledFontSize * 0.7 : scaledFontSize}px HelveticaNeue-Condensed`;
          totalWidth += displayCtx.measureText(part.text).width;
        });
        
        if (line.align === 'center') {
          currentX = actualX + (imageWidth - totalWidth) / 2;
        } else if (line.align === 'right') {
          currentX = actualX + imageWidth - totalWidth;
        }
        
        line.parts.forEach(part => {
          displayCtx.font = `${part.isSuper ? scaledFontSize * 0.7 : scaledFontSize}px HelveticaNeue-Condensed`;
          displayCtx.fillStyle = fontColor;
          displayCtx.fillText(
            part.text,
            currentX,
            currentY - (part.isSuper ? scaledFontSize * 0.3 : 0)
          );
          currentX += displayCtx.measureText(part.text).width;
        });
      });
      
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
  }, [text, imageUrl, fontSize, fontColor, x, y, width, height, brightness, imageZoom, imageX, imageY, onLoad, onError, onImageLoad, fontLoaded]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    
    const actualX = (x / 100) * canvas.width;
    const actualY = (y / 100) * canvas.height;
    const scaledFontSize = (fontSize / 100) * canvas.width;
    
    // Simple text bounds check (can be refined based on actual text metrics)
    const lines = text.split('\n');
    let isWithinText = false;
    
    lines.forEach((line, index) => {
      const lineY = actualY + index * (scaledFontSize * 1.2);
      const textWidth = line.length * scaledFontSize * 0.6; // Approximate width
      
      if (
        clickX >= actualX - scaledFontSize * 0.5 &&
        clickX <= actualX + textWidth + scaledFontSize * 0.5 &&
        clickY >= lineY - scaledFontSize * 1.2 &&
        clickY <= lineY + scaledFontSize * 0.2
      ) {
        isWithinText = true;
      }
    });
    
    if (isWithinText) {
      setIsDragging(true);
      setDragOffset({
        x: clickX - actualX,
        y: clickY - actualY
      });
      canvas.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    
    const newX = Math.max(0, Math.min(100, ((mouseX - dragOffset.x) / canvas.width) * 100));
    const newY = Math.max(0, Math.min(100, ((mouseY - dragOffset.y) / canvas.height) * 100));
    
    onPositionChange?.(newX, newY);
  };

  const handleMouseUp = () => {
    if (isDragging && canvasRef.current) {
      canvasRef.current.style.cursor = 'grab';
      setIsDragging(false);
    }
  };

  const handleMouseLeave = () => {
    if (isDragging && canvasRef.current) {
      canvasRef.current.style.cursor = 'grab';
      setIsDragging(false);
    }
    setShowDragHint(false);
    setIsHovering(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || e.touches.length !== 1) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const touch = e.touches[0];
    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;
    
    // Reuse the same bounds checking logic
    const actualX = (x / 100) * canvas.width;
    const actualY = (y / 100) * canvas.height;
    const scaledFontSize = (fontSize / 100) * canvas.width;
    
    const lines = text.split('\n');
    let isWithinText = false;
    
    lines.forEach((line, index) => {
      const lineY = actualY + index * (scaledFontSize * 1.2);
      const textWidth = line.length * scaledFontSize * 0.6;
      
      if (
        touchX >= actualX - scaledFontSize * 0.5 &&
        touchX <= actualX + textWidth + scaledFontSize * 0.5 &&
        touchY >= lineY - scaledFontSize * 1.2 &&
        touchY <= lineY + scaledFontSize * 0.2
      ) {
        isWithinText = true;
      }
    });
    
    if (isWithinText) {
      setIsDragging(true);
      setDragOffset({
        x: touchX - actualX,
        y: touchY - actualY
      });
      e.preventDefault(); // Prevent scrolling while dragging
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || !canvasRef.current || e.touches.length !== 1) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const touch = e.touches[0];
    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;
    
    const newX = Math.max(0, Math.min(100, ((touchX - dragOffset.x) / canvas.width) * 100));
    const newY = Math.max(0, Math.min(100, ((touchY - dragOffset.y) / canvas.height) * 100));
    
    onPositionChange?.(newX, newY);
    e.preventDefault(); // Prevent scrolling while dragging
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleMouseEnter = () => {
    if (text) {
      setShowDragHint(true);
    }
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'grab';
    }
    setIsHovering(true);
  };

  return (
    <div className="canvas-container slds-p-around_medium slds-m-bottom_medium">
      <canvas
        ref={canvasRef}
        className={`slds-border_around preview-canvas ${className}`}
        style={{
          maxWidth: '100%',
          height: 'auto',
          aspectRatio: imageAspectRatio,
          cursor: isDragging ? 'grabbing' : 'grab',
          boxShadow: isHovering 
            ? '0 8px 16px rgba(0, 0, 0, 0.1)' 
            : '0 4px 6px rgba(0, 0, 0, 0.05)',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          transform: isDragging 
            ? 'scale(1.01)' 
            : isHovering 
              ? 'scale(1.005)' 
              : 'scale(1)',
          borderRadius: '8px',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      {showDragHint && (
        <div className="drag-instruction">
          <div className="drag-hint-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 9L12 5L16 9M8 15L12 19L16 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Drag text to reposition</span>
          </div>
        </div>
      )}
    </div>
  );
}
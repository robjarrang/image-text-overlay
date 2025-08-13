import { useEffect, useRef, useState } from 'react';
import { Icons } from './Icons';
import { TextOverlay } from './ClientApp';

interface CanvasGeneratorProps {
  textOverlays: TextOverlay[];
  activeOverlayId: string | null;
  imageUrl: string;
  width: number;
  height: number;
  brightness: number;
  imageZoom: number; 
  imageX: number;
  imageY: number;
  onLoad: () => void;
  onError: (message: string) => void;
  onImageLoad?: (dimensions: { width: number; height: number }) => void;
  onPositionChange?: (overlayId: string, newX: number, newY: number) => void;
  onImageTransformChange?: (transform: { zoom: number; x: number; y: number }) => void;
  className?: string;
}

export function CanvasGenerator({
  textOverlays,
  activeOverlayId,
  imageUrl,
  width,
  height,
  brightness = 100,
  imageZoom = 1,
  imageX = 0,
  imageY = 0,
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
  const [draggedOverlayId, setDraggedOverlayId] = useState<string | null>(null);
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
          'url(/fonts/Helvetica Neue LT Pro 93 Black Extended.otf)'
        );

        await font.load();
        document.fonts.add(font);
        setFontLoaded(true);
      } catch (localError) {
        console.warn('Failed to load font locally, trying backup URL:', localError);
        
        try {
          // Fallback to S3 URL as a last resort
          const font = new FontFace(
            'HelveticaNeue-Condensed',
            'url(https://jarrang-font.s3.eu-west-2.amazonaws.com/milwaukee/Helvetica Neue LT Pro 93 Black Extended.otf)'
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
    const lines = text.split('\n');
    let currentAlign = 'left'; // Default alignment
    
    return lines.map(line => {
      // Check if this line has an alignment tag
      const alignMatch = line.match(/\[(center|left|right)\]/);
      if (alignMatch) {
        // Update the current alignment for this and subsequent lines
        currentAlign = alignMatch[1];
        // Remove the alignment tag from the line
        line = line.replace(/\[(center|left|right)\]/g, '');
      }
      
      // Process superscript
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
      
      return { parts, align: currentAlign }; // Use the current alignment
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

  // Draw a single text overlay
  const drawTextOverlay = (
    ctx: CanvasRenderingContext2D, 
    overlay: TextOverlay, 
    canvasWidth: number,
    canvasHeight: number
  ) => {
    const actualX = (overlay.x / 100) * canvasWidth;
    const actualY = (overlay.y / 100) * canvasHeight; // Fixed: use canvasHeight for Y-axis
    const scaledFontSize = (overlay.fontSize / 100) * canvasWidth;
    const lines = processText(overlay.text);

    lines.forEach((line, lineIndex) => {
      let lineX = actualX;
      const lineHeight = scaledFontSize * 1.2;
      const currentY = actualY + lineIndex * lineHeight;
      
      // Calculate total width for alignment
      let totalWidth = 0;
      line.parts.forEach(part => {
        const partSize = part.isSuper ? scaledFontSize * 0.7 : scaledFontSize;
        ctx.font = `${partSize}px HelveticaNeue-Condensed`;
        totalWidth += ctx.measureText(part.text).width;
      });
      
      // Adjust position based on alignment
      if (line.align === 'center') {
        lineX = actualX - (totalWidth / 2);
      } else if (line.align === 'right') {
        lineX = actualX - totalWidth;
      }
      
      // Draw each part of the line
      let currentX = lineX;
      line.parts.forEach(part => {
        const partSize = part.isSuper ? scaledFontSize * 0.7 : scaledFontSize;
        ctx.font = `${partSize}px HelveticaNeue-Condensed`;
        ctx.fillStyle = overlay.fontColor;
        ctx.fillText(
          part.text,
          currentX,
          currentY - (part.isSuper ? scaledFontSize * 0.3 : 0)
        );
        currentX += ctx.measureText(part.text).width;
      });
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

      // Draw all text overlays
      textOverlays.forEach(overlay => {
        drawTextOverlay(displayCtx, overlay, imageWidth, imageHeight);
      });
      
      onLoad();
    };
    
    image.onerror = () => {
      onError('Failed to load image');
    };
    
    if (imageUrl && imageUrl !== 'transparent') {
      image.src = imageUrl;
    } else if (imageUrl === 'transparent') {
      // Handle transparent canvas mode
      const canvasWidth = width;
      const canvasHeight = height;
      setImageAspectRatio(canvasWidth / canvasHeight);
      
      onImageLoad?.({ width: canvasWidth, height: canvasHeight });
      
      // Set the canvas size
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      const displayCtx = canvas.getContext('2d');
      if (!displayCtx) return;

      // Clear the canvas to transparent
      displayCtx.clearRect(0, 0, canvasWidth, canvasHeight);
      
      // Draw all text overlays on transparent background
      textOverlays.forEach(overlay => {
        drawTextOverlay(displayCtx, overlay, canvasWidth, canvasHeight);
      });
      
      onLoad();
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
  }, [textOverlays, imageUrl, brightness, imageZoom, imageX, imageY, onLoad, onError, onImageLoad, fontLoaded]);

  // Check if a point is within a text overlay's bounds
  const isPointInTextOverlay = (
    overlay: TextOverlay,
    x: number, 
    y: number, 
    canvasWidth: number,
    canvasHeight: number
  ): boolean => {
    const actualX = (overlay.x / 100) * canvasWidth;
    const actualY = (overlay.y / 100) * canvasHeight; // Fixed: use canvasHeight for Y-axis
    const scaledFontSize = (overlay.fontSize / 100) * canvasWidth;
    
    // Process text to get proper alignment and bounds
    const processedLines = processText(overlay.text);
    
    // Check each line for hit testing
    for (let i = 0; i < processedLines.length; i++) {
      const line = processedLines[i];
      const lineY = actualY + i * (scaledFontSize * 1.2);
      
      // Calculate line width more accurately
      let lineX = actualX;
      let totalWidth = 0;
      
      // Measure all parts of the line for accurate width
      line.parts.forEach(part => {
        const partSize = part.isSuper ? scaledFontSize * 0.7 : scaledFontSize;
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
          ctx.font = `${partSize}px HelveticaNeue-Condensed`;
          totalWidth += ctx.measureText(part.text).width;
        } else {
          // Fallback if context not available
          totalWidth += part.text.length * partSize * 0.6;
        }
      });
      
      // Adjust position based on alignment
      if (line.align === 'center') {
        lineX = actualX - totalWidth / 2;
      } else if (line.align === 'right') {
        lineX = actualX - totalWidth;
      }
      
      // Add padding around the text for easier selection
      const padding = scaledFontSize * 0.5;
      
      // Check if the point is within the bounds of this line
      if (
        x >= lineX - padding &&
        x <= lineX + totalWidth + padding &&
        y >= lineY - scaledFontSize && 
        y <= lineY + padding
      ) {
        return true;
      }
    }
    
    return false;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || textOverlays.length === 0) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factors more accurately
    const scaleFactorX = canvas.width / rect.width;
    const scaleFactorY = canvas.height / rect.height;
    
    const clickX = (e.clientX - rect.left) * scaleFactorX;
    const clickY = (e.clientY - rect.top) * scaleFactorY;

    // Check each overlay (in reverse order to handle overlapping - top one gets priority)
    for (let i = textOverlays.length - 1; i >= 0; i--) {
      const overlay = textOverlays[i];
      
      if (isPointInTextOverlay(overlay, clickX, clickY, canvas.width, canvas.height)) {
        setIsDragging(true);
        setDraggedOverlayId(overlay.id);
        
        // Also make this overlay active for editing
        if (overlay.id !== activeOverlayId) {
          // Find the onPositionChange handler which is provided by ClientApp
          const clientAppHandler = onPositionChange;
          if (clientAppHandler) {
            // Pass a special value to notify ClientApp to change the active overlay
            // without changing position - this is a bit of a hack but works
            clientAppHandler(overlay.id, -1, -1);
          }
        }
        
        // Store percentage position at time of click
        const overlayXPixels = (overlay.x / 100) * canvas.width;
        const overlayYPixels = (overlay.y / 100) * canvas.height; // Fixed: use canvas height
        
        setDragOffset({
          x: clickX - overlayXPixels,
          y: clickY - overlayYPixels
        });
        
        canvas.style.cursor = 'grabbing';
        return; // Exit after finding the first match
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !draggedOverlayId || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factors more accurately
    const scaleFactorX = canvas.width / rect.width;
    const scaleFactorY = canvas.height / rect.height;
    
    // Get mouse position in canvas pixel coordinates
    const mouseX = (e.clientX - rect.left) * scaleFactorX;
    const mouseY = (e.clientY - rect.top) * scaleFactorY;
    
    // Calculate new position as percentage of canvas dimensions - fixing Y axis to use height
    const newX = Math.max(0, Math.min(100, ((mouseX - dragOffset.x) / canvas.width) * 100));
    const newY = Math.max(0, Math.min(100, ((mouseY - dragOffset.y) / canvas.height) * 100));
    
    onPositionChange?.(draggedOverlayId, newX, newY);
  };

  const handleMouseUp = () => {
    if (isDragging && canvasRef.current) {
      canvasRef.current.style.cursor = 'grab';
      setIsDragging(false);
      setDraggedOverlayId(null);
    }
  };

  const handleMouseLeave = () => {
    if (isDragging && canvasRef.current) {
      canvasRef.current.style.cursor = 'grab';
      setIsDragging(false);
      setDraggedOverlayId(null);
    }
    setShowDragHint(false);
    setIsHovering(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || e.touches.length !== 1 || textOverlays.length === 0) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factors more accurately
    const scaleFactorX = canvas.width / rect.width;
    const scaleFactorY = canvas.height / rect.height;
    
    const touch = e.touches[0];
    const touchX = (touch.clientX - rect.left) * scaleFactorX;
    const touchY = (touch.clientY - rect.top) * scaleFactorY;
    
    // Check each overlay (in reverse order to handle overlapping - top one gets priority)
    for (let i = textOverlays.length - 1; i >= 0; i--) {
      const overlay = textOverlays[i];
      
      if (isPointInTextOverlay(overlay, touchX, touchY, canvas.width, canvas.height)) {
        setIsDragging(true);
        setDraggedOverlayId(overlay.id);
        
        // Store percentage position at time of touch
        const overlayXPixels = (overlay.x / 100) * canvas.width;
        const overlayYPixels = (overlay.y / 100) * canvas.height; // Fixed: use canvas height
        
        setDragOffset({
          x: touchX - overlayXPixels,
          y: touchY - overlayYPixels
        });
        
        e.preventDefault(); // Prevent scrolling while dragging
        return; // Exit after finding the first match
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || !draggedOverlayId || !canvasRef.current || e.touches.length !== 1) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factors more accurately
    const scaleFactorX = canvas.width / rect.width;
    const scaleFactorY = canvas.height / rect.height;
    
    const touch = e.touches[0];
    const touchX = (touch.clientX - rect.left) * scaleFactorX;
    const touchY = (touch.clientY - rect.top) * scaleFactorY;
    
    // Calculate new position as percentage of canvas dimensions - fixing Y axis to use height
    const newX = Math.max(0, Math.min(100, ((touchX - dragOffset.x) / canvas.width) * 100));
    const newY = Math.max(0, Math.min(100, ((touchY - dragOffset.y) / canvas.height) * 100));
    
    onPositionChange?.(draggedOverlayId, newX, newY);
    e.preventDefault(); // Prevent scrolling while dragging
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setDraggedOverlayId(null);
  };

  const handleMouseEnter = () => {
    if (textOverlays.length > 0) {
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
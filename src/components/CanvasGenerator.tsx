import { useEffect, useRef, useState } from 'react';
import { Icons } from './Icons';
import { TextOverlay, ImageOverlay } from './ClientApp';

interface CanvasGeneratorProps {
  textOverlays: TextOverlay[];
  imageOverlays: ImageOverlay[];
  activeOverlayId: string | null;
  activeOverlayType: 'text' | 'image' | null;
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
  onFontSizeChange?: (overlayId: string, newFontSize: number) => void;
  onImageSizeChange?: (overlayId: string, newWidth: number) => void;
  onImageTransformChange?: (transform: { zoom: number; x: number; y: number }) => void;
  className?: string;
  isDesktopMobileMode?: boolean;
  desktopMobileVersion?: 'desktop' | 'mobile';
}

export function CanvasGenerator({
  textOverlays,
  imageOverlays,
  activeOverlayId,
  activeOverlayType,
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
  onFontSizeChange,
  onImageSizeChange,
  onImageTransformChange,
  className = '',
  isDesktopMobileMode = false,
  desktopMobileVersion = 'desktop'
}: CanvasGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number>(1);
  const [fontLoaded, setFontLoaded] = useState(false);
  const fontLoadingAttempted = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedOverlayId, setDraggedOverlayId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [initialDragPosition, setInitialDragPosition] = useState({ x: 0, y: 0 });
  const [showDragHint, setShowDragHint] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const hoveredOverlayIdRef = useRef<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeOverlayId, setResizeOverlayId] = useState<string | null>(null);
  const [initialFontSize, setInitialFontSize] = useState(0);
  const [resizeStartDistance, setResizeStartDistance] = useState(0);

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

  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    fontSize: number
  ): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    ctx.font = `${fontSize}px HelveticaNeue-Condensed`;
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  };

  const processText = (text: string, alignment: 'left' | 'center' | 'right' = 'left') => {
    const lines = text.split('\n');
    
    return lines.map(line => {
      // Remove legacy alignment tags if present
      line = line.replace(/\[(center|left|right)\]/g, '');
      
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
      
      return { parts, align: alignment };
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
    // Use appropriate position based on desktop/mobile mode
    let effectiveX = overlay.x;
    let effectiveY = overlay.y;
    if (isDesktopMobileMode && desktopMobileVersion) {
      if (desktopMobileVersion === 'desktop') {
        effectiveX = overlay.desktopX ?? overlay.x;
        effectiveY = overlay.desktopY ?? overlay.y;
      } else if (desktopMobileVersion === 'mobile') {
        effectiveX = overlay.mobileX ?? overlay.x;
        effectiveY = overlay.mobileY ?? overlay.y;
      }
    }
    
    const actualX = (effectiveX / 100) * canvasWidth;
    const actualY = (effectiveY / 100) * canvasHeight;
    
    // Use appropriate font size based on desktop/mobile mode
    let effectiveFontSize = overlay.fontSize;
    if (isDesktopMobileMode && desktopMobileVersion) {
      if (desktopMobileVersion === 'desktop' && overlay.desktopFontSize !== undefined) {
        effectiveFontSize = overlay.desktopFontSize;
      } else if (desktopMobileVersion === 'mobile' && overlay.mobileFontSize !== undefined) {
        effectiveFontSize = overlay.mobileFontSize;
      }
    }
    
    const scaledFontSize = (effectiveFontSize / 100) * canvasWidth;
    const maxWidth = canvasWidth * 0.8; // 80% of canvas width for wrapping
    const lines = processText(overlay.text, overlay.alignment);

    let currentLineIndex = 0;

    lines.forEach((line, originalLineIndex) => {
      // Calculate total width of all parts on this line to handle alignment
      let totalLineWidth = 0;
      line.parts.forEach(part => {
        const partSize = part.isSuper ? scaledFontSize * 0.7 : scaledFontSize;
        ctx.font = `${partSize}px HelveticaNeue-Condensed`;
        const displayText = overlay.allCaps ? part.text.toUpperCase() : part.text;
        totalLineWidth += ctx.measureText(displayText).width;
      });
      
      // Calculate starting X position based on alignment
      let lineStartX = actualX;
      if (line.align === 'center') {
        lineStartX = actualX - (totalLineWidth / 2);
      } else if (line.align === 'right') {
        lineStartX = actualX - totalLineWidth;
      }
      
      let currentX = lineStartX;
      
      // For each processed line, draw all parts on the same line
      line.parts.forEach((part, partIndex) => {
        const partSize = part.isSuper ? scaledFontSize * 0.7 : scaledFontSize;
        const lineHeight = scaledFontSize * 1.2;
        const currentY = actualY + currentLineIndex * lineHeight;
        const textY = currentY - (part.isSuper ? scaledFontSize * 0.3 : 0);
        
        // Set font for this part
        ctx.font = `${partSize}px HelveticaNeue-Condensed`;
        const displayText = overlay.allCaps ? part.text.toUpperCase() : part.text;
        const textWidth = ctx.measureText(displayText).width;
        
        // Draw the actual text (hover effects are drawn on overlay canvas)
        ctx.fillStyle = overlay.fontColor;
        ctx.fillText(displayText, currentX, textY);
        
        // Move X position for next part
        currentX += textWidth;
      });
      
      // Only increment line index once per logical line (not per part)
      currentLineIndex++;
    });
  };

  // Draw hover effect for image overlays
  const drawImageHoverEffect = (
    ctx: CanvasRenderingContext2D,
    actualX: number,
    actualY: number,
    actualWidth: number,
    actualHeight: number
  ) => {
    ctx.save();
    const padding = 4;
    const boxX = actualX - padding;
    const boxY = actualY - padding;
    const boxWidth = actualWidth + (padding * 2);
    const boxHeight = actualHeight + (padding * 2);

    // Light blue background
    ctx.fillStyle = 'rgba(0, 123, 255, 0.1)';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    // Blue border outline
    ctx.strokeStyle = 'rgba(0, 123, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // Draw resize handle in bottom-right corner
    const handleSize = Math.max(8, actualWidth * 0.05);
    const handleX = boxX + boxWidth - handleSize;
    const handleY = boxY + boxHeight - handleSize;

    // Handle background
    ctx.fillStyle = 'rgba(0, 123, 255, 0.8)';
    ctx.fillRect(handleX, handleY, handleSize, handleSize);

    // Handle border
    ctx.strokeStyle = 'rgba(0, 123, 255, 1)';
    ctx.strokeRect(handleX, handleY, handleSize, handleSize);

    // Draw diagonal lines in the handle
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const offset = (i + 1) * handleSize / 4;
      ctx.beginPath();
      ctx.moveTo(handleX + offset, handleY + handleSize);
      ctx.lineTo(handleX + handleSize, handleY + offset);
      ctx.stroke();
    }

    ctx.restore();
  };

  // Draw a single image overlay
  const drawImageOverlay = (
    ctx: CanvasRenderingContext2D,
    overlay: ImageOverlay,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    // Use appropriate position based on desktop/mobile mode
    let effectiveX = overlay.x;
    let effectiveY = overlay.y;
    if (isDesktopMobileMode && desktopMobileVersion) {
      if (desktopMobileVersion === 'desktop') {
        effectiveX = overlay.desktopX ?? overlay.x;
        effectiveY = overlay.desktopY ?? overlay.y;
      } else if (desktopMobileVersion === 'mobile') {
        effectiveX = overlay.mobileX ?? overlay.x;
        effectiveY = overlay.mobileY ?? overlay.y;
      }
    }

    // Use appropriate size based on desktop/mobile mode
    let effectiveWidth = overlay.width;
    let effectiveHeight = overlay.height;
    if (isDesktopMobileMode && desktopMobileVersion) {
      if (desktopMobileVersion === 'desktop') {
        effectiveWidth = overlay.desktopWidth ?? overlay.width;
        effectiveHeight = overlay.desktopHeight ?? overlay.height;
      } else if (desktopMobileVersion === 'mobile') {
        effectiveWidth = overlay.mobileWidth ?? overlay.width;
        effectiveHeight = overlay.mobileHeight ?? overlay.height;
      }
    }

    const actualX = (effectiveX / 100) * canvasWidth;
    const actualY = (effectiveY / 100) * canvasHeight;
    const actualWidth = (effectiveWidth / 100) * canvasWidth;
    const actualHeight = (effectiveHeight / 100) * canvasWidth; // Maintain consistent scaling with export renderer

    // Create and draw the image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    // Function to draw the image
    const drawImageOnly = () => {
      ctx.drawImage(img, actualX, actualY, actualWidth, actualHeight);
    };
    
    try {
      img.onload = drawImageOnly;
      img.onerror = (error) => {
        console.error('Error loading image overlay:', error);
      };
      
      img.src = overlay.imageUrl;
      
      // For base64 images, this should work immediately
      if (img.complete && img.naturalWidth > 0) {
        drawImageOnly();
      }
    } catch (error) {
      console.error('Error drawing image overlay:', error);
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

      // Draw all image overlays first (behind text)
      imageOverlays.forEach(overlay => {
        drawImageOverlay(displayCtx, overlay, imageWidth, imageHeight);
      });

      // Draw all text overlays (logo is handled server-side for desktop-mobile mode)
      // Hover effects are drawn on the overlay canvas to prevent flicker
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
      
      // Draw all image overlays first (behind text)
      imageOverlays.forEach(overlay => {
        drawImageOverlay(displayCtx, overlay, canvasWidth, canvasHeight);
      });

      // Draw all text overlays on transparent background
      // Hover effects are drawn on the overlay canvas to prevent flicker
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
  }, [textOverlays, imageOverlays, imageUrl, brightness, imageZoom, imageX, imageY, onLoad, onError, onImageLoad, fontLoaded, isDesktopMobileMode, desktopMobileVersion]);

  // Draw hover effects on the overlay canvas (separate from main canvas to prevent flicker)
  const drawHoverEffects = (hoveredId: string | null) => {
    const overlayCanvas = overlayCanvasRef.current;
    const mainCanvas = canvasRef.current;
    if (!overlayCanvas || !mainCanvas) return;
    
    // Sync overlay canvas size with main canvas
    if (overlayCanvas.width !== mainCanvas.width || overlayCanvas.height !== mainCanvas.height) {
      overlayCanvas.width = mainCanvas.width;
      overlayCanvas.height = mainCanvas.height;
    }
    
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;
    
    // Clear the overlay canvas
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    // If not hovering or dragging/resizing, nothing to draw
    if (!hoveredId || isDragging || isResizing) return;
    
    const canvasWidth = overlayCanvas.width;
    const canvasHeight = overlayCanvas.height;
    
    // Check if hovered overlay is an image overlay
    const imageOverlay = imageOverlays.find(o => o.id === hoveredId);
    if (imageOverlay) {
      let effectiveX = imageOverlay.x;
      let effectiveY = imageOverlay.y;
      let effectiveWidth = imageOverlay.width;
      let effectiveHeight = imageOverlay.height;
      
      if (isDesktopMobileMode && desktopMobileVersion) {
        if (desktopMobileVersion === 'desktop') {
          effectiveX = imageOverlay.desktopX ?? imageOverlay.x;
          effectiveY = imageOverlay.desktopY ?? imageOverlay.y;
          effectiveWidth = imageOverlay.desktopWidth ?? imageOverlay.width;
          effectiveHeight = imageOverlay.desktopHeight ?? imageOverlay.height;
        } else if (desktopMobileVersion === 'mobile') {
          effectiveX = imageOverlay.mobileX ?? imageOverlay.x;
          effectiveY = imageOverlay.mobileY ?? imageOverlay.y;
          effectiveWidth = imageOverlay.mobileWidth ?? imageOverlay.width;
          effectiveHeight = imageOverlay.mobileHeight ?? imageOverlay.height;
        }
      }

      const actualX = (effectiveX / 100) * canvasWidth;
      const actualY = (effectiveY / 100) * canvasHeight;
      const actualWidth = (effectiveWidth / 100) * canvasWidth;
      const actualHeight = (effectiveHeight / 100) * canvasWidth;

      drawImageHoverEffect(ctx, actualX, actualY, actualWidth, actualHeight);
      return;
    }
    
    // Check if hovered overlay is a text overlay
    const textOverlay = textOverlays.find(o => o.id === hoveredId);
    if (textOverlay) {
      // Get effective position and font size
      let effectiveX = textOverlay.x;
      let effectiveY = textOverlay.y;
      let effectiveFontSize = textOverlay.fontSize;
      
      if (isDesktopMobileMode && desktopMobileVersion) {
        if (desktopMobileVersion === 'desktop') {
          effectiveX = textOverlay.desktopX ?? textOverlay.x;
          effectiveY = textOverlay.desktopY ?? textOverlay.y;
          if (textOverlay.desktopFontSize !== undefined) {
            effectiveFontSize = textOverlay.desktopFontSize;
          }
        } else if (desktopMobileVersion === 'mobile') {
          effectiveX = textOverlay.mobileX ?? textOverlay.x;
          effectiveY = textOverlay.mobileY ?? textOverlay.y;
          if (textOverlay.mobileFontSize !== undefined) {
            effectiveFontSize = textOverlay.mobileFontSize;
          }
        }
      }
      
      const actualX = (effectiveX / 100) * canvasWidth;
      const actualY = (effectiveY / 100) * canvasHeight;
      const scaledFontSize = (effectiveFontSize / 100) * canvasWidth;
      
      // Process text to get all lines and parts
      const lines = processText(textOverlay.text, textOverlay.alignment);
      let currentLineIndex = 0;
      
      lines.forEach((line) => {
        // Calculate total line width for alignment
        let totalLineWidth = 0;
        line.parts.forEach((part) => {
          const partSize = part.isSuper ? scaledFontSize * 0.7 : scaledFontSize;
          ctx.font = `${partSize}px HelveticaNeue-Condensed`;
          const displayText = textOverlay.allCaps ? part.text.toUpperCase() : part.text;
          totalLineWidth += ctx.measureText(displayText).width;
        });
        
        // Calculate starting X position based on alignment
        let lineStartX = actualX;
        if (line.align === 'center') {
          lineStartX = actualX - (totalLineWidth / 2);
        } else if (line.align === 'right') {
          lineStartX = actualX - totalLineWidth;
        }
        
        let currentX = lineStartX;
        const lineHeight = scaledFontSize * 1.2;
        const currentY = actualY + currentLineIndex * lineHeight;
        
        line.parts.forEach((part, partIndex) => {
          const partSize = part.isSuper ? scaledFontSize * 0.7 : scaledFontSize;
          const textY = currentY - (part.isSuper ? scaledFontSize * 0.3 : 0);
          
          ctx.font = `${partSize}px HelveticaNeue-Condensed`;
          const displayText = textOverlay.allCaps ? part.text.toUpperCase() : part.text;
          const textWidth = ctx.measureText(displayText).width;
          
          // Draw hover effect
          ctx.save();
          const padding = partSize * 0.1;
          const boxX = currentX - padding;
          const boxY = textY - partSize - padding;
          const boxWidth = textWidth + (padding * 2);
          const boxHeight = partSize + (padding * 2);
          
          // Light blue background
          ctx.fillStyle = 'rgba(0, 123, 255, 0.1)';
          ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
          
          // Blue border outline
          ctx.strokeStyle = 'rgba(0, 123, 255, 0.3)';
          ctx.lineWidth = Math.max(1, partSize * 0.015);
          ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
          
          // Draw resize handle only on the last part of the line
          if (partIndex === line.parts.length - 1) {
            const handleSize = Math.max(8, partSize * 0.15);
            const handleX = boxX + boxWidth - handleSize;
            const handleY = boxY + boxHeight - handleSize;
            
            // Handle background
            ctx.fillStyle = 'rgba(0, 123, 255, 0.8)';
            ctx.fillRect(handleX, handleY, handleSize, handleSize);
            
            // Handle border
            ctx.strokeStyle = 'rgba(0, 123, 255, 1)';
            ctx.strokeRect(handleX, handleY, handleSize, handleSize);
            
            // Draw diagonal lines in the handle
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
              const offset = (i + 1) * handleSize / 4;
              ctx.beginPath();
              ctx.moveTo(handleX + offset, handleY + handleSize);
              ctx.lineTo(handleX + handleSize, handleY + offset);
              ctx.stroke();
            }
          }
          
          ctx.restore();
          currentX += textWidth;
        });
        
        currentLineIndex++;
      });
    }
  };

  // Check if a point is within a text overlay's bounds
  const isPointInTextOverlay = (
    overlay: TextOverlay,
    x: number, 
    y: number, 
    canvasWidth: number,
    canvasHeight: number
  ): boolean => {
    // Use appropriate position based on desktop/mobile mode
    let effectiveX = overlay.x;
    let effectiveY = overlay.y;
    if (isDesktopMobileMode && desktopMobileVersion) {
      if (desktopMobileVersion === 'desktop') {
        effectiveX = overlay.desktopX ?? overlay.x;
        effectiveY = overlay.desktopY ?? overlay.y;
      } else if (desktopMobileVersion === 'mobile') {
        effectiveX = overlay.mobileX ?? overlay.x;
        effectiveY = overlay.mobileY ?? overlay.y;
      }
    }
    
    const actualX = (effectiveX / 100) * canvasWidth;
    const actualY = (effectiveY / 100) * canvasHeight; // Fixed: use canvasHeight for Y-axis
    
    // Use appropriate font size based on desktop/mobile mode
    let effectiveFontSize = overlay.fontSize;
    if (isDesktopMobileMode && desktopMobileVersion) {
      if (desktopMobileVersion === 'desktop' && overlay.desktopFontSize !== undefined) {
        effectiveFontSize = overlay.desktopFontSize;
      } else if (desktopMobileVersion === 'mobile' && overlay.mobileFontSize !== undefined) {
        effectiveFontSize = overlay.mobileFontSize;
      }
    }
    
    const scaledFontSize = (effectiveFontSize / 100) * canvasWidth;
    
    // Process text to get proper alignment and bounds
    const processedLines = processText(overlay.text, overlay.alignment);
    
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
          const measureText = overlay.allCaps ? part.text.toUpperCase() : part.text;
          totalWidth += ctx.measureText(measureText).width;
        } else {
          // Fallback if context not available
          const measureText = overlay.allCaps ? part.text.toUpperCase() : part.text;
          totalWidth += measureText.length * partSize * 0.6;
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

  // Check if a point is within an image overlay's bounds
  const isPointInImageOverlay = (
    overlay: ImageOverlay,
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number
  ): boolean => {
    // Use appropriate position based on desktop/mobile mode
    let effectiveX = overlay.x;
    let effectiveY = overlay.y;
    if (isDesktopMobileMode && desktopMobileVersion) {
      if (desktopMobileVersion === 'desktop') {
        effectiveX = overlay.desktopX ?? overlay.x;
        effectiveY = overlay.desktopY ?? overlay.y;
      } else if (desktopMobileVersion === 'mobile') {
        effectiveX = overlay.mobileX ?? overlay.x;
        effectiveY = overlay.mobileY ?? overlay.y;
      }
    }

    // Use appropriate size based on desktop/mobile mode
    let effectiveWidth = overlay.width;
    let effectiveHeight = overlay.height;
    if (isDesktopMobileMode && desktopMobileVersion) {
      if (desktopMobileVersion === 'desktop') {
        effectiveWidth = overlay.desktopWidth ?? overlay.width;
        effectiveHeight = overlay.desktopHeight ?? overlay.height;
      } else if (desktopMobileVersion === 'mobile') {
        effectiveWidth = overlay.mobileWidth ?? overlay.width;
        effectiveHeight = overlay.mobileHeight ?? overlay.height;
      }
    }

    const actualX = (effectiveX / 100) * canvasWidth;
    const actualY = (effectiveY / 100) * canvasHeight;
    const actualWidth = (effectiveWidth / 100) * canvasWidth;
  const actualHeight = (effectiveHeight / 100) * canvasWidth; // Match drawing logic that bases height ratios on width

    // Check if the point is within the bounds of the image
    return (
      x >= actualX &&
      x <= actualX + actualWidth &&
      y >= actualY && 
      y <= actualY + actualHeight
    );
  };

  // Get text overlay bounding box for resize handle detection
  const getTextOverlayBounds = (
    overlay: TextOverlay,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    // Use appropriate position based on desktop/mobile mode
    let effectiveX = overlay.x;
    let effectiveY = overlay.y;
    if (isDesktopMobileMode && desktopMobileVersion) {
      if (desktopMobileVersion === 'desktop') {
        effectiveX = overlay.desktopX ?? overlay.x;
        effectiveY = overlay.desktopY ?? overlay.y;
      } else if (desktopMobileVersion === 'mobile') {
        effectiveX = overlay.mobileX ?? overlay.x;
        effectiveY = overlay.mobileY ?? overlay.y;
      }
    }
    
    const actualX = (effectiveX / 100) * canvasWidth;
    const actualY = (effectiveY / 100) * canvasHeight;
    
    // Use appropriate font size based on desktop/mobile mode
    let effectiveFontSize = overlay.fontSize;
    if (isDesktopMobileMode && desktopMobileVersion) {
      if (desktopMobileVersion === 'desktop' && overlay.desktopFontSize !== undefined) {
        effectiveFontSize = overlay.desktopFontSize;
      } else if (desktopMobileVersion === 'mobile' && overlay.mobileFontSize !== undefined) {
        effectiveFontSize = overlay.mobileFontSize;
      }
    }
    
    const scaledFontSize = (effectiveFontSize / 100) * canvasWidth;
    
    // Simplified bounds calculation - use first line for basic bounds
    const processedLines = processText(overlay.text, overlay.alignment);
    if (processedLines.length === 0) return null;
    
    const firstLine = processedLines[0];
    
    // Calculate approximate width
    let totalWidth = 0;
    firstLine.parts.forEach(part => {
      const partSize = part.isSuper ? scaledFontSize * 0.7 : scaledFontSize;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.font = `${partSize}px HelveticaNeue-Condensed`;
        const textForMeasurement = overlay.allCaps ? part.text.toUpperCase() : part.text;
        totalWidth += ctx.measureText(textForMeasurement).width;
      } else {
        const textForMeasurement = overlay.allCaps ? part.text.toUpperCase() : part.text;
        totalWidth += textForMeasurement.length * partSize * 0.6;
      }
    });
    
    // Adjust for alignment
    let lineX = actualX;
    if (firstLine.align === 'center') {
      lineX = actualX - totalWidth / 2;
    } else if (firstLine.align === 'right') {
      lineX = actualX - totalWidth;
    }
    
    const padding = scaledFontSize * 0.1;
    
    return {
      x: lineX - padding,
      y: actualY - scaledFontSize - padding,
      width: totalWidth + (padding * 2),
      height: scaledFontSize + (padding * 2)
    };
  };

  // Check if point is in resize handle
  const isPointInResizeHandle = (
    overlay: TextOverlay,
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number
  ): boolean => {
    const bounds = getTextOverlayBounds(overlay, canvasWidth, canvasHeight);
    if (!bounds) return false;
    
    // Use appropriate font size for handle size calculation
    let effectiveFontSize = overlay.fontSize;
    if (isDesktopMobileMode && desktopMobileVersion) {
      if (desktopMobileVersion === 'desktop' && overlay.desktopFontSize !== undefined) {
        effectiveFontSize = overlay.desktopFontSize;
      } else if (desktopMobileVersion === 'mobile' && overlay.mobileFontSize !== undefined) {
        effectiveFontSize = overlay.mobileFontSize;
      }
    }
    
    const scaledFontSize = (effectiveFontSize / 100) * canvasWidth;
    const handleSize = Math.max(8, scaledFontSize * 0.15);
    const handleX = bounds.x + bounds.width - handleSize;
    const handleY = bounds.y + bounds.height - handleSize;
    
    return x >= handleX && x <= handleX + handleSize && y >= handleY && y <= handleY + handleSize;
  };

  // Get image overlay bounding box for resize handle detection
  const getImageOverlayBounds = (
    overlay: ImageOverlay,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    // Use appropriate position based on desktop/mobile mode
    let effectiveX = overlay.x;
    let effectiveY = overlay.y;
    if (isDesktopMobileMode && desktopMobileVersion) {
      if (desktopMobileVersion === 'desktop') {
        effectiveX = overlay.desktopX ?? overlay.x;
        effectiveY = overlay.desktopY ?? overlay.y;
      } else if (desktopMobileVersion === 'mobile') {
        effectiveX = overlay.mobileX ?? overlay.x;
        effectiveY = overlay.mobileY ?? overlay.y;
      }
    }

    // Use appropriate size based on desktop/mobile mode
    let effectiveWidth = overlay.width;
    let effectiveHeight = overlay.height;
    if (isDesktopMobileMode && desktopMobileVersion) {
      if (desktopMobileVersion === 'desktop') {
        effectiveWidth = overlay.desktopWidth ?? overlay.width;
        effectiveHeight = overlay.desktopHeight ?? overlay.height;
      } else if (desktopMobileVersion === 'mobile') {
        effectiveWidth = overlay.mobileWidth ?? overlay.width;
        effectiveHeight = overlay.mobileHeight ?? overlay.height;
      }
    }

    const actualX = (effectiveX / 100) * canvasWidth;
    const actualY = (effectiveY / 100) * canvasHeight;
    const actualWidth = (effectiveWidth / 100) * canvasWidth;
  const actualHeight = (effectiveHeight / 100) * canvasWidth; // Keep resize bounds aligned with rendered image

    const padding = 4;

    return {
      x: actualX - padding,
      y: actualY - padding,
      width: actualWidth + (padding * 2),
      height: actualHeight + (padding * 2)
    };
  };

  // Check if point is in image overlay resize handle
  const isPointInImageResizeHandle = (
    overlay: ImageOverlay,
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number
  ): boolean => {
    const bounds = getImageOverlayBounds(overlay, canvasWidth, canvasHeight);
    if (!bounds) return false;

    const handleSize = Math.max(8, bounds.width * 0.05);
    const handleX = bounds.x + bounds.width - handleSize;
    const handleY = bounds.y + bounds.height - handleSize;

    return x >= handleX && x <= handleX + handleSize && y >= handleY && y <= handleY + handleSize;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || (textOverlays.length === 0 && imageOverlays.length === 0)) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factors more accurately
    const scaleFactorX = canvas.width / rect.width;
    const scaleFactorY = canvas.height / rect.height;
    
    const clickX = (e.clientX - rect.left) * scaleFactorX;
    const clickY = (e.clientY - rect.top) * scaleFactorY;

    // First check image overlays (they are rendered on top)
    for (let i = imageOverlays.length - 1; i >= 0; i--) {
      const overlay = imageOverlays[i];
      
      // First check if clicking on resize handle
      if (isPointInImageResizeHandle(overlay, clickX, clickY, canvas.width, canvas.height)) {
        setIsResizing(true);
        setResizeOverlayId(overlay.id);
        // Clear hover effect during resize
        drawHoverEffects(null);
        
        // Store initial width
        let effectiveWidth = overlay.width;
        if (isDesktopMobileMode && desktopMobileVersion) {
          if (desktopMobileVersion === 'desktop' && overlay.desktopWidth !== undefined) {
            effectiveWidth = overlay.desktopWidth;
          } else if (desktopMobileVersion === 'mobile' && overlay.mobileWidth !== undefined) {
            effectiveWidth = overlay.mobileWidth;
          }
        }
        setInitialFontSize(effectiveWidth); // Reuse the same state for initial size
        
        // Calculate initial distance from image center for resize calculation
        let effectiveX = overlay.x;
        let effectiveY = overlay.y;
        if (isDesktopMobileMode && desktopMobileVersion) {
          if (desktopMobileVersion === 'desktop') {
            effectiveX = overlay.desktopX ?? overlay.x;
            effectiveY = overlay.desktopY ?? overlay.y;
          } else if (desktopMobileVersion === 'mobile') {
            effectiveX = overlay.mobileX ?? overlay.x;
            effectiveY = overlay.mobileY ?? overlay.y;
          }
        }
        
        const actualX = (effectiveX / 100) * canvas.width;
        const actualY = (effectiveY / 100) * canvas.height;
        const distance = Math.sqrt(Math.pow(clickX - actualX, 2) + Math.pow(clickY - actualY, 2));
        setResizeStartDistance(distance);
        
        canvas.style.cursor = 'nw-resize';
        return;
      }
      
      // Then check if clicking on image for dragging
      if (isPointInImageOverlay(overlay, clickX, clickY, canvas.width, canvas.height)) {
        setIsDragging(true);
        setDraggedOverlayId(overlay.id);
        // Clear hover effect during drag
        drawHoverEffects(null);
        
        // Also make this overlay active for editing
        if (overlay.id !== activeOverlayId) {
          const clientAppHandler = onPositionChange;
          if (clientAppHandler) {
            clientAppHandler(overlay.id, -1, -1);
          }
        }
        
        // Store the initial mouse position and overlay position for smooth dragging
        let effectiveX = overlay.x;
        let effectiveY = overlay.y;
        if (isDesktopMobileMode && desktopMobileVersion) {
          if (desktopMobileVersion === 'desktop') {
            effectiveX = overlay.desktopX ?? overlay.x;
            effectiveY = overlay.desktopY ?? overlay.y;
          } else if (desktopMobileVersion === 'mobile') {
            effectiveX = overlay.mobileX ?? overlay.x;
            effectiveY = overlay.mobileY ?? overlay.y;
          }
        }
        
        setDragOffset({ x: clickX, y: clickY });
        setInitialDragPosition({ x: effectiveX, y: effectiveY });
        
        canvas.style.cursor = 'grabbing';
        return;
      }
    }

    // Then check text overlays
    for (let i = textOverlays.length - 1; i >= 0; i--) {
      const overlay = textOverlays[i];
      
      // First check if clicking on resize handle
      if (isPointInResizeHandle(overlay, clickX, clickY, canvas.width, canvas.height)) {
        setIsResizing(true);
        setResizeOverlayId(overlay.id);
        // Clear hover effect during resize
        drawHoverEffects(null);
        
        // Store initial font size
        let effectiveFontSize = overlay.fontSize;
        if (isDesktopMobileMode && desktopMobileVersion) {
          if (desktopMobileVersion === 'desktop' && overlay.desktopFontSize !== undefined) {
            effectiveFontSize = overlay.desktopFontSize;
          } else if (desktopMobileVersion === 'mobile' && overlay.mobileFontSize !== undefined) {
            effectiveFontSize = overlay.mobileFontSize;
          }
        }
        setInitialFontSize(effectiveFontSize);
        
        // Calculate initial distance from text center for resize calculation
        let effectiveX = overlay.x;
        let effectiveY = overlay.y;
        if (isDesktopMobileMode && desktopMobileVersion) {
          if (desktopMobileVersion === 'desktop') {
            effectiveX = overlay.desktopX ?? overlay.x;
            effectiveY = overlay.desktopY ?? overlay.y;
          } else if (desktopMobileVersion === 'mobile') {
            effectiveX = overlay.mobileX ?? overlay.x;
            effectiveY = overlay.mobileY ?? overlay.y;
          }
        }
        
        const actualX = (effectiveX / 100) * canvas.width;
        const actualY = (effectiveY / 100) * canvas.height;
        const distance = Math.sqrt(Math.pow(clickX - actualX, 2) + Math.pow(clickY - actualY, 2));
        setResizeStartDistance(distance);
        
        canvas.style.cursor = 'nw-resize';
        return;
      }
      
      // Then check if clicking on text for dragging
      if (isPointInTextOverlay(overlay, clickX, clickY, canvas.width, canvas.height)) {
        setIsDragging(true);
        setDraggedOverlayId(overlay.id);
        // Clear hover effect during drag
        drawHoverEffects(null);
        
        // Also make this overlay active for editing
        if (overlay.id !== activeOverlayId) {
          const clientAppHandler = onPositionChange;
          if (clientAppHandler) {
            clientAppHandler(overlay.id, -1, -1);
          }
        }
        
        // Store the initial mouse position and overlay position for smooth dragging
        let effectiveX = overlay.x;
        let effectiveY = overlay.y;
        if (isDesktopMobileMode && desktopMobileVersion) {
          if (desktopMobileVersion === 'desktop') {
            effectiveX = overlay.desktopX ?? overlay.x;
            effectiveY = overlay.desktopY ?? overlay.y;
          } else if (desktopMobileVersion === 'mobile') {
            effectiveX = overlay.mobileX ?? overlay.x;
            effectiveY = overlay.mobileY ?? overlay.y;
          }
        }
        
        setDragOffset({ x: clickX, y: clickY });
        setInitialDragPosition({ x: effectiveX, y: effectiveY });
        
        canvas.style.cursor = 'grabbing';
        return;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate scale factors more accurately
    const scaleFactorX = canvas.width / rect.width;
    const scaleFactorY = canvas.height / rect.height;
    
    // Get current mouse position in canvas pixel coordinates
    const mouseX = (e.clientX - rect.left) * scaleFactorX;
    const mouseY = (e.clientY - rect.top) * scaleFactorY;
    
    if (isResizing && resizeOverlayId) {
      // Check if it's a text or image overlay
      const textOverlay = textOverlays.find(o => o.id === resizeOverlayId);
      const imageOverlay = imageOverlays.find(o => o.id === resizeOverlayId);
      
      if (textOverlay) {
        // Handle font size resizing for text
        let effectiveX = textOverlay.x;
        let effectiveY = textOverlay.y;
        if (isDesktopMobileMode && desktopMobileVersion) {
          if (desktopMobileVersion === 'desktop') {
            effectiveX = textOverlay.desktopX ?? textOverlay.x;
            effectiveY = textOverlay.desktopY ?? textOverlay.y;
          } else if (desktopMobileVersion === 'mobile') {
            effectiveX = textOverlay.mobileX ?? textOverlay.x;
            effectiveY = textOverlay.mobileY ?? textOverlay.y;
          }
        }
        
        const actualX = (effectiveX / 100) * canvas.width;
        const actualY = (effectiveY / 100) * canvas.height;
        
        // Calculate current distance from text center
        const currentDistance = Math.sqrt(Math.pow(mouseX - actualX, 2) + Math.pow(mouseY - actualY, 2));
        
        // Calculate font size change based on distance change
        const distanceRatio = currentDistance / resizeStartDistance;
        const newFontSize = Math.max(1, Math.min(50, initialFontSize * distanceRatio));
        
        onFontSizeChange?.(resizeOverlayId, newFontSize);
      } else if (imageOverlay) {
        // Handle size resizing for image
        let effectiveX = imageOverlay.x;
        let effectiveY = imageOverlay.y;
        if (isDesktopMobileMode && desktopMobileVersion) {
          if (desktopMobileVersion === 'desktop') {
            effectiveX = imageOverlay.desktopX ?? imageOverlay.x;
            effectiveY = imageOverlay.desktopY ?? imageOverlay.y;
          } else if (desktopMobileVersion === 'mobile') {
            effectiveX = imageOverlay.mobileX ?? imageOverlay.x;
            effectiveY = imageOverlay.mobileY ?? imageOverlay.y;
          }
        }
        
        const actualX = (effectiveX / 100) * canvas.width;
        const actualY = (effectiveY / 100) * canvas.height;
        
        // Calculate current distance from image center
        const currentDistance = Math.sqrt(Math.pow(mouseX - actualX, 2) + Math.pow(mouseY - actualY, 2));
        
        // Calculate size change based on distance change
        const distanceRatio = currentDistance / resizeStartDistance;
        const newWidth = Math.max(1, Math.min(100, initialFontSize * distanceRatio)); // Reusing initialFontSize for initial width
        
        onImageSizeChange?.(resizeOverlayId, newWidth);
      }
    } else if (isDragging && draggedOverlayId) {
      // Handle dragging
      const deltaX = mouseX - dragOffset.x;
      const deltaY = mouseY - dragOffset.y;
      
      // Convert delta to percentage and add to initial position
      const deltaXPercent = (deltaX / canvas.width) * 100;
      const deltaYPercent = (deltaY / canvas.height) * 100;
      
      const newX = Math.max(0, Math.min(100, initialDragPosition.x + deltaXPercent));
      const newY = Math.max(0, Math.min(100, initialDragPosition.y + deltaYPercent));
      
      onPositionChange?.(draggedOverlayId, newX, newY);
    } else if (textOverlays.length > 0 || imageOverlays.length > 0) {
      // Handle hover detection when not dragging or resizing
      let foundHover = false;
      let cursorType = 'default';
      let newHoveredId: string | null = null;
      
      // First check image overlays (they are rendered on top)
      for (let i = imageOverlays.length - 1; i >= 0; i--) {
        const overlay = imageOverlays[i];
        
        // Check resize handle first
        if (isPointInImageResizeHandle(overlay, mouseX, mouseY, canvas.width, canvas.height)) {
          newHoveredId = overlay.id;
          cursorType = 'nw-resize';
          foundHover = true;
          break;
        }
        
        // Then check image area
        if (isPointInImageOverlay(overlay, mouseX, mouseY, canvas.width, canvas.height)) {
          newHoveredId = overlay.id;
          cursorType = 'grab';
          foundHover = true;
          break;
        }
      }

      // Then check text overlays if no image overlay was found
      if (!foundHover) {
        for (let i = textOverlays.length - 1; i >= 0; i--) {
          const overlay = textOverlays[i];
          
          // Check resize handle first
          if (isPointInResizeHandle(overlay, mouseX, mouseY, canvas.width, canvas.height)) {
            newHoveredId = overlay.id;
            cursorType = 'nw-resize';
            foundHover = true;
            break;
          }
          
          // Then check text area
          if (isPointInTextOverlay(overlay, mouseX, mouseY, canvas.width, canvas.height)) {
            newHoveredId = overlay.id;
            cursorType = 'grab';
            foundHover = true;
            break;
          }
        }
      }
      
      // Update cursor and hover state (only redraw if hover changed)
      canvas.style.cursor = cursorType;
      if (newHoveredId !== hoveredOverlayIdRef.current) {
        hoveredOverlayIdRef.current = newHoveredId;
        drawHoverEffects(newHoveredId);
      }
    }
  };

  const handleMouseUp = () => {
    if (isResizing && canvasRef.current) {
      canvasRef.current.style.cursor = 'nw-resize';
      setIsResizing(false);
      setResizeOverlayId(null);
    } else if (isDragging && canvasRef.current) {
      canvasRef.current.style.cursor = 'grab';
      setIsDragging(false);
      setDraggedOverlayId(null);
    }
  };

  const handleMouseLeave = () => {
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
    if (isDragging) {
      setIsDragging(false);
      setDraggedOverlayId(null);
    }
    if (isResizing) {
      setIsResizing(false);
      setResizeOverlayId(null);
    }
    setShowDragHint(false);
    setIsHovering(false);
    // Clear hover effect
    hoveredOverlayIdRef.current = null;
    drawHoverEffects(null);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || e.touches.length !== 1 || (textOverlays.length === 0 && imageOverlays.length === 0)) return;
    
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
    <div className="canvas-container slds-p-around_medium slds-m-bottom_medium" style={{ position: 'relative' }}>
      <div style={{ 
        position: 'relative', 
        display: 'inline-block', 
        maxWidth: '100%',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        transform: isDragging 
          ? 'scale(1.01)' 
          : isHovering 
            ? 'scale(1.005)' 
            : 'scale(1)',
        boxShadow: isHovering 
          ? '0 8px 16px rgba(0, 0, 0, 0.1)' 
          : '0 4px 6px rgba(0, 0, 0, 0.05)',
        borderRadius: '8px',
      }}>
        <canvas
          ref={canvasRef}
          className={`slds-border_around preview-canvas ${className}`}
          style={{
            maxWidth: '100%',
            height: 'auto',
            aspectRatio: imageAspectRatio,
            cursor: isDragging ? 'grabbing' : 'grab',
            borderRadius: '8px',
            display: 'block',
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
        {/* Overlay canvas for hover effects - prevents flicker by not redrawing main canvas */}
        <canvas
          ref={overlayCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none', // Allow clicks to pass through to main canvas
            borderRadius: '8px',
          }}
        />
      </div>
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
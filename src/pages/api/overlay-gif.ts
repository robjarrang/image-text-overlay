import { NextApiRequest, NextApiResponse } from 'next';
import * as opentype from 'opentype.js';
import { base64FontData } from '../../utils/fontData';
import { TextOverlay, ImageOverlay } from '../../components/ClientApp';
import GIFEncoder from 'gif-encoder-2';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { createCanvas, loadImage, CanvasRenderingContext2D as NodeCanvasRenderingContext2D } from 'canvas';

// Type alias for node-canvas context
type CanvasContext = NodeCanvasRenderingContext2D;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb' // Larger limit for GIFs
    },
    responseLimit: false
  },
};

// Cache the font instance
let cachedFont: opentype.Font | null = null;

async function loadFont(): Promise<opentype.Font> {
  if (!cachedFont) {
    const fontBuffer = Buffer.from(base64FontData, 'base64');
    const arrayBuffer = new ArrayBuffer(fontBuffer.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < fontBuffer.length; ++i) {
      uint8Array[i] = fontBuffer[i];
    }
    cachedFont = opentype.parse(arrayBuffer);
    if (!cachedFont || typeof cachedFont.getPath !== 'function') {
      throw new Error('Invalid font instance created');
    }
  }
  return cachedFont;
}

const processText = (text: string, alignment: 'left' | 'center' | 'right' = 'left') => {
  const lines = text.split('\n');
  
  return lines.map(line => {
    line = line.replace(/\[(center|left|right)\]/g, '');
    
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

// Draw text overlay onto a canvas context
function drawTextOverlay(
  ctx: CanvasContext,
  font: opentype.Font,
  overlay: TextOverlay,
  canvasWidth: number,
  canvasHeight: number,
  isDesktopMobileMode: boolean,
  desktopMobileVersion: 'desktop' | 'mobile'
) {
  const { text, fontSize, fontColor, x, y, desktopFontSize, mobileFontSize, desktopX, desktopY, mobileX, mobileY, alignment, allCaps } = overlay;
  
  if (!text || text.trim() === '') return;
  
  let effectiveX = x;
  let effectiveY = y;
  if (isDesktopMobileMode && desktopMobileVersion) {
    if (desktopMobileVersion === 'desktop') {
      effectiveX = desktopX ?? x;
      effectiveY = desktopY ?? y;
    } else if (desktopMobileVersion === 'mobile') {
      effectiveX = mobileX ?? x;
      effectiveY = mobileY ?? y;
    }
  }
  
  const actualX = (effectiveX / 100) * canvasWidth;
  const actualY = (effectiveY / 100) * canvasHeight;
  
  let effectiveFontSize = fontSize;
  if (isDesktopMobileMode && desktopMobileVersion) {
    if (desktopMobileVersion === 'desktop' && desktopFontSize !== undefined) {
      effectiveFontSize = desktopFontSize;
    } else if (desktopMobileVersion === 'mobile' && mobileFontSize !== undefined) {
      effectiveFontSize = mobileFontSize;
    }
  }
  
  const actualFontSize = Math.round((effectiveFontSize / 100) * canvasWidth);
  const lines = processText(text, alignment);

  let currentLineIndex = 0;

  lines.forEach((line) => {
    let totalLineWidth = 0;
    line.parts.forEach(part => {
      const partSize = part.isSuper ? actualFontSize * 0.7 : actualFontSize;
      const displayText = allCaps ? part.text.toUpperCase() : part.text;
      totalLineWidth += font.getAdvanceWidth(displayText, partSize);
    });
    
    let lineStartX = actualX;
    if (line.align === 'center') {
      lineStartX = actualX - (totalLineWidth / 2);
    } else if (line.align === 'right') {
      lineStartX = actualX - totalLineWidth;
    }
    
    let currentX = lineStartX;
    
    line.parts.forEach((part) => {
      const lineHeight = actualFontSize * 1.2;
      const currentY = actualY + currentLineIndex * lineHeight;
      
      const partSize = part.isSuper ? actualFontSize * 0.7 : actualFontSize;
      const displayText = allCaps ? part.text.toUpperCase() : part.text;
      
      const partY = part.isSuper ? currentY - (actualFontSize * 0.3) : currentY;
      
      // Draw the text path onto the canvas using opentype path commands
      const path = font.getPath(displayText, currentX, partY, partSize);
      ctx.fillStyle = fontColor;
      
      // Use opentype path drawing directly with canvas context
      ctx.beginPath();
      path.commands.forEach((cmd) => {
        switch (cmd.type) {
          case 'M':
            ctx.moveTo(cmd.x!, cmd.y!);
            break;
          case 'L':
            ctx.lineTo(cmd.x!, cmd.y!);
            break;
          case 'Q':
            ctx.quadraticCurveTo(cmd.x1!, cmd.y1!, cmd.x!, cmd.y!);
            break;
          case 'C':
            ctx.bezierCurveTo(cmd.x1!, cmd.y1!, cmd.x2!, cmd.y2!, cmd.x!, cmd.y!);
            break;
          case 'Z':
            ctx.closePath();
            break;
        }
      });
      ctx.fill();
      
      currentX += font.getAdvanceWidth(displayText, partSize);
    });
    
    currentLineIndex++;
  });
}

// Draw image overlay onto a canvas context
async function drawImageOverlay(
  ctx: CanvasContext,
  overlay: ImageOverlay,
  canvasWidth: number,
  canvasHeight: number,
  isDesktopMobileMode: boolean,
  desktopMobileVersion: 'desktop' | 'mobile'
): Promise<void> {
  const { imageUrl, width, height, x, y, desktopWidth, desktopHeight, desktopX, desktopY, mobileWidth, mobileHeight, mobileX, mobileY } = overlay;
  
  if (!imageUrl) return;
  
  try {
    // Fetch the overlay image
    const response = await fetch(imageUrl);
    if (!response.ok) return;
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Create image from buffer using canvas loadImage
    const img = await loadImage(buffer);
    
    let effectiveWidth = width;
    let effectiveHeight = height;
    let effectiveX = x;
    let effectiveY = y;
    
    if (isDesktopMobileMode && desktopMobileVersion) {
      if (desktopMobileVersion === 'desktop') {
        effectiveWidth = desktopWidth ?? width;
        effectiveHeight = desktopHeight ?? height;
        effectiveX = desktopX ?? x;
        effectiveY = desktopY ?? y;
      } else if (desktopMobileVersion === 'mobile') {
        effectiveWidth = mobileWidth ?? width;
        effectiveHeight = mobileHeight ?? height;
        effectiveX = mobileX ?? x;
        effectiveY = mobileY ?? y;
      }
    }
    
    const actualWidth = (effectiveWidth / 100) * canvasWidth;
    const actualHeight = (effectiveHeight / 100) * canvasWidth;
    const actualX = (effectiveX / 100) * canvasWidth;
    const actualY = (effectiveY / 100) * canvasHeight;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx.drawImage(img as any, actualX, actualY, actualWidth, actualHeight);
  } catch (error) {
    console.error('Error drawing image overlay:', error);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('GIF Overlay API called');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const params = req.body;
    const {
      textOverlays = [],
      imageOverlays = [],
      imageUrl,
      brightness = 100,
      download = false,
      isDesktopMobileMode = false,
      desktopMobileVersion = 'desktop'
    } = params;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }
    
    console.log('Loading font...');
    const font = await loadFont();
    
    console.log('Fetching GIF from URL:', imageUrl);
    const gifResponse = await fetch(imageUrl);
    if (!gifResponse.ok) {
      return res.status(400).json({ error: 'Failed to fetch GIF' });
    }
    
    const gifBuffer = await gifResponse.arrayBuffer();
    
    console.log('Parsing GIF...');
    const gif = parseGIF(gifBuffer);
    const frames = decompressFrames(gif, true);
    
    if (frames.length === 0) {
      return res.status(400).json({ error: 'No frames found in GIF' });
    }
    
    console.log(`Found ${frames.length} frames in GIF`);
    
    const gifWidth = gif.lsd.width;
    const gifHeight = gif.lsd.height;
    
    console.log(`GIF dimensions: ${gifWidth}x${gifHeight}`);
    
    // Import canvas for server-side rendering
    const { createCanvas } = await import('canvas');
    
    // Create the GIF encoder
    const encoder = new GIFEncoder(gifWidth, gifHeight);
    encoder.setDelay(frames[0].delay || 100);
    encoder.setRepeat(0); // 0 = loop forever
    encoder.setQuality(10); // Lower = better quality
    
    // Start encoding
    encoder.start();
    
    // Create a persistent canvas for frame compositing (GIF disposal handling)
    const compositeCanvas = createCanvas(gifWidth, gifHeight);
    const compositeCtx = compositeCanvas.getContext('2d');
    
    // Process each frame
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      console.log(`Processing frame ${i + 1}/${frames.length}`);
      
      // Create a canvas for this frame
      const frameCanvas = createCanvas(gifWidth, gifHeight);
      const frameCtx = frameCanvas.getContext('2d');
      
      // Handle disposal method from previous frame
      if (i === 0) {
        // First frame - clear to transparent or background
        compositeCtx.clearRect(0, 0, gifWidth, gifHeight);
      }
      
      // Copy composite canvas state to frame canvas
      frameCtx.drawImage(compositeCanvas, 0, 0);
      
      // Create ImageData from frame patch
      const frameImageData = frameCtx.createImageData(frame.dims.width, frame.dims.height);
      frameImageData.data.set(frame.patch);
      
      // Draw the frame patch at the correct position
      const tempCanvas = createCanvas(frame.dims.width, frame.dims.height);
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(frameImageData, 0, 0);
      
      frameCtx.drawImage(tempCanvas, frame.dims.left, frame.dims.top);
      
      // Apply brightness if not 100%
      if (brightness !== 100) {
        const brightnessRatio = brightness / 100;
        const imageData = frameCtx.getImageData(0, 0, gifWidth, gifHeight);
        const data = imageData.data;
        for (let j = 0; j < data.length; j += 4) {
          data[j] = Math.min(255, Math.max(0, data[j] * brightnessRatio));
          data[j + 1] = Math.min(255, Math.max(0, data[j + 1] * brightnessRatio));
          data[j + 2] = Math.min(255, Math.max(0, data[j + 2] * brightnessRatio));
        }
        frameCtx.putImageData(imageData, 0, 0);
      }
      
      // Draw image overlays
      for (const overlay of imageOverlays as ImageOverlay[]) {
        await drawImageOverlay(frameCtx, overlay, gifWidth, gifHeight, isDesktopMobileMode, desktopMobileVersion as 'desktop' | 'mobile');
      }
      
      // Draw text overlays
      for (const overlay of textOverlays as TextOverlay[]) {
        drawTextOverlay(frameCtx, font, overlay, gifWidth, gifHeight, isDesktopMobileMode, desktopMobileVersion as 'desktop' | 'mobile');
      }
      
      // Update composite canvas based on disposal method
      const disposalMethod = frame.disposalType;
      if (disposalMethod === 2) {
        // Restore to background - clear the frame area
        compositeCtx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
      } else if (disposalMethod !== 3) {
        // disposalMethod 0, 1: No disposal or do not dispose - keep frame
        // Copy frame to composite
        compositeCtx.drawImage(frameCanvas, 0, 0);
      }
      // disposalMethod 3: Restore to previous - we'd need to save/restore, skip for simplicity
      
      // Set frame delay
      encoder.setDelay(frame.delay || 100);
      
      // Add frame to encoder - pass the context directly
      encoder.addFrame(frameCtx as unknown as CanvasRenderingContext2D);
    }
    
    // Finish encoding
    encoder.finish();
    
    const gifOutput = encoder.out.getData();
    
    console.log('GIF encoding complete, output size:', gifOutput.length);
    
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    
    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="overlay-${Date.now()}.gif"`);
    }
    
    res.send(Buffer.from(gifOutput));
    console.log('GIF response sent successfully');
    
  } catch (error) {
    console.error('GIF processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process GIF',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

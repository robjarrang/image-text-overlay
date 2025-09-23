import { NextApiRequest, NextApiResponse } from 'next';
import sharp from 'sharp';
import * as opentype from 'opentype.js';
import { base64FontData } from '../../utils/fontData';
import { TextOverlay } from '../../components/ClientApp';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb'
    },
    responseLimit: false
  },
};

// Keep dimensions minimal for memory efficiency
const MAX_WIDTH = 400;
const MAX_HEIGHT = 300;

// Cache the font instance
let cachedFont: opentype.Font | null = null;

interface OverlayParams {
  textOverlays: TextOverlay[];
  imageUrl: string;
  brightness?: string;
  imageZoom?: number;
  imageX?: number;
  imageY?: number;
  download?: boolean;
  isDesktopMobileMode?: boolean;
  desktopMobileVersion?: 'desktop' | 'mobile';
}

async function loadFont(): Promise<opentype.Font> {
  if (!cachedFont) {
    try {
      console.log('Starting font loading process...');
      
      // Convert base64 directly to Buffer and use it with OpenType.js
      const fontBuffer = Buffer.from(base64FontData, 'base64');
      console.log('Font buffer created, length:', fontBuffer.length);
      
      // Create a new ArrayBuffer and copy the data
      const arrayBuffer = new ArrayBuffer(fontBuffer.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      for (let i = 0; i < fontBuffer.length; ++i) {
        uint8Array[i] = fontBuffer[i];
      }
      console.log('ArrayBuffer created and data copied');
      
      try {
        console.log('Attempting to parse font...');
        cachedFont = opentype.parse(arrayBuffer);
        
        // Verify font is loaded correctly
        if (!cachedFont || typeof cachedFont.getPath !== 'function') {
          console.error('Invalid font instance:', cachedFont);
          throw new Error('Invalid font instance created');
        }
        console.log('Font parsed and verified successfully');
      } catch (parseError) {
        console.error('Font parse error:', parseError);
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        throw new Error(`Failed to parse font data: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Font loading error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown loading error';
      throw new Error(`Font loading failed: ${errorMessage}`);
    }
  }
  return cachedFont;
}

const wrapText = (
  font: opentype.Font,
  text: string,
  maxWidth: number,
  fontSize: number
): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testPath = font.getPath(testLine, 0, 0, fontSize);
    const bbox = testPath.getBoundingBox();
    const textWidth = bbox.x2 - bbox.x1;
    
    if (textWidth > maxWidth && currentLine) {
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Request received:', {
    method: req.method,
    query: req.query,
    headers: req.headers
  });

  // Allow GET and POST methods
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Use req.method to decide where to extract parameters from
    const params = req.method === 'GET' ? req.query : req.body;
    
    // Check payload size directly
    if (req.method === 'POST' && Buffer.byteLength(JSON.stringify(req.body)) > 2 * 1024 * 1024) {
      return res.status(413).json({ 
        error: 'File size too large', 
        details: 'size_exceeded'
      });
    }

    // Handle backward compatibility for GET requests and legacy format
    let textOverlays: TextOverlay[] = [];
    const { imageUrl, brightness = '100', imageZoom = 1, imageX = 0, imageY = 0, width, height } = params;
    
    // For backward compatibility with single text overlay
    if (req.method === 'GET' || !params.textOverlays) {
      const { 
        text = '', 
        fontSize = '5', 
        fontColor = '#000000', 
        x = '10', 
        y = '10'
      } = params;
      
      // Apply font size adjustment for legacy URLs due to font changes
      // Reduce legacy font size by approximately 41% (11 -> 6.5 is about 59% of original)
      const originalFontSize = parseInt(fontSize as string);
      const adjustedFontSize = Math.round(originalFontSize * 0.59 * 10) / 10; // Round to 1 decimal place
      
      // Create a single text overlay from the parameters
      textOverlays = [{
        id: 'legacy-overlay',
        text: text as string,
        fontSize: adjustedFontSize,
        fontColor: fontColor as string,
        x: parseInt(x as string),
        y: parseInt(y as string)
      }];
      
      console.log(`Legacy API request: Original fontSize: ${originalFontSize}, Adjusted fontSize: ${adjustedFontSize}`);
    } else {
      // Use the array of text overlays provided
      textOverlays = params.textOverlays as TextOverlay[];
    }
    
    // Check if this is transparent mode, desktop/mobile mode, or regular image mode
    const isTransparentMode = imageUrl === 'transparent';
    const isDesktopMobileMode = params.isDesktopMobileMode;
    const desktopMobileVersion = params.desktopMobileVersion || 'desktop';
    
    if (!imageUrl && !isTransparentMode) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    console.log('Processing request with overlays:', { 
      overlayCount: textOverlays.length, 
      imageUrl, 
      isTransparentMode,
      isDesktopMobileMode,
      desktopMobileVersion,
      width,
      height,
      brightness, 
      imageZoom, 
      imageX, 
      imageY 
    });

    // Load and validate font first
    console.log('Loading font...');
    const font = await loadFont();
    if (!font) {
      throw new Error('Font failed to load');
    }
    console.log('Font loaded successfully');

    let imageWidth: number;
    let imageHeight: number;
    let transformedImage: sharp.Sharp;
    let hasAlpha: boolean;

    if (isTransparentMode) {
      // Handle transparent canvas mode
      console.log('Creating transparent canvas...');
      imageWidth = parseInt(width as string) || 800;
      imageHeight = parseInt(height as string) || 600;
      
      // Create a transparent image
      transformedImage = sharp({
        create: {
          width: imageWidth,
          height: imageHeight,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      });
      
      hasAlpha = true;
      console.log('Transparent canvas created:', { width: imageWidth, height: imageHeight });
    } else if (isDesktopMobileMode) {
      // Handle desktop/mobile mode with fixed dimensions and logo
      console.log('Processing desktop/mobile mode...');
      imageWidth = 1240;
      imageHeight = desktopMobileVersion === 'desktop' ? 968 : 1400;
      
      // Fetch background image
      const imageResponse = await fetch(imageUrl as string);
      if (!imageResponse.ok) {
        console.error('Background image fetch failed:', imageResponse.status, imageResponse.statusText);
        return res.status(400).json({ error: `Failed to fetch background image: ${imageResponse.statusText}` });
      }
      const backgroundBuffer = Buffer.from(await imageResponse.arrayBuffer());
      
      // Resize background image to fit the fixed dimensions
      const backgroundImage = sharp(backgroundBuffer)
        .resize(imageWidth, imageHeight, { fit: 'cover' });
      
      // Fetch logo
      const logoUrl = 'https://image.s50.sfmc-content.com/lib/fe301171756404787c1679/m/1/d9c37e29-bf82-493d-a66d-6202950380ca.png';
      const logoResponse = await fetch(logoUrl);
      if (!logoResponse.ok) {
        console.warn('Logo fetch failed, continuing without logo:', logoResponse.status, logoResponse.statusText);
        transformedImage = backgroundImage;
      } else {
        const logoBuffer = Buffer.from(await logoResponse.arrayBuffer());
        const logoWidth = desktopMobileVersion === 'desktop' ? 360 : 484;
        
        // Resize logo and composite it on the background
        const resizedLogo = await sharp(logoBuffer)
          .resize(logoWidth, null, { withoutEnlargement: false })
          .png()
          .toBuffer();
        
        transformedImage = backgroundImage.composite([{
          input: resizedLogo,
          top: 0,
          left: 0
        }]);
      }
      
      hasAlpha = false;
      console.log('Desktop/mobile image prepared:', { width: imageWidth, height: imageHeight, version: desktopMobileVersion });
    } else {
      // Fetch and process image
      console.log('Fetching image from URL...');
      let imageBuffer: Buffer;
      if ((imageUrl as string).startsWith('data:image/')) {
        // If imageUrl is a base64 data URL, extract the base64 part
        const base64Data = (imageUrl as string).split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
        console.log('Processed base64 image upload, buffer size:', imageBuffer.length);
      } else {
        const imageResponse = await fetch(imageUrl as string);
        if (!imageResponse.ok) {
          console.error('Image fetch failed:', imageResponse.status, imageResponse.statusText);
          return res.status(400).json({ error: `Failed to fetch image: ${imageResponse.statusText}` });
        }
        imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        console.log('Image fetched from URL, size:', imageBuffer.length);
      }

      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      console.log('Image metadata:', metadata);
      
      imageWidth = metadata.width || MAX_WIDTH;
      imageHeight = metadata.height || MAX_HEIGHT;
      
      // Check if source image has transparency
      hasAlpha = metadata.channels === 4 || Boolean(metadata.hasAlpha);
      
      // Calculate transformed dimensions and position
      const imageZoomValue = typeof imageZoom === 'number' ? imageZoom : parseFloat(imageZoom as string);
      const imageXPercent = typeof imageX === 'number' ? imageX / 100 : parseFloat(imageX as string) / 100;
      const imageYPercent = typeof imageY === 'number' ? imageY / 100 : parseFloat(imageY as string) / 100;
      
      const scaledWidth = imageWidth * imageZoomValue;
      const scaledHeight = imageHeight * imageZoomValue;
      const offsetX = (scaledWidth - imageWidth) * imageXPercent;
      const offsetY = (scaledHeight - imageHeight) * imageYPercent;

      // Create a new Sharp instance with the transformed image
      transformedImage = sharp(imageBuffer)
        .resize(scaledWidth, scaledHeight)
        .extract({
          left: Math.round(offsetX),
          top: Math.round(offsetY),
          width: imageWidth,
          height: imageHeight
        });

      // Apply brightness adjustment if not 100% and not transparent mode
      const brightnessValue = parseInt(brightness as string);
      if (brightnessValue !== 100) {
        // Use modulate to adjust brightness
        // modulate brightnessMultiplier is between 0 and Infinity, where 1 is no change,
        // values < 1 darken the image, values > 1 brighten it
        // Convert our scale (0-200) to sharp's scale (0-Infinity)
        const brightnessMultiplier = brightnessValue / 100;
        transformedImage.modulate({ brightness: brightnessMultiplier });
        console.log(`Applied brightness adjustment: ${brightnessValue}%`);
      }
    }

    // Process all text overlays
    console.log(`Processing ${textOverlays.length} text overlays...`);
    let svgPaths = '';

    try {
      // Process each overlay
      for (const overlay of textOverlays) {
        const { text, fontSize, fontColor, x, y } = overlay;
        
        // Skip empty overlays
        if (!text || text.trim() === '') continue;
        
        const actualX = (x / 100) * imageWidth;
        const actualY = (y / 100) * imageHeight;
        const actualFontSize = Math.round((fontSize / 100) * imageWidth);
        const maxWidth = imageWidth * 0.8; // 80% of image width for wrapping
        const lines = processText(text);

        let currentLineIndex = 0;

        lines.forEach((line, originalLineIndex) => {
          // For each processed line, handle wrapping and then draw
          line.parts.forEach((part, partIndex) => {
            // Apply wrapping to each text part separately to preserve formatting
            const wrappedLines = wrapText(font, part.text, maxWidth, actualFontSize);
            
            wrappedLines.forEach((wrappedLineText, wrappedIndex) => {
              const lineHeight = actualFontSize * 1.2;
              const currentY = actualY + currentLineIndex * lineHeight;
              
              // Calculate text width for alignment
              const partSize = part.isSuper ? actualFontSize * 0.7 : actualFontSize;
              const testPath = font.getPath(wrappedLineText, 0, 0, partSize);
              const bbox = testPath.getBoundingBox();
              const textWidth = bbox.x2 - bbox.x1;
              
              // Calculate X position based on alignment
              let lineX = actualX;
              if (line.align === 'center') {
                lineX = (imageWidth - textWidth) / 2;
              } else if (line.align === 'right') {
                lineX = imageWidth - textWidth - ((100 - x) / 100 * imageWidth);
              }
              
              // Draw the wrapped line part
              const partY = part.isSuper ? currentY - (actualFontSize * 0.3) : currentY;
              const path = font.getPath(wrappedLineText, lineX, partY, partSize);
              svgPaths += `<path d="${path.toPathData()}" fill="${fontColor}" />`;
              
              currentLineIndex++;
            });
          });
        });
      }

      // Create SVG
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}">
          ${svgPaths}
        </svg>
      `;
      console.log('SVG generated successfully');

      // Composite image
      console.log('Compositing image...');
      
      // Choose output format based on transparency
      let finalImage: Buffer;
      let contentType: string;
      let fileExtension: string;
      
      if (hasAlpha) {
        console.log('Source has transparency, outputting PNG...');
        finalImage = await transformedImage
          .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
          .png({ quality: 90 })
          .toBuffer();
        contentType = 'image/png';
        fileExtension = 'png';
      } else {
        console.log('Source has no transparency, outputting JPEG...');
        finalImage = await transformedImage
          .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
          .jpeg({ quality: 90 })
          .toBuffer();
        contentType = 'image/jpeg';
        fileExtension = 'jpg';
      }

      console.log('Image processing complete, sending response...');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      
      // Set Content-Disposition for downloads
      const isDownload = req.method === 'GET' 
        ? Boolean(req.query.download) 
        : Boolean(params.download);
        
      if (isDownload) {
        res.setHeader('Content-Disposition', `attachment; filename="overlay-${Date.now()}.${fileExtension}"`);
      }
      
      res.send(finalImage);
      console.log('Response sent successfully');
    } catch (error) {
      console.error('Text processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
      throw new Error(`Failed to process text overlay: ${errorMessage}`);
    }
  } catch (error) {
    console.error('Handler error:', error);
    res
      .status(500)
      .json({ 
        error: 'Failed to process image',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
  }
}
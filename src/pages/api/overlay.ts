import { NextApiRequest, NextApiResponse } from 'next';
import sharp from 'sharp';
import * as opentype from 'opentype.js';
import { base64FontData } from '../../utils/fontData';

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

    const { 
      text = '', 
      imageUrl, 
      fontSize = '5', 
      fontColor = '#000000', 
      x = '10', 
      y = '10', 
      brightness = '100' 
    } = params;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    console.log('Processing request with params:', { text, imageUrl, fontSize, fontColor, x, y, brightness });

    // Load and validate font first
    console.log('Loading font...');
    const font = await loadFont();
    if (!font) {
      throw new Error('Font failed to load');
    }
    console.log('Font loaded successfully');

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
    
    const imageWidth = metadata.width || MAX_WIDTH;
    const imageHeight = metadata.height || MAX_HEIGHT;
    
    // Calculate transformed dimensions and position
    const imageZoomValue = parseFloat(params.imageZoom);
    const imageXPercent = parseFloat(params.imageX) / 100;
    const imageYPercent = parseFloat(params.imageY) / 100;
    
    const scaledWidth = imageWidth * imageZoomValue;
    const scaledHeight = imageHeight * imageZoomValue;
    const offsetX = (scaledWidth - imageWidth) * imageXPercent;
    const offsetY = (scaledHeight - imageHeight) * imageYPercent;

    // Create a new Sharp instance with the transformed image
    const transformedImage = sharp(imageBuffer)
      .resize(scaledWidth, scaledHeight)
      .extract({
        left: Math.round(offsetX),
        top: Math.round(offsetY),
        width: imageWidth,
        height: imageHeight
      });

    // Apply brightness adjustment if not 100%
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

    // Process text lines
    console.log('Processing text lines...');
    const lines = (text as string).split('\n');
    const actualFontSize = Math.round((parseInt(fontSize as string) / 100) * imageWidth);
    let svgPaths = '';

    try {
      for (const [index, line] of lines.entries()) {
        let processedLine = line;
        let xPos = Math.round((parseInt(x as string) / 100) * imageWidth);
        
        // Handle alignment
        let alignmentOffset = 0;
        if (processedLine.match(/^\[(left|center|right)\]/)) {
          const align = processedLine.match(/^\[(left|center|right)\]/)![1];
          processedLine = processedLine.replace(/^\[(left|center|right)\]/, '');
          console.log('Processing aligned text:', { align, processedLine });
          
          // Process text with superscript first to get accurate width
          const parts: Array<{ text: string; isSuper: boolean }> = [];
          let currentIndex = 0;
          const superscriptRegex = /\^{([^}]+)}/g;
          let match;

          while ((match = superscriptRegex.exec(processedLine)) !== null) {
            if (match.index > currentIndex) {
              parts.push({
                text: processedLine.slice(currentIndex, match.index),
                isSuper: false
              });
            }

            parts.push({
              text: match[1],
              isSuper: true
            });

            currentIndex = match.index + match[0].length;
          }

          if (currentIndex < processedLine.length) {
            parts.push({
              text: processedLine.slice(currentIndex),
              isSuper: false
            });
          }

          // Calculate total width considering both regular and superscript text
          let totalWidth = 0;
          for (const part of parts) {
            const partSize = part.isSuper ? actualFontSize * 0.7 : actualFontSize;
            const testPath = font.getPath(part.text, 0, 0, partSize);
            const bbox = testPath.getBoundingBox();
            totalWidth += bbox.x2 - bbox.x1;
          }

          if (align === 'center') {
            xPos = Math.round((imageWidth - totalWidth) / 2);
          } else if (align === 'right') {
            xPos = Math.round(imageWidth - totalWidth - ((100 - parseInt(x as string)) / 100 * imageWidth));
          }
          console.log('Calculated position:', { align, xPos, totalWidth });
        }

        // Reset position for first text part
        let currentX = xPos;
        const yPos = Math.round((parseInt(y as string) / 100) * imageHeight + (index * actualFontSize * 1.2));

        // Process and render text parts
        const parts: Array<{ text: string; isSuper: boolean }> = [];
        let currentIndex = 0;
        const superscriptRegex = /\^{([^}]+)}/g;
        let match;

        while ((match = superscriptRegex.exec(processedLine)) !== null) {
          if (match.index > currentIndex) {
            parts.push({
              text: processedLine.slice(currentIndex, match.index),
              isSuper: false
            });
          }

          parts.push({
            text: match[1],
            isSuper: true
          });

          currentIndex = match.index + match[0].length;
        }

        if (currentIndex < processedLine.length) {
          parts.push({
            text: processedLine.slice(currentIndex),
            isSuper: false
          });
        }

        // Render each part
        for (const part of parts) {
          const partSize = part.isSuper ? actualFontSize * 0.7 : actualFontSize;
          const partY = part.isSuper ? yPos - (actualFontSize * 0.3) : yPos;
          const path = font.getPath(part.text, currentX, partY, partSize);
          svgPaths += `<path d="${path.toPathData()}" fill="${fontColor}" />`;

          // Move x position for next part
          const bbox = path.getBoundingBox();
          currentX += bbox.x2 - bbox.x1;
        }
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
      const finalImage = await transformedImage
        .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
        .jpeg({ quality: 90 })
        .toBuffer();

      console.log('Image processing complete, sending response...');
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      if (req.method === 'GET' && req.query.download) {
        res.setHeader('Content-Disposition', `attachment; filename="overlay-${Date.now()}.jpg"`);
      } else if (req.method === 'POST' && params.download) {
        res.setHeader('Content-Disposition', `attachment; filename="overlay-${Date.now()}.jpg"`);
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
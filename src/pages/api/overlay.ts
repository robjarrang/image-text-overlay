import { NextApiRequest, NextApiResponse } from 'next';
import sharp from 'sharp';
import * as opentype from 'opentype.js';
import { base64FontData } from '../../utils/fontData';

export const config = {
  api: {
    responseLimit: '10mb',
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
    const { text = '', imageUrl, fontSize = '5', fontColor = '#000000', x = '10', y = '10' } = params;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    console.log('Processing request with params:', { text, imageUrl, fontSize, fontColor, x, y });

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
        if (processedLine.match(/^\[(left|center|right)\]/)) {
          const align = processedLine.match(/^\[(left|center|right)\]/)![1];
          processedLine = processedLine.replace(/^\[(left|center|right)\]/, '');
          console.log('Processing aligned text:', { align, processedLine });
          
          if (align === 'center' || align === 'right') {
            const testPath = font.getPath(processedLine, 0, 0, actualFontSize);
            const bbox = testPath.getBoundingBox();
            const textWidth = bbox.x2 - bbox.x1;
            
            if (align === 'center') {
              xPos = Math.round((imageWidth - textWidth) / 2);
            } else {
              xPos = Math.round(imageWidth - textWidth - ((100 - parseInt(x as string)) / 100 * imageWidth));
            }
            console.log('Calculated position:', { align, xPos, textWidth });
          }
        }

        const yPos = Math.round((parseInt(y as string) / 100) * imageHeight + (index * actualFontSize * 1.2));
        const path = font.getPath(processedLine, xPos, yPos, actualFontSize);
        svgPaths += `<path d="${path.toPathData()}" fill="${fontColor}" />`;
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
      const finalImage = await image
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
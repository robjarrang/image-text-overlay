import { NextApiRequest, NextApiResponse } from 'next';
import * as opentype from 'opentype.js';
import { base64FontData } from '../../utils/fontData';

export const config = {
  api: {
    responseLimit: '10mb',
  },
};

const MAX_WIDTH = 800;
const MAX_HEIGHT = 600;

// Cache the font instance
let cachedFont: opentype.Font | null = null;

async function loadFont(): Promise<opentype.Font> {
  if (!cachedFont) {
    try {
      // Convert base64 to Buffer, then get ArrayBuffer directly
      const fontBuffer = Buffer.from(base64FontData, 'base64');
      // Get the underlying ArrayBuffer from the Buffer
      const arrayBuffer = fontBuffer.buffer.slice(
        fontBuffer.byteOffset,
        fontBuffer.byteOffset + fontBuffer.byteLength
      );
      
      // Parse the font with proper error handling
      try {
        cachedFont = opentype.parse(arrayBuffer);
      } catch (parseError) {
        console.error("Font parse error:", parseError);
        throw new Error('Failed to parse font data');
      }
      
      // Verify the font loaded correctly
      if (!cachedFont || !cachedFont.getPath) {
        throw new Error('Invalid font data loaded');
      }
    } catch (error) {
      console.error("Error in font loading process:", error);
      throw new Error('Font loading failed: ' + (error instanceof Error ? error.message : 'unknown error'));
    }
  }
  return cachedFont;
}

async function textToSVGPath(text: string, fontSize: number) {
    try {
        const font = await loadFont();
        
        // Get path data for the text
        const path = font.getPath(text, 0, 0, fontSize);
        
        // Get the bounding box to center the text
        const bbox = path.getBoundingBox();
        
        // Create SVG with the path
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${MAX_WIDTH}" height="${MAX_HEIGHT}">
            <path d="${path.toPathData()}" transform="translate(${-bbox.x1},${-bbox.y1})" />
        </svg>`;
    } catch (error) {
        console.error('Error generating SVG path:', error);
        throw new Error('Failed to generate SVG path');
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { text = '', fontSize = '24' } = req.query;
        const svgString = await textToSVGPath(text as string, Number(fontSize));
        
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.send(svgString);
    } catch (error) {
        console.error('Handler error:', error);
        res.status(500).json({ 
            error: 'Failed to generate SVG', 
            details: error instanceof Error ? error.message : String(error)
        });
    }
}
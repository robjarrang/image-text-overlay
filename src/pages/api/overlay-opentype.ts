import { NextApiRequest, NextApiResponse } from 'next';
import * as opentype from 'opentype.js';
import { base64FontData } from '../../utils/fontData';
import { base64FallbackFontData } from '../../utils/fallbackFontData';

export const config = {
  api: {
    responseLimit: '10mb',
  },
};

const MAX_WIDTH = 800;
const MAX_HEIGHT = 600;

// Cache the font instance
let cachedFont: opentype.Font | null = null;
// Cache the Cyrillic fallback font (Helvetica Neue W1G 83 Heavy Extended — the
// same brand font used on bg.milwaukeetool.eu). The primary brand font is a
// Latin-only cut with no Cyrillic glyphs, so Cyrillic characters fall back to
// this font per-character.
let cachedFallbackFont: opentype.Font | null = null;

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

// Loads the Cyrillic fallback font. Returns null (rather than throwing) on
// failure so Latin rendering keeps working even if the fallback is unavailable.
async function loadFallbackFont(): Promise<opentype.Font | null> {
  if (!cachedFallbackFont) {
    try {
      const fontBuffer = Buffer.from(base64FallbackFontData, 'base64');
      const arrayBuffer = fontBuffer.buffer.slice(
        fontBuffer.byteOffset,
        fontBuffer.byteOffset + fontBuffer.byteLength
      );
      const parsed = opentype.parse(arrayBuffer);
      if (!parsed || !parsed.getPath) {
        throw new Error('Invalid fallback font data loaded');
      }
      cachedFallbackFont = parsed;
    } catch (error) {
      console.error('Fallback font loading failed:', error);
      return null;
    }
  }
  return cachedFallbackFont;
}

// Returns true if the font contains a real (non-.notdef) glyph for the char.
function fontHasGlyph(font: opentype.Font, char: string): boolean {
  const glyph = font.charToGlyph(char);
  return !!glyph && glyph.index !== 0;
}

// Splits text into contiguous runs tagged with the font that should render
// them. Glyphs present in the primary font use it; those missing (e.g. Cyrillic)
// use the fallback. Shared glyphs stick to the current run's font.
function splitFontRuns(
  text: string,
  primary: opentype.Font,
  fallback: opentype.Font | null
): Array<{ font: opentype.Font; text: string }> {
  const runs: Array<{ font: opentype.Font; text: string }> = [];
  let currentFont: opentype.Font | null = null;
  let buffer = '';

  for (const char of text) {
    const inPrimary = fontHasGlyph(primary, char);
    const inFallback = fallback ? fontHasGlyph(fallback, char) : false;

    let chosen: opentype.Font;
    if (inPrimary && inFallback && currentFont) {
      chosen = currentFont;
    } else if (inPrimary) {
      chosen = primary;
    } else if (inFallback && fallback) {
      chosen = fallback;
    } else {
      chosen = primary;
    }

    if (chosen !== currentFont) {
      if (buffer && currentFont) {
        runs.push({ font: currentFont, text: buffer });
      }
      currentFont = chosen;
      buffer = char;
    } else {
      buffer += char;
    }
  }
  if (buffer && currentFont) {
    runs.push({ font: currentFont, text: buffer });
  }
  return runs;
}

async function textToSVGPath(text: string, fontSize: number) {
    try {
        const font = await loadFont();
        const fallbackFont = await loadFallbackFont();

        // Build a combined path, drawing each font run at the correct offset so
        // mixed Latin/Cyrillic strings align on a shared baseline.
        const combinedPath = new opentype.Path();
        let currentX = 0;
        for (const run of splitFontRuns(text, font, fallbackFont)) {
            const runPath = run.font.getPath(run.text, currentX, 0, fontSize);
            combinedPath.extend(runPath);
            currentX += run.font.getAdvanceWidth(run.text, fontSize);
        }

        // Get the bounding box to center the text
        const bbox = combinedPath.getBoundingBox();

        // Create SVG with the path
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${MAX_WIDTH}" height="${MAX_HEIGHT}">
            <path d="${combinedPath.toPathData()}" transform="translate(${-bbox.x1},${-bbox.y1})" />
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
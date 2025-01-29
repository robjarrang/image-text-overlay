import { NextApiRequest, NextApiResponse } from 'next';
import { put, head } from '@vercel/blob';

async function fetchImage(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }
  
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('image/')) {
    throw new Error('Invalid content type: not an image');
  }
  
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Add proxy endpoint for CORS-restricted images
    if (req.query.proxy === 'true' && req.query.url) {
      try {
        const imageBuffer = await fetchImage(req.query.url as string);
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return res.send(imageBuffer);
      } catch (error: any) {
        console.error('Proxy error:', error);
        return res.status(400).json({ 
          error: 'Failed to proxy image',
          details: error?.message || 'Unknown error'
        });
      }
    }

    // Create a hash of the query parameters for the filename
    const paramsString = JSON.stringify(req.query);
    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(paramsString)
    ).then(buf => 
      Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    );
    
    const imageName = `overlay-${hash}.png`;

    // Check if image exists in blob storage
    try {
      const existingBlob = await head(imageName);
      if (existingBlob) {
        return res.redirect(existingBlob.url);
      }
    } catch {
      // Image doesn't exist in blob storage
      return res.status(404).json({ 
        error: 'Image not found',
        message: 'Please generate the image first using the web interface'
      });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
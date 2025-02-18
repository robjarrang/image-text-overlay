import { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { images } = req.body as { images: string[] };

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Invalid request body. Expected array of image URLs' });
    }

    const processedImages = await Promise.all(
      images.map(async (imageUrl) => {
        // Handle null or undefined URLs
        if (!imageUrl) {
          throw new Error('Invalid image URL: URL cannot be empty');
        }

        // If it's already a base64 image, validate and return as is
        if (imageUrl.startsWith('data:image/')) {
          if (!imageUrl.includes(';base64,')) {
            throw new Error('Invalid base64 image format');
          }
          return imageUrl;
        }

        try {
          // Validate URL format
          new URL(imageUrl);

          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch image (${response.status})`);
          }

          const contentType = response.headers.get('content-type');
          if (!contentType?.startsWith('image/')) {
            throw new Error(`Invalid content type: ${contentType}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          return `data:${contentType};base64,${base64}`;
        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes('Invalid URL')) {
              throw new Error(`Invalid image URL format: ${imageUrl}`);
            }
            if (error.message.includes('Failed to fetch')) {
              throw new Error(`Failed to fetch image from ${imageUrl}`);
            }
          }
          console.error(`Error fetching image from ${imageUrl}:`, error);
          throw new Error(`Failed to fetch image from ${imageUrl}`);
        }
      })
    );

    // Set CORS headers in the success response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ images: processedImages });
  } catch (error) {
    // Set CORS headers in the error response
    res.setHeader('Access-Control-Allow-Origin', '*');
    console.error('Error processing images:', error);
    res.status(500).json({ 
      error: 'Failed to process images',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
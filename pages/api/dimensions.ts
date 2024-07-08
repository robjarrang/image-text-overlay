import { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
};

async function probeImageSize(url: string): Promise<{ width: number; height: number; type: string }> {
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const buffer = new Uint8Array(await response.arrayBuffer());

  // Check for JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] === 0xFF && buffer[offset + 1] === 0xC0) {
        return {
          height: (buffer[offset + 5] << 8) | buffer[offset + 6],
          width: (buffer[offset + 7] << 8) | buffer[offset + 8],
          type: 'jpg'
        };
      }
      offset += (buffer[offset + 2] << 8) | buffer[offset + 3];
    }
  }

  // Check for PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return {
      width: (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19],
      height: (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23],
      type: 'png'
    };
  }

  // Check for GIF
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return {
      width: buffer[6] | (buffer[7] << 8),
      height: buffer[8] | (buffer[9] << 8),
      type: 'gif'
    };
  }

  throw new Error('Unsupported image type');
}

export default async function handler(req: NextRequest) {
  console.log('Dimensions API called');
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get('url');

  console.log(`Received image URL: ${imageUrl}`);

  if (!imageUrl) {
    console.log('No image URL provided');
    return new Response(JSON.stringify({ error: 'No image URL provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const dimensions = await probeImageSize(imageUrl);
    console.log(`Image dimensions: ${JSON.stringify(dimensions)}`);
    return new Response(JSON.stringify(dimensions), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`Error in dimensions API: ${errorMessage}`);
    return new Response(JSON.stringify({ error: `Failed to get image dimensions: ${errorMessage}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
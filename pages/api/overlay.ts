import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text');
    const imageUrl = searchParams.get('imageUrl');
    const fontSize = parseInt(searchParams.get('fontSize') || '40');
    const fontColor = searchParams.get('fontColor') || 'white';
    const x = parseInt(searchParams.get('x') || '10');
    const y = parseInt(searchParams.get('y') || '50');

    return new ImageResponse(
      (
        <div
          style={{
            fontSize,
            color: fontColor,
            background: `url(${imageUrl})`,
            backgroundSize: 'cover',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            padding: `${y}px 0 0 ${x}px`,
          }}
        >
          {text}
        </div>
      ),
      {
        width: 1200,
        height: 600,
      }
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
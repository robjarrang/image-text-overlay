import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get('text');
  const imageUrl = searchParams.get('imageUrl');

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 40,
          background: `url(${imageUrl})`,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {text}
      </div>
    ),
    {
      width: 1200,
      height: 600,
    },
  );
}
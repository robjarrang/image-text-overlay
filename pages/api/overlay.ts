import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import React from 'react';

export const config = {
  runtime: 'edge',
};

async function getImageDimensions(url: string): Promise<{ width: number; height: number; type: string }> {
  console.log(`Fetching dimensions for URL: ${url}`);
  const dimensionsUrl = new URL('/api/dimensions', 'https://image-text-overlay-robjarrang-robjarrangs-projects.vercel.app');
  dimensionsUrl.searchParams.set('url', url);
  const response = await fetch(dimensionsUrl.toString());
  console.log(`Dimensions API response status: ${response.status}`);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to get image dimensions');
  }
  
  const data = await response.json();
  console.log(`Received dimensions: ${JSON.stringify(data)}`);
  return data;
}

export default async function handler(req: NextRequest) {
  console.log('Overlay API called');
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text') || 'Default Text';
    const imageUrl = searchParams.get('imageUrl');

    console.log(`Received parameters: text=${text}, imageUrl=${imageUrl}`);

    if (!imageUrl) {
      throw new Error('No image URL provided');
    }

    const fontSize = parseInt(searchParams.get('fontSize') || '40');
    const fontColor = searchParams.get('fontColor') || 'white';
    const x = parseInt(searchParams.get('x') || '10');
    const y = parseInt(searchParams.get('y') || '50');

    console.log(`Parsed parameters: fontSize=${fontSize}, fontColor=${fontColor}, x=${x}, y=${y}`);

    let { width, height, type } = await getImageDimensions(imageUrl);

    console.log(`Creating image response with dimensions: ${width}x${height}, type: ${type}`);

    const element = React.createElement(
      'div',
      {
        style: {
          fontSize,
          color: fontColor,
          background: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          padding: `${y}px 0 0 ${x}px`,
        },
      },
      text
    );

    return new ImageResponse(element, {
      width,
      height,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`Error in overlay API: ${errorMessage}`);
    
    const fallbackElement = React.createElement(
      'div',
      {
        style: {
          fontSize: 20,
          color: 'white',
          background: 'black',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '20px',
        },
      },
      React.createElement('h1', { style: { marginBottom: '20px' } }, 'Error Generating Image Overlay'),
      React.createElement('p', null, errorMessage),
      React.createElement('p', { style: { fontSize: '16px', marginTop: '20px' } }, 'Please check the image URL and try again.')
    );

    return new ImageResponse(fallbackElement, {
      width: 800,
      height: 400,
    });
  }
}
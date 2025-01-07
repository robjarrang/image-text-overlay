import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import React from 'react';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  console.log('Overlay API called');
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text') || 'Default Text';
    const imageUrl = searchParams.get('imageUrl');
    const width = parseInt(searchParams.get('width') || '1200');
    const height = parseInt(searchParams.get('height') || '630');
    const fontSize = parseInt(searchParams.get('fontSize') || '40');
    const fontColor = searchParams.get('fontColor') || 'white';
    const x = parseInt(searchParams.get('x') || '10');
    const y = parseInt(searchParams.get('y') || '50');
    const backgroundSize = searchParams.get('backgroundSize') || 'cover';
    const backgroundPosition = searchParams.get('backgroundPosition') || 'center';
    const fontFamily = searchParams.get('fontFamily') || 'Arial';

    console.log(`Received parameters: text=${text}, imageUrl=${imageUrl}, width=${width}, height=${height}, fontSize=${fontSize}, fontColor=${fontColor}, x=${x}, y=${y}, backgroundSize=${backgroundSize}, backgroundPosition=${backgroundPosition}, fontFamily=${fontFamily}`);

    if (!imageUrl) {
      throw new Error('No image URL provided');
    }

    console.log(`Creating image response with dimensions: ${width}x${height}`);

    // Fetch the font
    const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(' ', '+')}`;
    const fontResponse = await fetch(fontUrl);
    const fontCSS = await fontResponse.text();

    // Extract the actual font URL from the CSS
    const fontFileUrl = fontCSS.match(/url\((https:\/\/[^)]+)\)/)?.[1];

    if (!fontFileUrl) {
      throw new Error('Failed to extract font URL');
    }

    // Fetch the font file
    const fontFileResponse = await fetch(fontFileUrl);
    const fontArrayBuffer = await fontFileResponse.arrayBuffer();

    // Create the image element
    const imgElement = React.createElement('img', {
      src: imageUrl,
      style: {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: backgroundSize as 'cover' | 'contain' | 'fill',
        objectPosition: backgroundPosition,
      },
    });

    // Create the text element
    const textElement = React.createElement('div', {
      style: {
        position: 'absolute' as const,
        top: `${y}px`,
        left: `${x}px`,
        fontSize: `${fontSize}px`,
        fontFamily: `'${fontFamily}', sans-serif`,
        color: fontColor,
        zIndex: 1,
      },
    }, text);

    // Create the main element
    const element = React.createElement('div', {
      style: {
        position: 'relative' as const,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        overflow: 'hidden',
      },
    }, [imgElement, textElement]);

    return new ImageResponse(element, {
      width,
      height,
      fonts: [
        {
          name: fontFamily,
          data: fontArrayBuffer,
          style: 'normal',
        },
      ],
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
      React.createElement('p', { style: { fontSize: '16px', marginTop: '20px' } }, 'Please check the provided parameters and try again.')
    );

    return new ImageResponse(fallbackElement, {
      width: 800,
      height: 400,
    });
  }
}
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

interface SystemLogo {
  imageUrl: string;
}

interface TradeLogo {
  [languageCode: string]: string;
  default: string;
}

interface PresetLogosData {
  systemLogos: {
    [key: string]: SystemLogo;
  };
  tradeLogos: {
    [key: string]: TradeLogo;
  };
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filePath = path.join(process.cwd(), 'milwaukee-logos.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data: PresetLogosData = JSON.parse(fileContents);

    // Transform the data for easier frontend consumption
    const transformedData = {
      systemLogos: Object.entries(data.systemLogos).map(([key, value]) => ({
        id: key,
        name: key,
        imageUrl: value.imageUrl,
        hasVariants: false
      })),
      tradeLogos: Object.entries(data.tradeLogos).map(([key, value]) => ({
        id: key,
        name: key,
        variants: value,
        hasVariants: true,
        defaultImageUrl: value.default
      }))
    };

    res.status(200).json(transformedData);
  } catch (error) {
    console.error('Error loading preset logos:', error);
    res.status(500).json({ error: 'Failed to load preset logos' });
  }
}
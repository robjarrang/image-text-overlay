import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';

// Register the Roboto font
registerFont(path.join(process.cwd(), 'public', 'fonts', 'Roboto-Regular.ttf'), { family: 'Roboto' });

export default async function handler(req, res) {
  const { text, imageUrl, width, height, fontSize, fontColor, x, y } = req.query;
  console.log('Rendering text:', { text, x, y });

  try {
    const canvas = createCanvas(parseInt(width), parseInt(height));
    const ctx = canvas.getContext('2d');

    // Load and draw background
    const image = await loadImage(imageUrl);
    ctx.drawImage(image, 0, 0, parseInt(width), parseInt(height));

    // Configure text rendering
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = fontColor || '#FFFFFF';
    ctx.textBaseline = 'top';

    // Draw the text at exact coordinates
    ctx.fillText(text, parseInt(x), parseInt(y));

    // Send the image
    const buffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
}
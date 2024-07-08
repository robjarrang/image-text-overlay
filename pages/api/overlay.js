// pages/api/overlay.js
import { createCanvas, loadImage, registerFont } from 'canvas';

export default async function handler(req, res) {
  const {
    imageUrl,
    text,
    fontSize = 40,
    fontColor = 'white',
    x = 10,
    y = 50,
    fontUrl,
    fontFamily = 'Arial'
  } = req.query;

  if (!imageUrl || !text) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Load custom font if provided
    if (fontUrl) {
      registerFont(fontUrl, { family: fontFamily });
    }

    // Load the background image
    const image = await loadImage(imageUrl);

    // Create a canvas with the same dimensions as the image
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // Draw the background image
    ctx.drawImage(image, 0, 0, image.width, image.height);

    // Set up text properties
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = fontColor;

    // Add text to the image
    ctx.fillText(text, parseInt(x), parseInt(y));

    // Convert canvas to buffer
    const buffer = canvas.toBuffer('image/png');

    // Set response headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 's-maxage=31536000, stale-while-revalidate');

    // Send the image
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error processing image' });
  }
}
const fs = require('fs');
const path = require('path');

const fontPath = path.join(__dirname, '..', 'public', 'fonts', 'Helvetica Neue LT W05_93 Blk E.woff');

try {
    const fontData = fs.readFileSync(fontPath);
    const base64FontData = fontData.toString('base64');
    
    // Create the typescript file with the base64 font data
    const tsContent = `// This file is auto-generated. Do not edit manually.
export const base64FontData = '${base64FontData}';
`;
    
    fs.writeFileSync(
        path.join(__dirname, '..', 'src', 'utils', 'fontData.ts'),
        tsContent
    );
    
    console.log('Font data successfully converted and saved to src/utils/fontData.ts');
} catch (error) {
    console.error('Error processing font file:', error);
    process.exit(1);
}
const fs = require('fs');
const path = require('path');

// Converts the Cyrillic-capable fallback font (Helvetica Neue W1G 83 Heavy
// Extended) to base64 so it can be parsed by OpenType.js inside serverless API
// routes, mirroring the approach used for the primary brand font in
// convertFontToBase64.js. The W1G ("World 1 Glyph") cut of Helvetica Neue
// includes Cyrillic + Greek, which the primary Latin-only brand font lacks.
const fontPath = path.join(__dirname, '..', 'public', 'fonts', 'HelveticaNeueW1G-83-HeavyExtended.ttf');

try {
    const fontData = fs.readFileSync(fontPath);
    const base64FontData = fontData.toString('base64');

    const tsContent = `// This file is auto-generated. Do not edit manually.
// Helvetica Neue W1G 83 Heavy Extended — the Cyrillic/Greek-capable cut of the
// Milwaukee brand font (the same file used on bg.milwaukeetool.eu). Used as a
// per-character fallback for Cyrillic glyphs that are not present in the primary
// Latin-only Helvetica Neue brand font.
export const base64FallbackFontData = '${base64FontData}';
`;

    fs.writeFileSync(
        path.join(__dirname, '..', 'src', 'utils', 'fallbackFontData.ts'),
        tsContent
    );

    console.log('Fallback font data successfully converted and saved to src/utils/fallbackFontData.ts');
} catch (error) {
    console.error('Error processing fallback font file:', error);
    process.exit(1);
}

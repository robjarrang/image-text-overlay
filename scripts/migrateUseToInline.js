#!/usr/bin/env node
/**
 * One-shot migration: rewrite every
 *   <svg className="..." ...><use xlinkHref=".../symbols.svg#name" /></svg>
 * site inside ClientApp.tsx as
 *   <SldsIcon name="name" className="..." style={...} />
 * so icons render from inline path data rather than <use> refs.
 *
 * Idempotent — safe to re-run.
 */
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', 'src', 'components', 'ClientApp.tsx');
let src = fs.readFileSync(FILE, 'utf8');

// Capture the <svg ...attrs>...<use xlinkHref="...#name" ...></use></svg>.
// Strict: between the opening <svg...> and the </svg> we only allow
// whitespace and a SINGLE <use> element. This prevents the lazy matcher
// from swallowing legitimate inline SVG illustrations that happen to
// sit anywhere upstream of a sprite reference in the file.
const pattern =
  /<svg\b([^>]*)>\s*<use\s+xlinkHref="\/assets\/icons\/utility-sprite\/svg\/symbols\.svg#([a-z_]+)"\s*(?:\/>|><\/use>)\s*<\/svg>/g;

let count = 0;
src = src.replace(pattern, (match, attrs, iconName) => {
  count++;
  // Extract className (either "..." or {...}) and style={...} if present.
  const classStr = attrs.match(/\sclassName="([^"]*)"/);
  const classExpr = attrs.match(/\sclassName=\{([^}]+)\}/);
  const styleExpr = attrs.match(/\sstyle=\{\{([^}]+)\}\}/);
  const pieces = [`name="${iconName}"`];
  if (classStr) pieces.push(`className="${classStr[1]}"`);
  else if (classExpr) pieces.push(`className={${classExpr[1]}}`);
  if (styleExpr) pieces.push(`style={{${styleExpr[1]}}}`);
  return `<SldsIcon ${pieces.join(' ')} />`;
});

// Ensure SldsIcon is imported from ./Icons.
if (count > 0 && !/\bSldsIcon\b/.test(src)) {
  src = src.replace(
    /import\s*\{\s*Icons\s*\}\s*from\s*['"]\.\/Icons['"];?/,
    "import { Icons, SldsIcon } from './Icons';",
  );
}

fs.writeFileSync(FILE, src);
console.log(`Replaced ${count} <use> sites with <SldsIcon>`);

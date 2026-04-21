import React from 'react';
import { ICON_DATA } from '@/utils/iconData';

interface IconProps {
  className?: string;
  size?: 'x-small' | 'small' | 'medium' | 'large';
}

// Pixel sizes for each SLDS icon size keyword.
const SIZE_PX: Record<NonNullable<IconProps['size']>, number> = {
  'x-small': 14,
  'small': 20,
  'medium': 32,
  'large': 48,
};

/**
 * Parse a string of path markup (e.g. `<path d="M1 2"/><path d="M3 4"/>`)
 * into an array of React elements. Using real React children rather than
 * `dangerouslySetInnerHTML` guarantees that attributes like `fill` propagate
 * correctly through React's renderer and that SSR/CSR render identically.
 */
function parsePaths(markup: string): React.ReactElement[] {
  const out: React.ReactElement[] = [];
  // Match every <path ... /> or <path ...>...</path>. SLDS sprite only uses
  // <path> and optionally <g> — we flatten <g> wrappers and keep their paths.
  const flat = markup.replace(/<\/?g\b[^>]*>/g, '');
  const pathRegex = /<path\b([^/>]*?)(?:\/>|>[^<]*<\/path>)/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pathRegex.exec(flat)) !== null) {
    const attrs = m[1];
    const dMatch = attrs.match(/\bd="([^"]*)"/);
    if (!dMatch) continue;
    const fillMatch = attrs.match(/\bfill="([^"]*)"/);
    const fill = fillMatch && fillMatch[1] !== 'none' ? fillMatch[1] : 'currentColor';
    out.push(
      <path key={i++} d={dMatch[1]} fill={fill} />
    );
  }
  return out;
}

// Memoise parsed paths — icon data is static so parse once per name.
const parseCache = new Map<string, React.ReactElement[]>();
function getPaths(name: string, content: string): React.ReactElement[] {
  let cached = parseCache.get(name);
  if (!cached) {
    cached = parsePaths(content);
    parseCache.set(name, cached);
  }
  return cached;
}

/**
 * Renders an SLDS utility icon from pre-extracted path data. Deliberately
 * avoids `<use href>` (which has cross-browser / iframe / CSP failure
 * modes) and `dangerouslySetInnerHTML` (which can lose attributes on
 * hydration in some edge cases). Uses real React `<path>` children with
 * explicit width, height, and fill so no stylesheet can hide them.
 *
 * Icon data is pre-extracted from the SLDS sprite by
 * `scripts/generateIconData.js` at build time.
 */
const UtilityIcon: React.FC<IconProps & { iconName: string }> = ({
  className,
  size = 'x-small',
  iconName,
}) => {
  const def = ICON_DATA[iconName];
  if (!def) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`[Icons] Unknown icon "${iconName}"`);
    }
    return null;
  }
  const px = SIZE_PX[size];
  return (
    <svg
      className={`slds-icon slds-icon_${size} ${className || ''}`}
      aria-hidden="true"
      viewBox={def.viewBox}
      width={px}
      height={px}
      style={{ fill: 'currentColor', width: px, height: px, display: 'inline-block', verticalAlign: 'middle' }}
    >
      {getPaths(iconName, def.content)}
    </svg>
  );
};

export const Icons = {
  Share: (props: IconProps) => <UtilityIcon {...props} iconName="share" />,
  Download: (props: IconProps) => <UtilityIcon {...props} iconName="download" />,
  Close: (props: IconProps) => <UtilityIcon {...props} iconName="close" />,
  AlignLeft: (props: IconProps) => <UtilityIcon {...props} iconName="left_align_text" />,
  AlignCenter: (props: IconProps) => <UtilityIcon {...props} iconName="center_align_text" />,
  AlignRight: (props: IconProps) => <UtilityIcon {...props} iconName="right_align_text" />,
  Formula: (props: IconProps) => <UtilityIcon {...props} iconName="formula" />,
  Image: (props: IconProps) => <UtilityIcon {...props} iconName="image" />,
  Move: (props: IconProps) => <UtilityIcon {...props} iconName="move" />,
  Success: (props: IconProps) => <UtilityIcon {...props} iconName="success" />,
  KeyboardDismiss: (props: IconProps) => <UtilityIcon {...props} iconName="keyboard_dismiss" />,
  Error: (props: IconProps) => <UtilityIcon {...props} iconName="error" />,
  Settings: (props: IconProps) => <UtilityIcon {...props} iconName="settings" />,
  Help: (props: IconProps) => <UtilityIcon {...props} iconName="help" />,
  Desktop: (props: IconProps) => <UtilityIcon {...props} iconName="desktop" />,
  PhonePortrait: (props: IconProps) => <UtilityIcon {...props} iconName="phone_portrait" />,
  OpenFolder: (props: IconProps) => <UtilityIcon {...props} iconName="open_folder" />,
  OpenedFolder: (props: IconProps) => <UtilityIcon {...props} iconName="opened_folder" />,
  New: (props: IconProps) => <UtilityIcon {...props} iconName="new" />,
  Save: (props: IconProps) => <UtilityIcon {...props} iconName="save" />,
  Edit: (props: IconProps) => <UtilityIcon {...props} iconName="edit" />,
  Delete: (props: IconProps) => <UtilityIcon {...props} iconName="delete" />,
  Search: (props: IconProps) => <UtilityIcon {...props} iconName="search" />,
  ChevronRight: (props: IconProps) => <UtilityIcon {...props} iconName="chevronright" />,
  ChevronLeft: (props: IconProps) => <UtilityIcon {...props} iconName="chevronleft" />,
  File: (props: IconProps) => <UtilityIcon {...props} iconName="file" />,
  Back: (props: IconProps) => <UtilityIcon {...props} iconName="back" />,
  List: (props: IconProps) => <UtilityIcon {...props} iconName="list" />,
  Copy: (props: IconProps) => <UtilityIcon {...props} iconName="copy" />,
  Add: (props: IconProps) => <UtilityIcon {...props} iconName="add" />
};

/**
 * Generic inline-SVG icon for places that don't map to a named `Icons.X`
 * entry above (primarily scattered `<svg><use xlinkHref="...#name"></use></svg>`
 * sites in ClientApp.tsx). Accepts arbitrary className and style so existing
 * SLDS classes keep working unchanged.
 */
export const SldsIcon: React.FC<{
  name: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ name, className, style }) => {
  const def = ICON_DATA[name];
  if (!def) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`[SldsIcon] Unknown icon "${name}"`);
    }
    return null;
  }
  return (
    <svg
      className={className}
      style={{ fill: 'currentColor', ...style }}
      aria-hidden="true"
      viewBox={def.viewBox}
    >
      {getPaths(name, def.content)}
    </svg>
  );
};
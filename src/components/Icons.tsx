import React from 'react';
import { ICON_DATA } from '@/utils/iconData';

interface IconProps {
  className?: string;
  size?: 'x-small' | 'small' | 'medium' | 'large';
}

/**
 * Renders an SLDS utility icon by embedding the symbol's raw path data
 * directly inside a fresh <svg>. This deliberately avoids `<use href>`
 * (same-document or external) because that element has a long list of
 * cross-browser / iframe / CSP failure modes that left icons invisible
 * inside the SFMC Content Builder iframe. Inlining the paths renders
 * identically everywhere — standalone browser, SFMC iframe, CSP-locked
 * surfaces, headless screenshot contexts, etc.
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
    // Surface missing icons in dev but don't crash the UI in production.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(`[Icons] Unknown icon "${iconName}"`);
    }
    return null;
  }
  return (
    <svg
      className={`slds-icon slds-icon_${size} ${className || ''}`}
      aria-hidden="true"
      viewBox={def.viewBox}
      fill="currentColor"
      dangerouslySetInnerHTML={{ __html: def.content }}
    />
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
      style={style}
      aria-hidden="true"
      viewBox={def.viewBox}
      fill="currentColor"
      dangerouslySetInnerHTML={{ __html: def.content }}
    />
  );
};
import React from 'react';

interface IconProps {
  className?: string;
  size?: 'x-small' | 'small' | 'medium' | 'large';
}

// SLDS's `.slds-icon` rule sets `fill: var(--slds-c-icon-color-foreground, ..., white)`.
// A CSS rule beats a presentation attribute, so setting the `fill` attr on the
// <svg> isn't enough — the white default wins inside white border-filled buttons
// and the icon disappears. We set the CSS custom property instead so SLDS's own
// rule resolves to `currentColor`, which inherits the button's text colour.
const UtilityIcon: React.FC<IconProps & { iconName: string }> = ({ className, size = 'x-small', iconName }) => (
  <svg
    className={`slds-icon slds-icon_${size} ${className || ''}`}
    aria-hidden="true"
    style={{ ['--slds-c-icon-color-foreground' as string]: 'currentColor' }}
  >
    <use xlinkHref={`/assets/icons/utility-sprite/svg/symbols.svg#${iconName}`} />
  </svg>
);

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
  Reset: (props: IconProps) => <UtilityIcon {...props} iconName="reset" />,
  Success: (props: IconProps) => <UtilityIcon {...props} iconName="success" />,
  KeyboardDismiss: (props: IconProps) => <UtilityIcon {...props} iconName="keyboard_dismiss" />,
  Error: (props: IconProps) => <UtilityIcon {...props} iconName="error" />,
  Keyboard: (props: IconProps) => <UtilityIcon {...props} iconName="keyboard" />,
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
import React from 'react';

interface IconProps {
  className?: string;
  size?: 'x-small' | 'small' | 'medium' | 'large';
}

const UtilityIcon: React.FC<IconProps & { iconName: string }> = ({ className, size = 'x-small', iconName }) => (
  <svg className={`slds-icon slds-icon_${size} ${className || ''}`} aria-hidden="true" style={{ fill: 'currentColor' }}>
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
  Help: (props: IconProps) => <UtilityIcon {...props} iconName="help" />
};
// Utility to load preset logos from milwaukee-logos.json

export interface PresetLogoOption {
  label: string;
  imageUrl: string;
}

import presetLogosJson from '../../milwaukee-logos.json';

export function getPresetLogoOptions(): PresetLogoOption[] {
  const options: PresetLogoOption[] = [];
  // System logos
  if (presetLogosJson.systemLogos) {
    for (const [name, obj] of Object.entries(presetLogosJson.systemLogos)) {
      options.push({ label: name, imageUrl: (obj as any).imageUrl });
    }
  }
  // Trade logos (default only for each trade)
  if (presetLogosJson.tradeLogos) {
    for (const [trade, logos] of Object.entries(presetLogosJson.tradeLogos)) {
      if ((logos as any).default) {
        options.push({ label: trade, imageUrl: (logos as any).default });
      }
    }
  }
  return options;
}

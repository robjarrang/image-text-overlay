// Utility to load preset logos from milwaukee-logos.json

export interface PresetLogoVariation {
  label: string;
  imageUrl: string;
}

export interface PresetLogoOption {
  label: string;
  imageUrl: string;
  variations?: PresetLogoVariation[];
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
  // Trade logos (all variations)
  if (presetLogosJson.tradeLogos) {
    for (const [trade, logos] of Object.entries(presetLogosJson.tradeLogos)) {
      const variations: PresetLogoVariation[] = [];
      for (const [variation, url] of Object.entries(logos as Record<string, string>)) {
        if (variation !== 'default') {
          variations.push({ label: variation, imageUrl: url });
        }
      }
      // Add the trade logo with default and variations
      if ((logos as any).default) {
        options.push({
          label: trade,
          imageUrl: (logos as any).default,
          variations: variations.length > 0 ? variations : undefined
        });
      }
    }
  }
  return options;
}

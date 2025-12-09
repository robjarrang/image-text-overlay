import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import LZString from 'lz-string';
import { Icons } from './Icons';

const CanvasGenerator = dynamic(() => import('./CanvasGenerator').then(mod => ({ default: mod.CanvasGenerator })), {
  ssr: false
});
const RichTextEditor = dynamic(() => import('./RichTextEditor').then(mod => ({ default: mod.RichTextEditor })), {
  ssr: false
});

export interface TextOverlay {
  id: string;
  text: string;
  fontSize: number;
  desktopFontSize?: number;
  mobileFontSize?: number;
  fontColor: string;
  x: number;
  y: number;
  desktopX?: number;
  desktopY?: number;
  mobileX?: number;
  mobileY?: number;
  allCaps?: boolean;
  alignment?: 'left' | 'center' | 'right';
}

export interface ImageOverlay {
  id: string;
  imageUrl: string;
  originalImageUrl: string; // Store original URL for sharing
  width: number; // Percentage of canvas width
  height: number; // Percentage of canvas height (auto-calculated from aspect ratio)
  x: number; // Position percentage
  y: number; // Position percentage
  desktopX?: number;
  desktopY?: number;
  mobileX?: number;
  mobileY?: number;
  desktopWidth?: number;
  desktopHeight?: number;
  mobileWidth?: number;
  mobileHeight?: number;
  aspectRatio: number; // Width/height ratio for maintaining proportions
  // Preset logo information
  presetLogoId?: string; // ID of the preset logo (for trade logos)
  presetLogoType?: 'system' | 'trade'; // Type of preset logo
  selectedLanguage?: string; // Current language variant for trade logos
  availableLanguages?: string[]; // Available language variants
}

export interface PresetLogo {
  id: string;
  name: string;
  imageUrl?: string;
  hasVariants: boolean;
  variants?: { [languageCode: string]: string };
  defaultImageUrl?: string;
  selectedVariant?: string; // Current selected language variant
}

export interface PresetLogosData {
  systemLogos: PresetLogo[];
  tradeLogos: PresetLogo[];
}

interface FormState {
  textOverlays: TextOverlay[];
  imageOverlays: ImageOverlay[];
  activeOverlayId: string | null;
  activeOverlayType: 'text' | 'image' | null;
  imageUrl: string;
  width: number;
  height: number;
  desktopWidth: number;
  desktopHeight: number;
  mobileWidth: number;
  mobileHeight: number;
  brightness: number;
  imageZoom: number;
  imageX: number;
  imageY: number;
}

type FormStateKey = keyof Omit<FormState, 'textOverlays' | 'activeOverlayId'>;
type NumericKeys = Extract<FormStateKey, 'width' | 'height' | 'desktopWidth' | 'desktopHeight' | 'mobileWidth' | 'mobileHeight' | 'brightness' | 'imageX' | 'imageY' | 'imageZoom'>;
type StringKeys = Extract<FormStateKey, 'imageUrl'>;

// Validation constants
const DIMENSION_CONSTRAINTS = {
  MIN_WIDTH: 100,
  MAX_WIDTH: 5000,
  MIN_HEIGHT: 350,
  MAX_HEIGHT: 5000
};

// Font size conversion constants
// The reference width for font size calculations (desktop/mobile canvas width)
const FONT_REFERENCE_WIDTH = 1240;
const DEFAULT_FONT_SIZE_PX = 62; // ~5% of 1240px, default font size

// Convert percentage-based font size to pixel value for display
// When referenceWidth is provided, use it; otherwise use default 1240
const fontPercentToPixels = (percent: number, referenceWidth: number = FONT_REFERENCE_WIDTH): number => {
  return Math.round((percent / 100) * referenceWidth);
};

// Convert pixel value to percentage for internal storage
// When referenceWidth is provided, use it; otherwise use default 1240
const fontPixelsToPercent = (pixels: number, referenceWidth: number = FONT_REFERENCE_WIDTH): number => {
  return Number(((pixels / referenceWidth) * 100).toFixed(2));
};

// Check if a font size value is likely in pixels (legacy URLs use percentages 1-20)
// Values above 20 are assumed to be pixels
const isFontSizeInPixels = (value: number): boolean => {
  return value > 20;
};

// Convert legacy percentage to pixels, or keep pixels if already in pixel format
const normalizeFontSize = (value: number): number => {
  if (isFontSizeInPixels(value)) {
    // Already in pixels
    return value;
  }
  // Convert from percentage to pixels
  return fontPercentToPixels(value);
};

export function ClientApp() {
  const [formState, setFormState] = useState<FormState>({
    textOverlays: [],
    imageOverlays: [],
    activeOverlayId: null,
    activeOverlayType: null,
    imageUrl: '',
    width: 800,
    height: 600,
    desktopWidth: 1240,
    desktopHeight: 968,
    mobileWidth: 1240,
    mobileHeight: 1400,
    brightness: 100, // normal brightness (100%)
    imageZoom: 1,
    imageX: 0,
    imageY: 0
  });
  const [originalImageUrl, setOriginalImageUrl] = useState<string>('');
  const [activeImageSourceTab, setActiveImageSourceTab] = useState<'url' | 'upload' | 'transparent' | 'desktop-mobile'>('desktop-mobile');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showShareSuccess, setShowShareSuccess] = useState(false);
  // Added state for custom tooltip
  const [showShareTooltip, setShowShareTooltip] = useState(false);
  // State for delete confirmation
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Add new overlay input state
  const [newOverlayText, setNewOverlayText] = useState('');
  const [newImageOverlayUrl, setNewImageOverlayUrl] = useState('');

  // Preset logos state
  const [presetLogos, setPresetLogos] = useState<PresetLogosData | null>(null);
  const [loadingPresetLogos, setLoadingPresetLogos] = useState(false);
  const [selectedPresetLogo, setSelectedPresetLogo] = useState<PresetLogo | null>(null);

  // Add state for accordion sections
  const [openAccordions, setOpenAccordions] = useState({
    imageSource: true,
    imageAdjustments: false,
    textOverlays: true,
    imageOverlays: true,
    textContent: true
  });

  // State for desktop/mobile mode
  const [desktopMobileVersion, setDesktopMobileVersion] = useState<'desktop' | 'mobile'>('desktop');
  const [desktopMobileImageUrl, setDesktopMobileImageUrl] = useState<string>('');
  const [showMilwaukeeLogo, setShowMilwaukeeLogo] = useState<boolean>(true);
  
  // Cache for desktop/mobile preview images to avoid re-fetching when switching versions
  const [previewCache, setPreviewCache] = useState<{
    desktop: { url: string; sourceUrl: string; width: number; height: number } | null;
    mobile: { url: string; sourceUrl: string; width: number; height: number } | null;
  }>({ desktop: null, mobile: null });

  // Validation function for dimensions
  const validateDimension = (value: number, type: 'width' | 'height'): { isValid: boolean; message?: string } => {
    const isWidth = type === 'width';
    const min = isWidth ? DIMENSION_CONSTRAINTS.MIN_WIDTH : DIMENSION_CONSTRAINTS.MIN_HEIGHT;
    const max = isWidth ? DIMENSION_CONSTRAINTS.MAX_WIDTH : DIMENSION_CONSTRAINTS.MAX_HEIGHT;
    
    if (value < min) {
      return { 
        isValid: false, 
        message: `${isWidth ? 'Width' : 'Height'} must be at least ${min}px for proper image generation.` 
      };
    }
    if (value > max) {
      return { 
        isValid: false, 
        message: `${isWidth ? 'Width' : 'Height'} cannot exceed ${max}px due to memory constraints.` 
      };
    }
    return { isValid: true };
  };

  // Helper to check if current dimensions have errors (only for height since width is disabled)
  const getDimensionErrorClass = (fieldType: 'width' | 'height') => {
    if (fieldType === 'width') {
      return 'slds-input'; // Width is always valid since it's disabled
    }
    
    const currentHeight = desktopMobileVersion === 'desktop' ? formState.desktopHeight : formState.mobileHeight;
    const validation = validateDimension(currentHeight, 'height');
    
    return validation.isValid ? 'slds-input' : 'slds-input slds-has-error';
  };

  // Effect to handle dimension changes and regenerate preview
  useEffect(() => {
    if (activeImageSourceTab === 'desktop-mobile' && desktopMobileImageUrl) {
      // Validate current dimensions before generating preview
      const currentWidth = desktopMobileVersion === 'desktop' ? formState.desktopWidth : formState.mobileWidth;
      const currentHeight = desktopMobileVersion === 'desktop' ? formState.desktopHeight : formState.mobileHeight;
      
      const widthValidation = validateDimension(currentWidth, 'width');
      const heightValidation = validateDimension(currentHeight, 'height');
      
      if (widthValidation.isValid && heightValidation.isValid) {
        // Invalidate cache for the current version when dimensions change
        const cached = previewCache[desktopMobileVersion];
        if (cached && (cached.width !== currentWidth || cached.height !== currentHeight)) {
          setPreviewCache(prev => ({
            ...prev,
            [desktopMobileVersion]: null
          }));
        }
        
        const timer = setTimeout(() => {
          generateDesktopMobilePreview(desktopMobileImageUrl, desktopMobileVersion);
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [formState.desktopHeight, formState.mobileHeight, formState.desktopWidth, formState.mobileWidth, desktopMobileVersion]);
  
  // Cleanup object URLs when cache entries are replaced or component unmounts
  useEffect(() => {
    return () => {
      // Revoke object URLs on unmount to prevent memory leaks
      if (previewCache.desktop?.url) {
        URL.revokeObjectURL(previewCache.desktop.url);
      }
      if (previewCache.mobile?.url) {
        URL.revokeObjectURL(previewCache.mobile.url);
      }
    };
  }, []);
  
  // Auto-load preset logos on component mount
  useEffect(() => {
    loadPresetLogos();
  }, []); // Empty dependency array means this runs once on mount
  
  // Function to handle image source tab changes
  const handleImageSourceTabChange = (tab: 'url' | 'upload' | 'transparent' | 'desktop-mobile') => {
    setActiveImageSourceTab(tab);
    setError(null);
    
    if (tab === 'transparent') {
      // Set a special imageUrl to indicate transparent mode
      setFormState(prev => ({ ...prev, imageUrl: 'transparent' }));
      setOriginalImageUrl('transparent');
    } else if (tab === 'desktop-mobile') {
      // Set dimensions and generate preview for desktop/mobile mode
      if (desktopMobileImageUrl) {
        generateDesktopMobilePreview(desktopMobileImageUrl, desktopMobileVersion);
      } else {
        const isDesktop = desktopMobileVersion === 'desktop';
        setFormState(prev => ({ 
          ...prev, 
          imageUrl: '',
          width: 1240,
          height: isDesktop ? 968 : 1400
        }));
      }
      setOriginalImageUrl(desktopMobileImageUrl);
    } else if (tab === 'url' && (formState.imageUrl === 'transparent' || activeImageSourceTab === 'desktop-mobile')) {
      // Clear special modes when switching to URL
      setFormState(prev => ({ ...prev, imageUrl: '' }));
      setOriginalImageUrl('');
    } else if (tab === 'upload' && (formState.imageUrl === 'transparent' || activeImageSourceTab === 'desktop-mobile')) {
      // Clear special modes when switching to upload
      setFormState(prev => ({ ...prev, imageUrl: '' }));
      setOriginalImageUrl('');
    }
  };

  // Function to generate a unique ID
  const generateId = () => {
    return `overlay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };
  
  // Function to add a new text overlay
  const addTextOverlay = (text: string) => {
    if (!text.trim()) return;
    
    const newOverlay: TextOverlay = {
      id: generateId(),
      text: text.trim(),
      fontSize: 5, // Default font size (5% of image width)
      fontColor: '#FFFFFF', // Default color (white)
      x: 10, // Default position (10% from left)
      y: 10 + (formState.textOverlays.length * 10) % 80, // Staggered positioning
      alignment: 'left'
    };
    
    setFormState(prev => ({
      ...prev,
      textOverlays: [...prev.textOverlays, newOverlay],
      activeOverlayId: newOverlay.id
    }));
    
    setNewOverlayText(''); // Clear input field
  };
  
  // Function to update an active text overlay
  const updateActiveOverlay = (field: keyof TextOverlay, value: string | number | boolean) => {
    if (!formState.activeOverlayId) return;
    
    setFormState(prev => ({
      ...prev,
      textOverlays: prev.textOverlays.map(overlay => 
        overlay.id === prev.activeOverlayId 
          ? { ...overlay, [field]: value }
          : overlay
      )
    }));
  };
  
  // Function to select an overlay as active
  const setActiveOverlay = (id: string | null, type?: 'text' | 'image' | null) => {
    setFormState(prev => {
      // If id is provided, determine type if not specified
      let overlayType = type;
      if (id && !type) {
        // Check if it's a text overlay
        if (prev.textOverlays.find(overlay => overlay.id === id)) {
          overlayType = 'text';
        }
        // Check if it's an image overlay
        else if (prev.imageOverlays.find(overlay => overlay.id === id)) {
          overlayType = 'image';
        }
      }
      
      return {
        ...prev,
        activeOverlayId: id,
        activeOverlayType: id ? (overlayType || null) : null
      };
    });
  };
  
  // Function to delete an overlay (text or image)
  const deleteOverlay = (id: string) => {
    setFormState(prev => {
      // Check if it's a text overlay
      const isTextOverlay = prev.textOverlays.some(overlay => overlay.id === id);
      
      if (isTextOverlay) {
        const updatedTextOverlays = prev.textOverlays.filter(overlay => overlay.id !== id);
        return {
          ...prev,
          textOverlays: updatedTextOverlays,
          activeOverlayId: prev.activeOverlayId === id ? null : prev.activeOverlayId,
          activeOverlayType: prev.activeOverlayId === id ? null : prev.activeOverlayType
        };
      } else {
        // It's an image overlay
        const updatedImageOverlays = prev.imageOverlays.filter(overlay => overlay.id !== id);
        return {
          ...prev,
          imageOverlays: updatedImageOverlays,
          activeOverlayId: prev.activeOverlayId === id ? null : prev.activeOverlayId,
          activeOverlayType: prev.activeOverlayId === id ? null : prev.activeOverlayType
        };
      }
    });
  };
  
  // Function to confirm deletion of an overlay
  const confirmDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  // Function to cancel deletion
  const cancelDelete = () => {
    setPendingDeleteId(null);
  };

  // Function to confirm and process deletion
  const handleDeleteConfirmed = () => {
    if (pendingDeleteId) {
      deleteOverlay(pendingDeleteId);
      setPendingDeleteId(null);
    }
  };

  // Function to add a new image overlay
  const addImageOverlay = async (imageUrl: string) => {
    if (!imageUrl.trim()) return;
    
    try {
      setIsLoading(true);
      
      // Load the image to get dimensions and convert to base64
      const response = await fetch('/api/load-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: [imageUrl] })
      });
      
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      // Create a temporary image to get dimensions
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = data.images[0];
      });
      
      const aspectRatio = img.width / img.height;
      const defaultWidth = 20; // 20% of canvas width
      const defaultHeight = defaultWidth / aspectRatio;
      
      // Calculate logo bottom position for alignment
      // Built-in logo dimensions: Desktop 360px width, Mobile 484px width
      // Logo aspect ratio is approximately 4.9:1 based on the PNG
      const isDesktopMode = activeImageSourceTab === 'desktop-mobile' && desktopMobileVersion === 'desktop';
      const logoWidthPx = isDesktopMode ? 360 : 484;
      const logoAspectRatio = 4.9; // Approximate aspect ratio of the logo
      const logoHeightPx = logoWidthPx / logoAspectRatio;
      
      // Convert logo bottom position to percentage (logo is at top: 0, so bottom = logoHeight)
      // Assuming standard canvas dimensions for percentage calculation
      const canvasHeight = isDesktopMode ? 968 : 1400;
      const logoBottomPercent = (logoHeightPx / canvasHeight) * 100;
      
      // Position image overlay so its bottom aligns with logo's bottom
      const overlayBottomY = logoBottomPercent;
      const overlayTopY = Math.max(2, overlayBottomY - defaultHeight); // Ensure minimum 2% top margin
      
      const newOverlay: ImageOverlay = {
        id: generateId(),
        imageUrl: data.images[0], // Base64 image
        originalImageUrl: imageUrl, // Original URL for sharing
        width: defaultWidth,
        height: defaultHeight,
        x: 78 - (formState.imageOverlays.length * 3) % 10, // Top right with smaller margin (78% from left, staggered left)
        y: overlayTopY + (formState.imageOverlays.length * 2) % 8, // Align with logo bottom, small stagger
        aspectRatio
      };
      
      setFormState(prev => ({
        ...prev,
        imageOverlays: [...prev.imageOverlays, newOverlay],
        activeOverlayId: newOverlay.id,
        activeOverlayType: 'image'
      }));
      
      setNewImageOverlayUrl(''); // Clear input field
      setIsLoading(false);
    } catch (error) {
      console.error('Error adding image overlay:', error);
      setError('Failed to load image overlay');
      setIsLoading(false);
    }
  };

  // Function to load preset logos
  const loadPresetLogos = async () => {
    if (presetLogos) return; // Already loaded
    
    try {
      setLoadingPresetLogos(true);
      const response = await fetch('/api/preset-logos');
      if (!response.ok) throw new Error('Failed to load preset logos');
      
      const data: PresetLogosData = await response.json();
      setPresetLogos(data);
    } catch (error) {
      console.error('Error loading preset logos:', error);
      setError('Failed to load preset logos');
    } finally {
      setLoadingPresetLogos(false);
    }
  };

  // Function to add a preset logo as an image overlay
  const addPresetLogo = async (logo: PresetLogo, languageVariant?: string) => {
    try {
      setIsLoading(true);
      
      // Determine the image URL to use
      let imageUrl: string;
      if (logo.hasVariants && logo.variants && languageVariant) {
        imageUrl = logo.variants[languageVariant] || logo.defaultImageUrl || '';
      } else if (logo.imageUrl) {
        imageUrl = logo.imageUrl;
      } else {
        imageUrl = logo.defaultImageUrl || '';
      }
      
      if (!imageUrl) {
        throw new Error('No image URL available for this logo');
      }
      
      // Load the image to get dimensions and convert to base64
      const response = await fetch('/api/load-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: [imageUrl] })
      });
      
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      // Create a temporary image to get dimensions
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = data.images[0];
      });
      
      const aspectRatio = img.width / img.height;
      const defaultWidth = 20; // 20% of canvas width
      const defaultHeight = defaultWidth / aspectRatio;
      
      // Use the same positioning logic as regular image overlays
      const isDesktopMode = activeImageSourceTab === 'desktop-mobile' && desktopMobileVersion === 'desktop';
      const logoWidthPx = isDesktopMode ? 360 : 484;
      const logoAspectRatio = 4.9;
      const logoHeightPx = logoWidthPx / logoAspectRatio;
      
      const canvasHeight = isDesktopMode ? 968 : 1400;
      const logoBottomPercent = (logoHeightPx / canvasHeight) * 100;
      
      const overlayBottomY = logoBottomPercent;
      const overlayTopY = Math.max(2, overlayBottomY - defaultHeight);
      
      const newOverlay: ImageOverlay = {
        id: generateId(),
        imageUrl: data.images[0], // Base64 image
        originalImageUrl: imageUrl, // Original URL for sharing
        width: defaultWidth,
        height: defaultHeight,
        x: 78 - (formState.imageOverlays.length * 3) % 10,
        y: overlayTopY + (formState.imageOverlays.length * 2) % 8,
        aspectRatio,
        // Store preset logo information
        presetLogoId: logo.id,
        presetLogoType: logo.hasVariants ? 'trade' : 'system',
        selectedLanguage: languageVariant || 'default',
        availableLanguages: logo.hasVariants && logo.variants ? Object.keys(logo.variants) : undefined
      };
      
      setFormState(prev => ({
        ...prev,
        imageOverlays: [...prev.imageOverlays, newOverlay],
        activeOverlayId: newOverlay.id,
        activeOverlayType: 'image'
      }));
      
      setSelectedPresetLogo(null); // Clear selection
      setIsLoading(false);
    } catch (error) {
      console.error('Error adding preset logo:', error);
      setError('Failed to add preset logo');
      setIsLoading(false);
    }
  };

  // Function to change language variant of a trade logo overlay
  const changeTradeLogoLanguage = async (overlayId: string, newLanguage: string) => {
    const overlay = formState.imageOverlays.find(o => o.id === overlayId);
    if (!overlay || !overlay.presetLogoId || overlay.presetLogoType !== 'trade') {
      console.error('Cannot change language: not a trade logo overlay');
      return;
    }

    if (!presetLogos) {
      console.error('Preset logos not loaded');
      return;
    }

    const presetLogo = presetLogos.tradeLogos.find(logo => logo.id === overlay.presetLogoId);
    if (!presetLogo || !presetLogo.variants) {
      console.error('Trade logo or variants not found');
      return;
    }

    const newImageUrl = presetLogo.variants[newLanguage];
    if (!newImageUrl) {
      console.error('Language variant not found');
      return;
    }

    try {
      setIsLoading(true);

      // Load the new image and convert to base64
      const response = await fetch('/api/load-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: [newImageUrl] })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      // Update the overlay with new image while keeping all other properties
      setFormState(prev => ({
        ...prev,
        imageOverlays: prev.imageOverlays.map(o => 
          o.id === overlayId 
            ? { 
                ...o, 
                imageUrl: data.images[0], // New base64 image
                originalImageUrl: newImageUrl, // New original URL
                selectedLanguage: newLanguage // Update selected language
              }
            : o
        )
      }));

      setIsLoading(false);
    } catch (error) {
      console.error('Error changing trade logo language:', error);
      setError('Failed to change language variant');
      setIsLoading(false);
    }
  };

  // Function to update an active image overlay
  const updateActiveImageOverlay = (field: keyof ImageOverlay, value: string | number) => {
    if (!formState.activeOverlayId || formState.activeOverlayType !== 'image') return;
    
    setFormState(prev => ({
      ...prev,
      imageOverlays: prev.imageOverlays.map(overlay => 
        overlay.id === prev.activeOverlayId 
          ? { ...overlay, [field]: value }
          : overlay
      )
    }));
  };

  // Function to delete an image overlay
  const deleteImageOverlay = (id: string) => {
    setFormState(prev => {
      const updatedOverlays = prev.imageOverlays.filter(overlay => overlay.id !== id);
      return {
        ...prev,
        imageOverlays: updatedOverlays,
        activeOverlayId: prev.activeOverlayId === id ? null : prev.activeOverlayId,
        activeOverlayType: prev.activeOverlayId === id ? null : prev.activeOverlayType
      };
    });
  };

  // Function to handle text change for an overlay
  const handleOverlayTextChange = (value: string) => {
    if (formState.activeOverlayId) {
      updateActiveOverlay('text', value);
    }
  };
  
  // Get currently active overlay
  const activeTextOverlay = formState.activeOverlayId && formState.activeOverlayType === 'text'
    ? formState.textOverlays.find(overlay => overlay.id === formState.activeOverlayId) 
    : null;
  const activeImageOverlay = formState.activeOverlayId && formState.activeOverlayType === 'image'
    ? formState.imageOverlays.find(overlay => overlay.id === formState.activeOverlayId) 
    : null;
  // Keep activeOverlay for backward compatibility with text overlays
  const activeOverlay = activeTextOverlay;

  // Function to toggle accordion sections
  const toggleAccordion = (section: keyof typeof openAccordions) => {
    setOpenAccordions(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  useEffect(() => {
    console.log('🔍 URL Loading Effect - Starting');
    const params = new URLSearchParams(window.location.search);
    console.log('🔍 URL params:', params.toString());
    
    // Check for lz-string compressed data format first (new format with 'c' parameter)
    const lzCompressedData = params.get('c');
    // Check for old base64 compressed data format ('d' parameter) for backward compatibility
    const base64CompressedData = params.get('d');
    
    console.log('🔍 LZ-string compressed data found:', !!lzCompressedData);
    console.log('🔍 Base64 compressed data found:', !!base64CompressedData);
    
    // Determine which compression format to use
    const hasCompressedData = lzCompressedData || base64CompressedData;
    
    if (hasCompressedData) {
      console.log('🔍 Processing compressed data...');
      try {
        let decompressed: string;
        
        if (lzCompressedData) {
          // New lz-string format
          decompressed = LZString.decompressFromEncodedURIComponent(lzCompressedData) || '';
          if (!decompressed) {
            throw new Error('Failed to decompress lz-string data');
          }
        } else {
          // Old base64 format for backward compatibility
          decompressed = decodeURIComponent(atob(base64CompressedData!));
        }
        
        const shareData = JSON.parse(decompressed);
        console.log('🔍 Parsed share data:', shareData);
        
        // Helper function to decompress URLs
        const decompressUrl = (compressedUrl: string): string => {
          if (!compressedUrl) return compressedUrl;
          return compressedUrl
            .replace('S50/', 'https://image.s50.sfmc-content.com/lib/')
            .replace('S51/', 'https://image.s51.sfmc-content.com/lib/')
            .replace('S52/', 'https://image.s52.sfmc-content.com/lib/')
            .replace('V/', 'https://milwaukee-overlay.vercel.app/');
        };
        
        // Helper function to restore full overlay IDs
        const restoreId = (shortId: string): string => {
          if (!shortId || shortId.includes('overlay-')) return shortId; // Already full ID
          const parts = shortId.split('.');
          if (parts.length === 2) {
            return `overlay-${parts[0]}-${parts[1]}`;
          }
          return shortId;
        };
        
        // Handle mode - support both old and new formats
        const mode = shareData.mode || shareData.m;
        if (mode && ['url', 'upload', 'transparent', 'desktop-mobile'].includes(mode)) {
          console.log('🔍 Setting activeImageSourceTab to:', mode);
          setActiveImageSourceTab(mode);
        }
        
        // Handle desktop/mobile specific parameters - support both old and new formats
        if (mode === 'desktop-mobile') {
          console.log('🔍 Desktop/mobile mode detected');
          const dmVersion = shareData.dmv || (shareData.v !== undefined ? (shareData.v === 0 ? 'desktop' : 'mobile') : shareData.v);
          const dmUrl = decompressUrl(shareData.dmUrl || shareData.u);
          
          if (dmVersion && ['desktop', 'mobile'].includes(dmVersion)) {
            console.log('🔍 Setting desktop/mobile version to:', dmVersion);
            setDesktopMobileVersion(dmVersion);
          }
          if (dmUrl) {
            console.log('🔍 Setting desktop/mobile image URL to:', dmUrl);
            setDesktopMobileImageUrl(dmUrl);
          }
        }
        
        // Set form state from compressed data
        const urlState: Partial<FormState> = {
          ...(shareData.w && { width: shareData.w }),
          ...(shareData.h && { height: shareData.h }),
          ...(shareData.dw && { desktopWidth: shareData.dw }),
          ...(shareData.dh && { desktopHeight: shareData.dh }),
          ...(shareData.mw && { mobileWidth: shareData.mw }),
          ...(shareData.mh && { mobileHeight: shareData.mh }),
          brightness: shareData.b !== undefined ? shareData.b : 100, // Default to 100 if not specified
          imageZoom: shareData.z !== undefined ? shareData.z : 1, // Default to 1 if not specified
          imageX: shareData.x !== undefined ? shareData.x : 0, // Default to 0 if not specified
          imageY: shareData.y !== undefined ? shareData.y : 0 // Default to 0 if not specified
        };
        console.log('🔍 URL state to apply:', urlState);

        if (mode === 'transparent') {
          console.log('🔍 Transparent mode detected, forcing transparent canvas imageUrl');
          urlState.imageUrl = 'transparent';
          setOriginalImageUrl('transparent');
        }
        
        // Handle image URL and trigger loading immediately if needed - support both old and new formats
        const imageUrl = decompressUrl(shareData.img || shareData.i);
        if (imageUrl && mode === 'url') {
          console.log('🔍 URL mode with image detected, starting image load:', imageUrl);
          setOriginalImageUrl(imageUrl);
          
          // Trigger image loading immediately for URL mode
          setIsLoading(true);
          fetch('/api/load-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: [imageUrl] })
          })
          .then(response => {
            console.log('🔍 Image API response status:', response.status);
            return response.json();
          })
          .then(data => {
            console.log('🔍 Image loaded successfully, data:', data);
            setFormState(prev => ({
              ...prev,
              ...urlState,
              imageUrl: data.images[0]
            }));
            console.log('🔍 Form state updated with image');
            setIsLoading(false);
          })
          .catch(error => {
            console.error('❌ Error loading shared image:', error);
            setError('Failed to load shared image');
            setOriginalImageUrl('');
            setIsLoading(false);
          });
        } else if (imageUrl) {
          console.log('🔍 Non-URL mode with image, setting originalImageUrl:', imageUrl);
          setOriginalImageUrl(imageUrl);
          setFormState(prev => ({ ...prev, ...urlState }));
        } else {
          console.log('🔍 No image in share data, applying state only');
          setFormState(prev => ({ ...prev, ...urlState }));
          
          // Check if this is desktop-mobile mode and we need to generate preview
          const dmUrl = decompressUrl(shareData.dmUrl || shareData.u);
          const dmVersion = shareData.dmv || (shareData.v !== undefined ? (shareData.v === 0 ? 'desktop' : 'mobile') : shareData.v);
          if (mode === 'desktop-mobile' && dmUrl) {
            console.log('🔍 Desktop-mobile mode detected, triggering preview generation');
            console.log('🔍 Desktop-mobile image URL:', dmUrl);
            console.log('🔍 Desktop-mobile version:', dmVersion);
            
            // Small delay to ensure state is applied
            setTimeout(() => {
              console.log('🔍 Calling generateDesktopMobilePreview');
              generateDesktopMobilePreview(dmUrl, dmVersion);
            }, 100);
          }
        }
        
        // Handle text overlays - support old object format (to), new array format (t), and mixed
        const textOverlaysData = shareData.to || shareData.t;
        if (textOverlaysData && Array.isArray(textOverlaysData)) {
          const textOverlays = textOverlaysData.map((overlay: any) => {
            // Handle new array format [id, text, fontSize, color, x, y, extras?]
            if (Array.isArray(overlay)) {
              const [id, text, fontSize, color, x, y, extras = {}] = overlay;
              const expandedColor = color === 'W' ? '#FFFFFF' : color === 'B' ? '#000000' : color;
              
              return {
                id: restoreId(id),
                text,
                fontSize,
                desktopFontSize: extras.df || fontSize,
                mobileFontSize: extras.mf || fontSize,
                fontColor: expandedColor,
                x,
                y,
                desktopX: extras.dx !== undefined ? extras.dx : x,
                desktopY: extras.dy !== undefined ? extras.dy : y,
                mobileX: extras.mx !== undefined ? extras.mx : x,
                mobileY: extras.my !== undefined ? extras.my : y,
                allCaps: extras.ac === 1 || extras.ac === true
              };
            } else {
              // Handle old object format for backward compatibility
              return {
                id: overlay.i,
                text: overlay.t,
                fontSize: overlay.f,
                desktopFontSize: overlay.df || overlay.f,
                mobileFontSize: overlay.mf || overlay.f,
                fontColor: overlay.c,
                x: overlay.x,
                y: overlay.y,
                desktopX: overlay.dx !== undefined ? overlay.dx : overlay.x,
                desktopY: overlay.dy !== undefined ? overlay.dy : overlay.y,
                mobileX: overlay.mx !== undefined ? overlay.mx : overlay.x,
                mobileY: overlay.my !== undefined ? overlay.my : overlay.y,
                allCaps: overlay.ac === 1 || overlay.ac === true
              };
            }
          });
          urlState.textOverlays = textOverlays;
          if (textOverlays.length > 0) {
            urlState.activeOverlayId = textOverlays[0].id;
            urlState.activeOverlayType = 'text';
          }
        }
        
        // Handle image overlays - support old object format (io), new array format (o), and mixed
        const imageOverlaysData = shareData.io || shareData.o;
        if (imageOverlaysData && Array.isArray(imageOverlaysData)) {
          const imageOverlays = imageOverlaysData.map((overlay: any) => {
            // Handle new array format [id, url, width, height, x, y, aspectRatio, extras?]
            if (Array.isArray(overlay)) {
              const [id, originalImageUrl, width, height, x, y, aspectRatio, extras = {}] = overlay;
              
              return {
                id: restoreId(id),
                imageUrl: '', // Will be loaded later
                originalImageUrl: decompressUrl(originalImageUrl),
                width,
                height,
                x,
                y,
                desktopX: extras.dx !== undefined ? extras.dx : x,
                desktopY: extras.dy !== undefined ? extras.dy : y,
                mobileX: extras.mx !== undefined ? extras.mx : x,
                mobileY: extras.my !== undefined ? extras.my : y,
                desktopWidth: extras.dw !== undefined ? extras.dw : width,
                desktopHeight: extras.dh !== undefined ? extras.dh : height,
                mobileWidth: extras.mw !== undefined ? extras.mw : width,
                mobileHeight: extras.mh !== undefined ? extras.mh : height,
                aspectRatio,
                presetLogoId: extras.pl,
                presetLogoType: extras.pt,
                selectedLanguage: extras.sl,
                availableLanguages: extras.al
              };
            } else {
              // Handle old object format for backward compatibility
              return {
                id: overlay.i,
                imageUrl: '', // Will be loaded later
                originalImageUrl: decompressUrl(overlay.u),
                width: overlay.w,
                height: overlay.h,
                x: overlay.x,
                y: overlay.y,
                desktopX: overlay.dx !== undefined ? overlay.dx : overlay.x,
                desktopY: overlay.dy !== undefined ? overlay.dy : overlay.y,
                mobileX: overlay.mx !== undefined ? overlay.mx : overlay.x,
                mobileY: overlay.my !== undefined ? overlay.my : overlay.y,
                desktopWidth: overlay.dw !== undefined ? overlay.dw : overlay.w,
                desktopHeight: overlay.dh !== undefined ? overlay.dh : overlay.h,
                mobileWidth: overlay.mw !== undefined ? overlay.mw : overlay.w,
                mobileHeight: overlay.mh !== undefined ? overlay.mh : overlay.h,
                aspectRatio: overlay.a,
                presetLogoId: overlay.pl,
                presetLogoType: overlay.pt,
                selectedLanguage: overlay.sl,
                availableLanguages: overlay.al
              };
            }
          });
          
          // Load the images and convert to base64
          const imageUrls = imageOverlays.map((overlay: any) => overlay.originalImageUrl).filter(Boolean);
          if (imageUrls.length > 0) {
            fetch('/api/load-images', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ images: imageUrls })
            })
            .then(response => response.json())
            .then(data => {
              const updatedImageOverlays = imageOverlays.map((overlay: any, index: number) => ({
                ...overlay,
                imageUrl: data.images[index] || overlay.imageUrl
              }));
              
              setFormState(prev => ({
                ...prev,
                imageOverlays: updatedImageOverlays
              }));
            })
            .catch(error => {
              console.error('Error loading shared image overlays:', error);
              urlState.imageOverlays = imageOverlays;
            });
          } else {
            urlState.imageOverlays = imageOverlays;
          }
        }
        
        setFormState(prev => ({ ...prev, ...urlState }));
        
        return;
        
      } catch (error) {
        console.error('❌ Failed to parse compressed data:', error);
        // Fall through to legacy parsing
      }
    } else {
      console.log('🔍 No compressed data, checking legacy URL format');
    }
    
    // Legacy URL parsing (existing code)
    console.log('🔍 Processing legacy URL format...');
    const numericKeys: NumericKeys[] = ['width', 'height', 'brightness', 'imageX', 'imageY', 'imageZoom'];
    const stringKeys: StringKeys[] = [];  // Removed imageUrl
    const urlState: Partial<FormState> = {};
    
    // Handle mode parameter
    const mode = params.get('mode') as 'url' | 'upload' | 'transparent' | 'desktop-mobile' | null;
    console.log('🔍 Legacy mode parameter:', mode);
    if (mode && ['url', 'upload', 'transparent', 'desktop-mobile'].includes(mode)) {
      console.log('🔍 Setting activeImageSourceTab to legacy mode:', mode);
      setActiveImageSourceTab(mode);
    }    // Handle desktop/mobile specific parameters
    if (mode === 'desktop-mobile') {
      const dmVersion = params.get('desktopMobileVersion') as 'desktop' | 'mobile' | null;
      if (dmVersion && ['desktop', 'mobile'].includes(dmVersion)) {
        setDesktopMobileVersion(dmVersion);
      }
      
      const dmImageUrl = params.get('desktopMobileImageUrl');
      if (dmImageUrl) {
        setDesktopMobileImageUrl(dmImageUrl);
      }
    }
    
    numericKeys.forEach(key => {
      const value = params.get(key);
      if (value) {
        urlState[key] = Number(value);
      }
    });

    stringKeys.forEach(key => {
      const value = params.get(key);
      if (value) {
        urlState[key] = value;
      }
    });

    // Handle text overlays if present in URL
    const overlaysParam = params.get('overlays');
    if (overlaysParam) {
      try {
        const decodedOverlays = JSON.parse(decodeURIComponent(overlaysParam)) as TextOverlay[];
        if (Array.isArray(decodedOverlays) && decodedOverlays.length > 0) {
          urlState.textOverlays = decodedOverlays;
          // Set the first overlay as active
          urlState.activeOverlayId = decodedOverlays[0].id;
          urlState.activeOverlayType = 'text';
        }
      } catch (error) {
        console.error('Failed to parse text overlays from URL:', error);
        // Continue with other parameters even if overlay parsing fails
      }
    }
    
    // Handle image overlays if present in URL
    const imageOverlaysParam = params.get('imageOverlays');
    if (imageOverlaysParam) {
      try {
        const decodedImageOverlays = JSON.parse(decodeURIComponent(imageOverlaysParam)) as ImageOverlay[];
        if (Array.isArray(decodedImageOverlays) && decodedImageOverlays.length > 0) {
          // Load the images and convert to base64
          const imageUrls = decodedImageOverlays.map(overlay => overlay.originalImageUrl).filter(Boolean);
          if (imageUrls.length > 0) {
            fetch('/api/load-images', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ images: imageUrls })
            })
            .then(response => response.json())
            .then(data => {
              const updatedImageOverlays = decodedImageOverlays.map((overlay, index) => ({
                ...overlay,
                imageUrl: data.images[index] || overlay.imageUrl
              }));
              
              setFormState(prev => ({
                ...prev,
                imageOverlays: updatedImageOverlays
              }));
            })
            .catch(error => {
              console.error('Error loading shared image overlays:', error);
              // Still set the overlays with original URLs as fallback
              urlState.imageOverlays = decodedImageOverlays;
            });
          } else {
            urlState.imageOverlays = decodedImageOverlays;
          }
        }
      } catch (error) {
        console.error('Failed to parse image overlays from URL:', error);
        // Continue with other parameters even if overlay parsing fails
      }
    }
    
    // Handle legacy text overlay format only if no new overlays found
    if (!overlaysParam && !imageOverlaysParam) {
      // Handle legacy URL format (individual text parameters)
      const legacyText = params.get('text');
      const legacyFontSize = params.get('fontSize');
      const legacyFontColor = params.get('fontColor');
      const legacyX = params.get('x');
      const legacyY = params.get('y');
      
      // If legacy text parameters exist, convert them to the new overlay format
      if (legacyText && legacyFontSize && legacyFontColor && legacyX !== null && legacyY !== null) {
        // Apply font size adjustment for legacy URLs due to font changes
        // Reduce legacy font size by approximately 41% (11 -> 6.5 is about 59% of original)
        const originalFontSize = Number(legacyFontSize);
        const adjustedFontSize = Math.round(originalFontSize * 0.59 * 10) / 10; // Round to 1 decimal place
        
        const legacyOverlay: TextOverlay = {
          id: 'legacy-overlay',
          text: decodeURIComponent(legacyText.replace(/\+/g, ' ')), // Handle URL encoding
          fontSize: adjustedFontSize,
          fontColor: decodeURIComponent(legacyFontColor),
          x: Number(legacyX),
          y: Number(legacyY)
        };
        
        urlState.textOverlays = [legacyOverlay];
        urlState.activeOverlayId = legacyOverlay.id;
        
        console.log(`Converted legacy URL parameters to overlay. Original fontSize: ${originalFontSize}, Adjusted fontSize: ${adjustedFontSize}`, legacyOverlay);
      }
    }

    // Handle imageUrl separately - skip for transparent mode and desktop-mobile mode (handled separately)
    const imageUrl = params.get('imageUrl');
    console.log('🔍 Legacy imageUrl parameter:', imageUrl, 'mode:', mode);
    if (imageUrl && mode !== 'transparent' && mode !== 'desktop-mobile') {
      console.log('🔍 Loading legacy image URL:', imageUrl);
      setIsLoading(true);
      setOriginalImageUrl(imageUrl); // Store the original URL from params
      fetch('/api/load-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ images: [imageUrl] }),
      })
      .then(response => {
        console.log('🔍 Legacy image API response status:', response.status);
        return response.json();
      })
      .then(data => {
        console.log('🔍 Legacy image loaded successfully');
        setFormState(prev => ({
          ...prev,
          ...urlState,
          imageUrl: data.images[0]
        }));
        setIsLoading(false);
      })
      .catch(error => {
        console.error('❌ Error loading legacy shared image:', error);
        setError('Failed to load shared image');
        setOriginalImageUrl(''); // Clear original URL on error
        setIsLoading(false);
      });
    } else if (mode === 'transparent') {
      console.log('🔍 Setting transparent mode');
      // Set transparent mode
      setFormState(prev => ({
        ...prev,
        ...urlState,
        imageUrl: 'transparent'
      }));
      setOriginalImageUrl('transparent');
    } else if (mode === 'desktop-mobile') {
      console.log('🔍 Setting desktop-mobile mode');
      // Handle desktop-mobile mode
      const dmImageUrl = params.get('desktopMobileImageUrl');
      const dmVersion = params.get('desktopMobileVersion') as 'desktop' | 'mobile' || 'desktop';
      console.log('🔍 Desktop-mobile params - URL:', dmImageUrl, 'Version:', dmVersion);
      
      if (dmImageUrl) {
        console.log('🔍 Generating desktop-mobile preview for:', dmImageUrl);
        // Generate the desktop-mobile preview
        generateDesktopMobilePreview(dmImageUrl, dmVersion);
      }
      
      // Apply other URL state
      if (Object.keys(urlState).length) {
        console.log('🔍 Applying desktop-mobile URL state:', urlState);
        setFormState(prev => ({ ...prev, ...urlState }));
      }
    } else if (Object.keys(urlState).length) {
      console.log('🔍 Applying final URL state (no mode):', urlState);
      setFormState(prev => ({ ...prev, ...urlState }));
    } else {
      console.log('🔍 No URL state to apply');
    }
    
    console.log('🔍 URL Loading Effect - Completed');
  }, []);

  const updateSliderProgress = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const value = ((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
    input.style.setProperty('--range-progress', `${value}%`);
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (e.target instanceof HTMLInputElement && e.target.type === 'range') {
      updateSliderProgress(e as React.ChangeEvent<HTMLInputElement>);
    }

    if (name === 'imageUrl' && activeImageSourceTab === 'url') {
      setIsLoading(true);
      setError(null); // Clear previous errors
      
      try {
        if (!value.trim()) {
          throw new Error('Please enter an image URL');
        }
        
        // Validate URL format
        try {
          new URL(value);
        } catch {
          throw new Error('Please enter a valid URL');
        }

        setOriginalImageUrl(value);
        
        const response = await fetch('/api/load-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ images: [value] }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || `Failed to load image (${response.status})`);
        }

        const data = await response.json();
        const base64ImageString = data.images[0];

        if (!base64ImageString?.startsWith('data:image/')) {
          throw new Error('Invalid image format received from server');
        }

        setFormState(prev => ({ ...prev, imageUrl: base64ImageString }));
      } catch (error) {
        console.error('Error loading image:', error);
        setError(error instanceof Error ? error.message : 'Failed to load image');
        setFormState(prev => ({ ...prev, imageUrl: '' }));
        setOriginalImageUrl('');
      } finally {
        setIsLoading(false);
      }
    } else {
      // Check if this is a dimension change in desktop-mobile mode (only height fields now)
      const isDimensionField = ['desktopHeight', 'mobileHeight'].includes(name);
      
      if (isDimensionField) {
        const numValue = Number(value);
        const dimensionType = name.includes('Width') ? 'width' : 'height';
        const validation = validateDimension(numValue, dimensionType);
        
        if (!validation.isValid && value !== '') {
          // Show validation error
          setError(validation.message || 'Invalid dimension value');
          // Still update the state to reflect user input, but don't trigger preview
          setFormState(prev => ({ ...prev, [name]: numValue }));
        } else {
          // Clear any previous errors and update state
          if (error && error.includes('must be at least') || error?.includes('cannot exceed')) {
            setError(null);
          }
          setFormState(prev => ({ ...prev, [name]: numValue }));
        }
      } else {
        setFormState(prev => ({ ...prev, [name]: value }));
      }
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (2MB = 2 * 1024 * 1024 bytes)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('size_exceeded');
      event.target.value = ''; // Clear the file input
      return;
    }

    setIsLoading(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const base64ImageString = e.target?.result as string;
      setFormState(prev => ({ ...prev, imageUrl: base64ImageString }));
      setError(null);
      setIsLoading(false);
    };

    reader.onerror = () => {
      setError('Error reading image file');
      setFormState(prev => ({ ...prev, imageUrl: '' }));
      setIsLoading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      // Guard: ensure uploaded image is available in upload mode
      if (activeImageSourceTab === 'upload' && (!formState.imageUrl || !formState.imageUrl.startsWith('data:image/'))) {
        setError('Uploaded image not available yet.');
        setIsLoading(false);
        return;
      }

      let response;
      // Use POST for upload mode, transparent mode, desktop-mobile mode, or base64 data URLs
      if (activeImageSourceTab === 'upload' || activeImageSourceTab === 'transparent' || activeImageSourceTab === 'desktop-mobile' || formState.imageUrl.startsWith('data:image/')) {
        const payload = { 
          ...formState, 
          download: true,
          ...(activeImageSourceTab === 'desktop-mobile' && {
            desktopMobileVersion,
            desktopMobileImageUrl,
            isDesktopMobileMode: true,
            showMilwaukeeLogo
          })
        };
        response = await fetch('/api/overlay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        const downloadParams = new URLSearchParams();
        Object.entries(formState).forEach(([key, value]) => {
          if (key === 'imageUrl') return; // Skip the base64 imageUrl
          downloadParams.set(key, String(value));
        });
        downloadParams.set('imageUrl', originalImageUrl);
        downloadParams.set('download', 'true');
        response = await fetch(`/api/overlay?${downloadParams}`);
      }
      if (!response.ok) throw new Error('Failed to generate image');
      
      // Get the appropriate file extension from Content-Type header
      const contentType = response.headers.get('Content-Type');
      const fileExtension = contentType === 'image/png' ? 'png' : 'jpg';
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `overlay-${Date.now()}.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDesktopMobileDownload = async (version: 'desktop' | 'mobile') => {
    setIsLoading(true);
    try {
      // Create payload with desktop/mobile specific dimensions and settings
      const dimensions = version === 'desktop' ? { width: 1240, height: 968 } : { width: 1240, height: 1400 };
      const payload = { 
        ...formState, 
        ...dimensions,
        imageUrl: desktopMobileImageUrl,
        download: true,
        isDesktopMobileMode: true,
        desktopMobileVersion: version,
        showMilwaukeeLogo
      };
      
      const response = await fetch('/api/overlay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error('Failed to generate image');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Get file extension from response headers or default to png
      const contentType = response.headers.get('content-type') || 'image/png';
      const fileExtension = contentType.includes('jpeg') ? 'jpg' : 'png';
      
      a.download = `overlay-${version}-${Date.now()}.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = () => {
    try {
      const url = new URL(window.location.href);
      
      // Helper function to compress URLs - replace common long domains with short codes
      const compressUrl = (originalUrl: string): string => {
        if (!originalUrl) return originalUrl;
        return originalUrl
          .replace('https://image.s50.sfmc-content.com/lib/', 'S50/')
          .replace('https://image.s51.sfmc-content.com/lib/', 'S51/')
          .replace('https://image.s52.sfmc-content.com/lib/', 'S52/')
          .replace('https://milwaukee-overlay.vercel.app/', 'V/');
      };
      
      // Helper function to decompress URLs
      const decompressUrl = (compressedUrl: string): string => {
        if (!compressedUrl) return compressedUrl;
        return compressedUrl
          .replace('S50/', 'https://image.s50.sfmc-content.com/lib/')
          .replace('S51/', 'https://image.s51.sfmc-content.com/lib/')
          .replace('S52/', 'https://image.s52.sfmc-content.com/lib/')
          .replace('V/', 'https://milwaukee-overlay.vercel.app/');
      };
      
      // Helper function to create short overlay IDs
      const shortenId = (id: string): string => {
        if (!id) return id;
        // Extract just the timestamp and a few chars from the hash
        const match = id.match(/overlay-(\d+)-([a-z0-9]{8})/);
        if (match) {
          return `${match[1]}.${match[2]}`;
        }
        return id;
      };
      
      // Create ultra-compressed data object
      const shareData: any = {
        m: activeImageSourceTab, // mode
        ...(activeImageSourceTab === 'desktop-mobile' && {
          v: desktopMobileVersion === 'desktop' ? 0 : 1, // 0=desktop, 1=mobile (save chars)
          ...(desktopMobileImageUrl && { u: compressUrl(desktopMobileImageUrl) }),
          dw: formState.desktopWidth,
          dh: formState.desktopHeight,
          mw: formState.mobileWidth,
          mh: formState.mobileHeight
        }),
        // Core state with ultra-short keys
        w: formState.width,
        h: formState.height,
        ...(formState.brightness !== 100 && { b: formState.brightness }), // Only include if not default
        ...(formState.imageZoom !== 1 && { z: formState.imageZoom }), // Only include if not default
        ...(formState.imageX !== 0 && { x: formState.imageX }), // Only include if not default
        ...(formState.imageY !== 0 && { y: formState.imageY }), // Only include if not default
        ...(activeImageSourceTab !== 'transparent' && activeImageSourceTab !== 'desktop-mobile' && originalImageUrl && {
          i: compressUrl(originalImageUrl)
        })
      };

      // Ultra-compressed text overlays
      if (formState.textOverlays.length > 0) {
        shareData.t = formState.textOverlays.map(overlay => {
          const compressed: any = [
            shortenId(overlay.id),
            overlay.text,
            overlay.fontSize,
            overlay.fontColor === '#FFFFFF' ? 'W' : overlay.fontColor === '#000000' ? 'B' : overlay.fontColor, // W=white, B=black
            overlay.x,
            overlay.y
          ];
          
          // Add optional fields only if they differ from base values
          const extras: any = {};
          if (overlay.desktopX !== undefined && overlay.desktopX !== overlay.x) {
            extras.dx = overlay.desktopX;
          }
          if (overlay.desktopY !== undefined && overlay.desktopY !== overlay.y) {
            extras.dy = overlay.desktopY;
          }
          if (overlay.mobileX !== undefined && overlay.mobileX !== overlay.x) {
            extras.mx = overlay.mobileX;
          }
          if (overlay.mobileY !== undefined && overlay.mobileY !== overlay.y) {
            extras.my = overlay.mobileY;
          }
          if (overlay.desktopFontSize !== undefined && overlay.desktopFontSize !== overlay.fontSize) {
            extras.df = overlay.desktopFontSize;
          }
          if (overlay.mobileFontSize !== undefined && overlay.mobileFontSize !== overlay.fontSize) {
            extras.mf = overlay.mobileFontSize;
          }
          if (overlay.allCaps) {
            extras.ac = 1;
          }
          
          if (Object.keys(extras).length > 0) {
            compressed.push(extras);
          }
          
          return compressed;
        });
      }

      // Ultra-compressed image overlays
      if (formState.imageOverlays.length > 0) {
        shareData.o = formState.imageOverlays.map(overlay => {
          const compressed: any = [
            shortenId(overlay.id),
            compressUrl(overlay.originalImageUrl),
            overlay.width,
            overlay.height,
            overlay.x,
            overlay.y,
            overlay.aspectRatio
          ];
          
          // Add optional fields only if they differ from base values
          const extras: any = {};
          if (overlay.desktopX !== undefined && overlay.desktopX !== overlay.x) {
            extras.dx = overlay.desktopX;
          }
          if (overlay.desktopY !== undefined && overlay.desktopY !== overlay.y) {
            extras.dy = overlay.desktopY;
          }
          if (overlay.mobileX !== undefined && overlay.mobileX !== overlay.x) {
            extras.mx = overlay.mobileX;
          }
          if (overlay.mobileY !== undefined && overlay.mobileY !== overlay.y) {
            extras.my = overlay.mobileY;
          }
          if (overlay.desktopWidth !== undefined && overlay.desktopWidth !== overlay.width) {
            extras.dw = overlay.desktopWidth;
          }
          if (overlay.desktopHeight !== undefined && overlay.desktopHeight !== overlay.height) {
            extras.dh = overlay.desktopHeight;
          }
          if (overlay.mobileWidth !== undefined && overlay.mobileWidth !== overlay.width) {
            extras.mw = overlay.mobileWidth;
          }
          if (overlay.mobileHeight !== undefined && overlay.mobileHeight !== overlay.height) {
            extras.mh = overlay.mobileHeight;
          }
          if (overlay.presetLogoId) {
            extras.pl = overlay.presetLogoId;
          }
          if (overlay.presetLogoType) {
            extras.pt = overlay.presetLogoType;
          }
          if (overlay.selectedLanguage) {
            extras.sl = overlay.selectedLanguage;
          }
          if (overlay.availableLanguages) {
            extras.al = overlay.availableLanguages;
          }
          
          if (Object.keys(extras).length > 0) {
            compressed.push(extras);
          }
          
          return compressed;
        });
      }

      // Use lz-string for efficient URL-safe compression
      const jsonString = JSON.stringify(shareData);
      const compressed = LZString.compressToEncodedURIComponent(jsonString);
      
      // Clear existing params and set the compressed data with 'c' prefix to indicate lz-string compression
      url.search = '';
      url.searchParams.set('c', compressed);

      const finalUrl = url.toString();
      
      console.log('Final URL length:', finalUrl.length);
      console.log('Compression details:', {
        originalData: shareData,
        jsonLength: jsonString.length,
        compressedLength: compressed.length,
        finalUrlLength: finalUrl.length,
        compressionRatio: ((1 - compressed.length / jsonString.length) * 100).toFixed(1) + '%'
      });
      
      // With lz-string compression, we can handle much larger configurations
      // Most browsers support URLs up to 2000-8000 characters
      if (finalUrl.length > 8000) {
        throw new Error('Configuration is too complex to share via URL. Try removing some overlays or shortening text.');
      }

      navigator.clipboard.writeText(finalUrl);
      setToastMessage('Settings URL copied to clipboard!');
      setShowToast(true);
      setShowShareSuccess(true);
      setTimeout(() => {
        setShowToast(false);
        setShowShareSuccess(false);
      }, 1500);
    } catch (error) {
      console.error('Share error:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate share URL');
    }
  };

  const handleTextChange = (value: string) => {
    setFormState(prev => ({ ...prev, text: value }));
  };

  const handleError = (message: string) => {
    setError(message);
  };

  // Handle image load
  const handleImageLoad = (dimensions: {width: number; height: number}) => {
    setFormState(prev => ({
      ...prev,
      width: dimensions.width,
      height: dimensions.height
    }));
  };

  const handleColorSwatchClick = (color: string) => {
    setFormState(prev => ({ ...prev, fontColor: color }));
  };

  // Handle position change for a text or image overlay
  const handlePositionChange = (overlayId: string, newX: number, newY: number) => {
    // Special case: If newX and newY are both -1, this is a signal to just select the overlay
    if (newX === -1 && newY === -1) {
      setActiveOverlay(overlayId);
      return;
    }
    
    // Normal case: Update the position of the overlay
    setFormState(prev => {
      // Check if it's a text overlay
      const isTextOverlay = prev.textOverlays.some(overlay => overlay.id === overlayId);
      
      if (isTextOverlay) {
        return {
          ...prev,
          textOverlays: prev.textOverlays.map(overlay => {
            if (overlay.id === overlayId) {
              // In desktop-mobile mode, update the appropriate version-specific position
              if (activeImageSourceTab === 'desktop-mobile') {
                if (desktopMobileVersion === 'desktop') {
                  return { ...overlay, desktopX: Math.round(newX), desktopY: Math.round(newY) };
                } else if (desktopMobileVersion === 'mobile') {
                  return { ...overlay, mobileX: Math.round(newX), mobileY: Math.round(newY) };
                }
              }
              // Default behavior: update generic x, y
              return { ...overlay, x: Math.round(newX), y: Math.round(newY) };
            }
            return overlay;
          }),
          // Also make this the active overlay when dragging it
          activeOverlayId: overlayId,
          activeOverlayType: 'text'
        };
      } else {
        // It's an image overlay
        return {
          ...prev,
          imageOverlays: prev.imageOverlays.map(overlay => {
            if (overlay.id === overlayId) {
              // In desktop-mobile mode, update the appropriate version-specific position
              if (activeImageSourceTab === 'desktop-mobile') {
                if (desktopMobileVersion === 'desktop') {
                  return { ...overlay, desktopX: Math.round(newX), desktopY: Math.round(newY) };
                } else if (desktopMobileVersion === 'mobile') {
                  return { ...overlay, mobileX: Math.round(newX), mobileY: Math.round(newY) };
                }
              }
              // Default behavior: update generic x, y
              return { ...overlay, x: Math.round(newX), y: Math.round(newY) };
            }
            return overlay;
          }),
          // Also make this the active overlay when dragging it
          activeOverlayId: overlayId,
          activeOverlayType: 'image'
        };
      }
    });
  };

  // Handle font size change for a text overlay
  const handleFontSizeChange = (overlayId: string, newFontSize: number) => {
    setFormState(prev => ({
      ...prev,
      textOverlays: prev.textOverlays.map(overlay => {
        if (overlay.id === overlayId) {
          // In desktop-mobile mode, update the appropriate version-specific font size
          if (activeImageSourceTab === 'desktop-mobile') {
            if (desktopMobileVersion === 'desktop') {
              return { ...overlay, desktopFontSize: Math.round(newFontSize * 10) / 10 };
            } else if (desktopMobileVersion === 'mobile') {
              return { ...overlay, mobileFontSize: Math.round(newFontSize * 10) / 10 };
            }
          }
          // Default behavior: update generic fontSize
          return { ...overlay, fontSize: Math.round(newFontSize * 10) / 10 };
        }
        return overlay;
      })
    }));
  };

  // Handle size change for an image overlay
  const handleImageSizeChange = (overlayId: string, newWidth: number) => {
    setFormState(prev => ({
      ...prev,
      imageOverlays: prev.imageOverlays.map(overlay => {
        if (overlay.id === overlayId) {
          // Calculate height based on aspect ratio
          const newHeight = newWidth / overlay.aspectRatio;
          
          // In desktop-mobile mode, update the appropriate version-specific size
          if (activeImageSourceTab === 'desktop-mobile') {
            if (desktopMobileVersion === 'desktop') {
              return { ...overlay, desktopWidth: Math.round(newWidth * 10) / 10, desktopHeight: Math.round(newHeight * 10) / 10 };
            } else if (desktopMobileVersion === 'mobile') {
              return { ...overlay, mobileWidth: Math.round(newWidth * 10) / 10, mobileHeight: Math.round(newHeight * 10) / 10 };
            }
          }
          // Default behavior: update generic width/height
          return { ...overlay, width: Math.round(newWidth * 10) / 10, height: Math.round(newHeight * 10) / 10 };
        }
        return overlay;
      })
    }));
  };

  // Handle desktop/mobile version change
  const handleDesktopMobileVersionChange = (version: 'desktop' | 'mobile') => {
    console.log('Version change requested:', version, 'Current tab:', activeImageSourceTab, 'Background URL:', desktopMobileImageUrl);
    setDesktopMobileVersion(version);
    if (activeImageSourceTab === 'desktop-mobile' && desktopMobileImageUrl) {
      // Check if we have a cached preview for this version with matching source URL and dimensions
      const cached = previewCache[version];
      const expectedWidth = version === 'desktop' ? formState.desktopWidth : formState.mobileWidth;
      const expectedHeight = version === 'desktop' ? formState.desktopHeight : formState.mobileHeight;
      
      if (cached && 
          cached.sourceUrl === desktopMobileImageUrl && 
          cached.width === expectedWidth && 
          cached.height === expectedHeight) {
        console.log('Using cached preview for version:', version);
        // Use cached preview immediately - no loading state needed
        setFormState(prev => ({ 
          ...prev, 
          imageUrl: cached.url,
          width: cached.width,
          height: cached.height
        }));
      } else {
        console.log('Cache miss, regenerating preview for version:', version);
        // Regenerate preview with new dimensions
        generateDesktopMobilePreview(desktopMobileImageUrl, version);
      }
    }
  };

  // Handle desktop/mobile image URL change
  const handleDesktopMobileImageUrlChange = (url: string) => {
    setDesktopMobileImageUrl(url);
    // Clear cache when source URL changes
    setPreviewCache({ desktop: null, mobile: null });
    if (activeImageSourceTab === 'desktop-mobile') {
      // Generate preview with logo for desktop-mobile mode
      generateDesktopMobilePreview(url, desktopMobileVersion);
      setOriginalImageUrl(url);
    }
  };

  // Generate desktop/mobile preview with logo
  const generateDesktopMobilePreview = async (backgroundUrl: string, version?: 'desktop' | 'mobile', showLogo?: boolean) => {
    if (!backgroundUrl) {
      console.log('No background URL provided');
      return;
    }
    
    const versionToUse = version || desktopMobileVersion;
    // Use passed showLogo value if provided, otherwise use state
    const shouldShowLogo = showLogo !== undefined ? showLogo : showMilwaukeeLogo;
    const dimensions = versionToUse === 'desktop' 
      ? { width: Number(formState.desktopWidth), height: Number(formState.desktopHeight) } 
      : { width: Number(formState.mobileWidth), height: Number(formState.mobileHeight) };
    
    // Check cache first - but don't use cache when logo setting changes
    const cached = previewCache[versionToUse];
    if (cached && 
        cached.sourceUrl === backgroundUrl && 
        cached.width === dimensions.width && 
        cached.height === dimensions.height) {
      console.log('Using cached preview for version:', versionToUse);
      setFormState(prev => ({ 
        ...prev, 
        imageUrl: cached.url,
        width: dimensions.width,
        height: dimensions.height
      }));
      return;
    }
    
    console.log('Generating preview for version:', versionToUse, 'URL:', backgroundUrl, 'showLogo:', shouldShowLogo);
    
    try {
      setIsLoading(true);
      const payload = {
        ...formState,
        ...dimensions,
        imageUrl: backgroundUrl,
        textOverlays: [], // Empty for preview, we'll add text overlays in the canvas
        imageOverlays: [], // Empty for preview, we'll add image overlays in the canvas
        isDesktopMobileMode: true,
        desktopMobileVersion: versionToUse,
        showMilwaukeeLogo: shouldShowLogo,
        download: false
      };
      
      console.log('Sending API request with payload:', payload);
      const response = await fetch('/api/overlay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate preview: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const previewUrl = URL.createObjectURL(blob);
      console.log('Preview generated successfully:', previewUrl);
      
      // Cache the generated preview
      setPreviewCache(prev => ({
        ...prev,
        [versionToUse]: {
          url: previewUrl,
          sourceUrl: backgroundUrl,
          width: dimensions.width,
          height: dimensions.height
        }
      }));
      
      setFormState(prev => ({ 
        ...prev, 
        imageUrl: previewUrl,
        width: dimensions.width,
        height: dimensions.height
      }));
      
      // Preload the other version in the background for instant switching
      preloadOtherVersion(backgroundUrl, versionToUse);
    } catch (error) {
      console.error('Preview generation failed:', error);
      setError('Failed to generate preview. Please check the background image URL.');
    } finally {
      setIsLoading(false);
    }
  };

  // Preload the other version (desktop/mobile) in the background for instant switching
  const preloadOtherVersion = async (backgroundUrl: string, currentVersion: 'desktop' | 'mobile') => {
    const otherVersion = currentVersion === 'desktop' ? 'mobile' : 'desktop';
    const otherDimensions = otherVersion === 'desktop' 
      ? { width: Number(formState.desktopWidth), height: Number(formState.desktopHeight) } 
      : { width: Number(formState.mobileWidth), height: Number(formState.mobileHeight) };
    
    // Check if already cached
    const cached = previewCache[otherVersion];
    if (cached && 
        cached.sourceUrl === backgroundUrl && 
        cached.width === otherDimensions.width && 
        cached.height === otherDimensions.height) {
      console.log('Other version already cached:', otherVersion);
      return;
    }
    
    console.log('Preloading other version in background:', otherVersion);
    
    try {
      const payload = {
        ...formState,
        ...otherDimensions,
        imageUrl: backgroundUrl,
        textOverlays: [],
        imageOverlays: [],
        isDesktopMobileMode: true,
        desktopMobileVersion: otherVersion,
        showMilwaukeeLogo: showMilwaukeeLogo,
        download: false
      };
      
      const response = await fetch('/api/overlay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.warn('Background preload failed:', response.status);
        return;
      }
      
      const blob = await response.blob();
      const previewUrl = URL.createObjectURL(blob);
      console.log('Background preload complete for:', otherVersion);
      
      // Cache the preloaded preview (don't update form state, just cache it)
      setPreviewCache(prev => ({
        ...prev,
        [otherVersion]: {
          url: previewUrl,
          sourceUrl: backgroundUrl,
          width: otherDimensions.width,
          height: otherDimensions.height
        }
      }));
    } catch (error) {
      // Silently fail for background preload - it's just an optimization
      console.warn('Background preload error:', error);
    }
  };

  // Generate desktop/mobile preview with explicit dimensions (for dimension changes)
  const generateDesktopMobilePreviewWithDimensions = async (backgroundUrl: string, version: 'desktop' | 'mobile', state: FormState) => {
    if (!backgroundUrl) {
      console.log('No background URL provided');
      return;
    }
    
    console.log('Generating preview with custom dimensions for version:', version, 'URL:', backgroundUrl);
    
    try {
      setIsLoading(true);
      const dimensions = version === 'desktop' 
        ? { width: Number(state.desktopWidth), height: Number(state.desktopHeight) } 
        : { width: Number(state.mobileWidth), height: Number(state.mobileHeight) };
      const payload = {
        ...state,
        ...dimensions,
        imageUrl: backgroundUrl,
        textOverlays: [], // Empty for preview, we'll add text overlays in the canvas
        imageOverlays: [], // Empty for preview, we'll add image overlays in the canvas
        isDesktopMobileMode: true,
        desktopMobileVersion: version,
        showMilwaukeeLogo: showMilwaukeeLogo,
        download: false
      };
      
      console.log('Sending API request with custom dimensions:', {
        ...payload,
        imageUrl: payload.imageUrl.substring(0, 50) + '...' // Truncate URL for readability
      });
      const response = await fetch('/api/overlay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      console.log('Response status:', response.status, response.statusText);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response:', errorText);
        throw new Error(`Failed to generate preview: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const blob = await response.blob();
      console.log('Blob received:', blob.size, 'bytes, type:', blob.type);
      const previewUrl = URL.createObjectURL(blob);
      console.log('Preview with custom dimensions generated successfully:', previewUrl);
      
      setFormState(prev => ({ 
        ...prev, 
        imageUrl: previewUrl,
        width: dimensions.width,
        height: dimensions.height
      }));
    } catch (error) {
      console.error('Preview generation with custom dimensions failed:', error);
      setError('Failed to generate preview. Please check the background image URL and dimensions.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="slds-grid slds-wrap slds-gutters_large slds-p-around_medium preview-container-parent">
      {/* Left column - Controls */}
      <div className="slds-col slds-size_1-of-1 slds-large-size_1-of-2 controls-column">
        <article className="slds-card slds-card_boundary shadow-md">
          <div className="slds-card__header slds-grid slds-grid_align-spread slds-border_bottom slds-p-around_medium">
            <div className="slds-media__body">
              <h1 className="slds-text-heading_medium slds-text-color_default slds-truncate">
                Image Settings
              </h1>
            </div>
          </div>
          <div className="slds-card__body slds-p-around_large">
            <form className="slds-form" onSubmit={(e) => e.preventDefault()} role="form" aria-label="Image overlay configuration">
              
              {/* Image Source Accordion */}
              <div className="slds-accordion">
                <div className={`slds-accordion__section ${openAccordions.imageSource ? 'slds-is-open' : ''}`}>
                  <div className="slds-accordion__summary">
                    <h3 className="slds-accordion__summary-heading">
                      <button
                        aria-controls="image-source-content"
                        aria-expanded={openAccordions.imageSource}
                        className="slds-button slds-button_reset slds-accordion__summary-action"
                        onClick={() => toggleAccordion('imageSource')}
                      >
                        <svg className="slds-icon slds-icon_small slds-icon-text-default slds-button__icon slds-button__icon_left" aria-hidden="true">
                          <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#upload"></use>
                        </svg>
                        <span className="slds-accordion__summary-content">Image Source</span>
                        <svg className="slds-accordion__summary-action-icon slds-icon slds-icon_small slds-button__icon slds-button__icon_right" aria-hidden="true">
                          <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#chevrondown"></use>
                        </svg>
                      </button>
                    </h3>
                  </div>
                  <div 
                    className="slds-accordion__content" 
                    id="image-source-content"
                    hidden={!openAccordions.imageSource}
                  >
                    <div className="form-section">
                      <div className="slds-form-element slds-form-element_stacked">
                        <div className="slds-tabs_scoped">
                          <ul className="slds-tabs_scoped__nav slds-tabs_responsive" role="tablist">
                            <li className={`slds-tabs_scoped__item ${activeImageSourceTab === 'url' ? 'slds-is-active' : ''}`} role="presentation">
                              <button
                                className="slds-tabs_scoped__link"
                                role="tab"
                                aria-selected={activeImageSourceTab === 'url'}
                                aria-controls="image-url-tab-content"
                                id="image-url-tab"
                                onClick={() => handleImageSourceTabChange('url')}
                              >
                                Image URL
                              </button>
                            </li>
                            <li className={`slds-tabs_scoped__item ${activeImageSourceTab === 'upload' ? 'slds-is-active' : ''}`} role="presentation">
                              <button
                                className="slds-tabs_scoped__link"
                                role="tab"
                                aria-selected={activeImageSourceTab === 'upload'}
                                aria-controls="image-upload-tab-content"
                                id="image-upload-tab"
                                onClick={() => handleImageSourceTabChange('upload')}
                              >
                                Image Upload
                              </button>
                            </li>
                            <li className={`slds-tabs_scoped__item ${activeImageSourceTab === 'transparent' ? 'slds-is-active' : ''}`} role="presentation">
                              <button
                                className="slds-tabs_scoped__link"
                                role="tab"
                                aria-selected={activeImageSourceTab === 'transparent'}
                                aria-controls="transparent-canvas-tab-content"
                                id="transparent-canvas-tab"
                                onClick={() => handleImageSourceTabChange('transparent')}
                              >
                                Transparent Canvas
                              </button>
                            </li>
                            <li className={`slds-tabs_scoped__item ${activeImageSourceTab === 'desktop-mobile' ? 'slds-is-active' : ''}`} role="presentation">
                              <button
                                className="slds-tabs_scoped__link"
                                role="tab"
                                aria-selected={activeImageSourceTab === 'desktop-mobile'}
                                aria-controls="desktop-mobile-tab-content"
                                id="desktop-mobile-tab"
                                onClick={() => handleImageSourceTabChange('desktop-mobile')}
                              >
                                Desktop & Mobile
                              </button>
                            </li>
                          </ul>
                          <div id="image-url-tab-content" className={`slds-tabs_scoped__content ${activeImageSourceTab === 'url' ? '' : 'slds-hide'}`} role="tabpanel" aria-labelledby="image-url-tab">
                            <div className="slds-form-element__control">
                              <label className="slds-form-element__label" htmlFor="imageUrl">
                                <abbr className="slds-required" title="required">*</abbr>
                                Image URL
                              </label>
                              <div className="slds-form-element__control slds-input-has-icon slds-input-has-icon_left">
                                <div className="slds-icon_container">
                                  <svg className="slds-icon slds-input__icon slds-icon-text-default" aria-hidden="true">
                                    <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#link"></use>
                                  </svg>
                                </div>
                                <input
                                  type="url"
                                  id="imageUrl"
                                  name="imageUrl"
                                  value={originalImageUrl}
                                  onChange={handleInputChange}
                                  className="slds-input"
                                  placeholder="https://example.com/image.jpg"
                                  aria-describedby="imageUrlHelp"
                                  required={activeImageSourceTab !== 'upload'}
                                />
                              </div>
                              <div className="slds-form-element__help" id="imageUrlHelp">
                                Enter the URL of the image you want to add text to
                              </div>
                            </div>
                          </div>
                          <div id="image-upload-tab-content" className={`slds-tabs_scoped__content ${activeImageSourceTab === 'upload' ? '' : 'slds-hide'}`} role="tabpanel" aria-labelledby="image-upload-tab">
                            <div className="slds-notify slds-notify_alert slds-theme_warning slds-m-bottom_small" role="alert">
                              <div className="slds-notify__content">
                                <div className="slds-media slds-media_center">
                                  <div className="slds-media__figure">
                                    <svg className="slds-icon slds-icon_small" aria-hidden="true">
                                      <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#warning"></use>
                                    </svg>
                                  </div>
                                  <div className="slds-media__body">
                                    <p>Note: Uploaded images will not be included in shareable URLs. Only text overlays and settings will be shared.</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="slds-form-element__control">
                              <label className="slds-form-element__label" htmlFor="imageUpload">
                                <abbr className="slds-required" title="required">*</abbr>
                                Upload Image
                              </label>
                              <input
                                type="file"
                                id="imageUpload"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="slds-file-selector__input slds-assistive-text"
                              />
                              <label className="slds-file-selector__body" htmlFor="imageUpload">
                                <span className="slds-file-selector__button slds-button slds-button_neutral">
                                  <svg className="slds-button__icon slds-button__icon_left" aria-hidden="true">
                                    <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#upload"></use>
                                  </svg>
                                  Upload Image
                                </span>
                              </label>
                              <div className="slds-form-element__help" id="imageUploadHelp">
                                Select an image file from your computer (JPG, PNG, or GIF)
                              </div>
                            </div>
                          </div>
                          <div id="transparent-canvas-tab-content" className={`slds-tabs_scoped__content ${activeImageSourceTab === 'transparent' ? '' : 'slds-hide'}`} role="tabpanel" aria-labelledby="transparent-canvas-tab">
                            <div className="slds-notify slds-notify_alert slds-theme_info slds-m-bottom_small" role="alert">
                              <div className="slds-notify__content">
                                <div className="slds-media slds-media_center">
                                  <div className="slds-media__figure">
                                    <svg className="slds-icon slds-icon_small" aria-hidden="true">
                                      <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#info"></use>
                                    </svg>
                                  </div>
                                  <div className="slds-media__body">
                                    <p>Create a transparent background canvas with custom dimensions. Perfect for creating text-only images or overlays.</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="slds-grid slds-gutters_small">
                              <div className="slds-col">
                                <div className="slds-form-element">
                                  <label className="slds-form-element__label" htmlFor="canvasWidth">
                                    <abbr className="slds-required" title="required">*</abbr>
                                    Canvas Width (px)
                                  </label>
                                  <div className="slds-form-element__control">
                                    <input
                                      type="number"
                                      id="canvasWidth"
                                      name="width"
                                      value={formState.width}
                                      onChange={handleInputChange}
                                      className="slds-input"
                                      min="100"
                                      max="2000"
                                      step="1"
                                      required
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="slds-col">
                                <div className="slds-form-element">
                                  <label className="slds-form-element__label" htmlFor="canvasHeight">
                                    <abbr className="slds-required" title="required">*</abbr>
                                    Canvas Height (px)
                                  </label>
                                  <div className="slds-form-element__control">
                                    <input
                                      type="number"
                                      id="canvasHeight"
                                      name="height"
                                      value={formState.height}
                                      onChange={handleInputChange}
                                      className="slds-input"
                                      min="100"
                                      max="2000"
                                      step="1"
                                      required
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="slds-form-element__help slds-m-top_small">
                              Set custom dimensions for your transparent canvas. Common sizes: 800x600, 1200x630 (social media), 1920x1080 (HD)
                            </div>
                          </div>
                          <div id="desktop-mobile-tab-content" className={`slds-tabs_scoped__content ${activeImageSourceTab === 'desktop-mobile' ? '' : 'slds-hide'}`} role="tabpanel" aria-labelledby="desktop-mobile-tab">
                            {/* Version Selection */}
                            <div className="slds-form-element slds-m-bottom_large">
                              <fieldset className="slds-form-element__legend">
                                <legend className="slds-form-element__legend slds-form-element__label">
                                  Version
                                </legend>
                                <div className="slds-form-element__control">
                                  <div className="slds-button-group" role="group">
                                    <button
                                      type="button"
                                      className={`slds-button ${desktopMobileVersion === 'desktop' ? 'slds-button_brand' : 'slds-button_neutral'}`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('Desktop button clicked!');
                                        handleDesktopMobileVersionChange('desktop');
                                      }}
                                      style={{ pointerEvents: 'auto', zIndex: 10 }}
                                    >
                                      Desktop
                                    </button>
                                    <button
                                      type="button"
                                      className={`slds-button ${desktopMobileVersion === 'mobile' ? 'slds-button_brand' : 'slds-button_neutral'}`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('Mobile button clicked!');
                                        handleDesktopMobileVersionChange('mobile');
                                      }}
                                      style={{ pointerEvents: 'auto', zIndex: 10 }}
                                    >
                                      Mobile
                                    </button>
                                  </div>
                                </div>
                              </fieldset>
                            </div>

                            {/* Canvas Dimensions - Separate Row */}
                            <div className="slds-form-element slds-m-bottom_medium slds-m-top_x-large" style={{ clear: 'both', width: '100%' }}>
                              <fieldset className="slds-form-element">
                                <legend className="slds-form-element__legend slds-form-element__label">
                                  {desktopMobileVersion === 'desktop' ? 'Desktop' : 'Mobile'} Canvas Dimensions
                                </legend>
                                <div className="slds-form-element__control">
                                  <div className="slds-grid slds-gutters_small">
                                    <div className="slds-col slds-size_1-of-2">
                                      <div className="slds-form-element">
                                        <label className="slds-form-element__label" htmlFor={`${desktopMobileVersion}Width`}>
                                          Width (px)
                                        </label>
                                        <div className="slds-form-element__control">
                                          <input
                                            type="number"
                                            id={`${desktopMobileVersion}Width`}
                                            name={`${desktopMobileVersion}Width`}
                                            value={desktopMobileVersion === 'desktop' ? formState.desktopWidth : formState.mobileWidth}
                                            className="slds-input"
                                            min="100"
                                            max="5000"
                                            step="1"
                                            disabled
                                            style={{ backgroundColor: '#f3f2f2', color: '#706e6b', cursor: 'not-allowed' }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="slds-col slds-size_1-of-2">
                                      <div className="slds-form-element">
                                        <label className="slds-form-element__label" htmlFor={`${desktopMobileVersion}Height`}>
                                          Height (px)
                                        </label>
                                        <div className="slds-form-element__control">
                                          <input
                                            type="number"
                                            id={`${desktopMobileVersion}Height`}
                                            name={`${desktopMobileVersion}Height`}
                                            value={desktopMobileVersion === 'desktop' ? formState.desktopHeight : formState.mobileHeight}
                                            onChange={handleInputChange}
                                            className={getDimensionErrorClass('height')}
                                            min="350"
                                            max="5000"
                                            step="1"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="slds-form-element__help slds-text-color_weak slds-text-body_small slds-m-top_x-small">
                                    Width is fixed • Height: {DIMENSION_CONSTRAINTS.MIN_HEIGHT}px - {DIMENSION_CONSTRAINTS.MAX_HEIGHT}px
                                  </div>
                                </div>
                              </fieldset>
                            </div>

                            {/* Background Image URL */}
                            <div className="slds-form-element slds-m-bottom_medium">
                              <label className="slds-form-element__label" htmlFor="desktopMobileImageUrl">
                                <abbr className="slds-required" title="required">*</abbr>
                                Background Image URL
                              </label>
                              <div className="slds-form-element__control slds-input-has-icon slds-input-has-icon_left">
                                <div className="slds-icon_container">
                                  <svg className="slds-icon slds-input__icon slds-icon-text-default" aria-hidden="true">
                                    <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#link"></use>
                                  </svg>
                                </div>
                                <input
                                  type="url"
                                  id="desktopMobileImageUrl"
                                  value={desktopMobileImageUrl}
                                  onChange={(e) => handleDesktopMobileImageUrlChange(e.target.value)}
                                  className="slds-input"
                                  placeholder="https://example.com/background-image.jpg"
                                  required
                                />
                              </div>
                              <div className="slds-form-element__help">
                                The background image will be resized to fit the selected dimensions (1240x968 for desktop, 1240x1400 for mobile)
                              </div>
                            </div>

                            {/* Milwaukee Logo Toggle */}
                            <div className="slds-form-element slds-m-top_medium">
                              <div className="slds-form-element__control">
                                <div className="slds-checkbox">
                                  <input
                                    type="checkbox"
                                    id="showMilwaukeeLogo"
                                    checked={showMilwaukeeLogo}
                                    onChange={(e) => {
                                      const newValue = e.target.checked;
                                      setShowMilwaukeeLogo(newValue);
                                      // Clear cache to regenerate preview with/without logo
                                      setPreviewCache({ desktop: null, mobile: null });
                                      if (desktopMobileImageUrl) {
                                        // Pass the new value directly to avoid closure issues
                                        generateDesktopMobilePreview(desktopMobileImageUrl, desktopMobileVersion, newValue);
                                      }
                                    }}
                                  />
                                  <label className="slds-checkbox__label" htmlFor="showMilwaukeeLogo">
                                    <span className="slds-checkbox__faux"></span>
                                    <span className="slds-form-element__label">Show Milwaukee Logo</span>
                                  </label>
                                </div>
                              </div>
                              <div className="slds-form-element__help slds-m-top_xx-small">
                                When enabled, the Milwaukee logo will be added to the top-left corner of the image
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              
                {/* Image Adjustments Accordion - hidden for transparent and desktop-mobile modes */}
                {activeImageSourceTab !== 'transparent' && activeImageSourceTab !== 'desktop-mobile' && (
                <div className={`slds-accordion__section ${openAccordions.imageAdjustments ? 'slds-is-open' : ''}`}>
                  <div className="slds-accordion__summary">
                    <h3 className="slds-accordion__summary-heading">
                      <button
                        aria-controls="image-adjustments-content"
                        aria-expanded={openAccordions.imageAdjustments}
                        className="slds-button slds-button_reset slds-accordion__summary-action"
                        onClick={() => toggleAccordion('imageAdjustments')}
                      >
                        <svg className="slds-icon slds-icon_small slds-icon-text-default slds-button__icon slds-button__icon_left" aria-hidden="true">
                          <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#slider"></use>
                        </svg>
                        <span className="slds-accordion__summary-content">Image Adjustments</span>
                        <svg className="slds-accordion__summary-action-icon slds-icon slds-icon_small slds-button__icon slds-button__icon_right" aria-hidden="true">
                          <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#chevrondown"></use>
                        </svg>
                      </button>
                    </h3>
                  </div>
                  <div 
                    className="slds-accordion__content" 
                    id="image-adjustments-content"
                    hidden={!openAccordions.imageAdjustments}
                  >
                    <div className="form-section">
                      <div className="slds-form-element slds-form-element_stacked">
                        <div className="slds-form-element">
                          <label className="slds-form-element__label" htmlFor="brightness">
                            Brightness: {formState.brightness}%
                          </label>
                          <div className="slds-form-element__control">
                            <div className="slds-slider custom-slider">
                              <input
                                type="range"
                                id="brightness"
                                name="brightness"
                                min={0}
                                max={200}
                                value={formState.brightness}
                                onChange={handleInputChange}
                                className="slds-slider__range"
                                aria-valuemin={0}
                                aria-valuemax={200}
                                aria-valuenow={formState.brightness}
                                aria-valuetext={`Image brightness: ${formState.brightness}%`}
                              />
                            </div>
                          </div>
                          <div className="slds-form-element__help slds-m-top_x-small">
                            <p className="position-tip">
                              <strong>Tip:</strong> Use lower brightness values when adding light-colored text to bright images
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="slds-form-element">
                        <label className="slds-form-element__label" htmlFor="imageZoom">
                          Image Zoom: {formState.imageZoom * 100}%
                        </label>
                        <div className="slds-form-element__control">
                          <div className="slds-slider custom-slider">
                            <input
                              type="range"
                              id="imageZoom"
                              name="imageZoom"
                              min={1}
                              max={3}
                              step={0.1}
                              value={formState.imageZoom}
                              onChange={handleInputChange}
                              className="slds-slider__range"
                              aria-valuemin={1}
                              aria-valuemax={3}
                              aria-valuenow={formState.imageZoom}
                              aria-valuetext={`Image zoom: ${formState.imageZoom * 100}%`}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="slds-grid slds-gutters_small slds-m-top_small">
                        <div className="slds-col">
                          <div className="slds-form-element">
                            <label className="slds-form-element__label" htmlFor="imageX">
                              Horizontal Position: {formState.imageX}%
                            </label>
                            <div className="slds-form-element__control">
                              <div className="slds-slider custom-slider">
                                <input
                                  type="range"
                                  id="imageX"
                                  name="imageX"
                                  min={0}
                                  max={100}
                                  value={formState.imageX}
                                  onChange={handleInputChange}
                                  className="slds-slider__range"
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-valuenow={formState.imageX}
                                  aria-valuetext={`Image horizontal position: ${formState.imageX}%`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="slds-col">
                          <div className="slds-form-element">
                            <label className="slds-form-element__label" htmlFor="imageY">
                              Vertical Position: {formState.imageY}%
                            </label>
                            <div className="slds-form-element__control">
                              <div className="slds-slider custom-slider">
                                <input
                                  type="range"
                                  id="imageY"
                                  name="imageY"
                                  min={0}
                                  max={100}
                                  value={formState.imageY}
                                  onChange={handleInputChange}
                                  className="slds-slider__range"
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-valuenow={formState.imageY}
                                  aria-valuetext={`Image vertical position: ${formState.imageY}%`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="slds-form-element__help slds-m-top_x-small">
                        <p className="position-tip">
                          <strong>Tip:</strong> Use these controls to adjust how the background image is displayed
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                )}
                
                {/* Text Overlays Accordion */}
                <div className={`slds-accordion__section ${openAccordions.textOverlays ? 'slds-is-open' : ''}`}>
                  <div className="slds-accordion__summary">
                    <h3 className="slds-accordion__summary-heading">
                      <button
                        aria-controls="text-overlays-content"
                        aria-expanded={openAccordions.textOverlays}
                        className="slds-button slds-button_reset slds-accordion__summary-action"
                        onClick={() => toggleAccordion('textOverlays')}
                      >
                        <svg className="slds-icon slds-icon_small slds-icon-text-default slds-button__icon slds-button__icon_left" aria-hidden="true">
                          <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#layers"></use>
                        </svg>
                        <span className="slds-accordion__summary-content">Text Overlays</span>
                        <span className="slds-badge slds-m-left_xx-small">{formState.textOverlays.length}</span>
                        <svg className="slds-accordion__summary-action-icon slds-icon slds-icon_small slds-button__icon slds-button__icon_right" aria-hidden="true">
                          <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#chevrondown"></use>
                        </svg>
                      </button>
                    </h3>
                  </div>
                  <div 
                    className="slds-accordion__content" 
                    id="text-overlays-content"
                    hidden={!openAccordions.textOverlays}
                  >
                    <div className="form-section">
                      {/* Add New Overlay */}
                      <div className="slds-form-element">
                        <label className="slds-form-element__label" htmlFor="newOverlayText">
                          Add New Text Overlay
                        </label>
                        <div className="slds-form-element__control slds-input-has-icon slds-input-has-icon_right">
                          <input
                            type="text"
                            id="newOverlayText"
                            value={newOverlayText}
                            onChange={(e) => setNewOverlayText(e.target.value)}
                            className="slds-input"
                            placeholder="Enter text for new overlay"
                          />
                          <button 
                            className="slds-button slds-button_icon slds-input__icon slds-input__icon_right"
                            onClick={() => addTextOverlay(newOverlayText)}
                            disabled={!newOverlayText.trim()}
                            title="Add new text overlay"
                          >
                            <svg className="slds-button__icon" aria-hidden="true">
                              <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#add"></use>
                            </svg>
                            <span className="slds-assistive-text">Add new text overlay</span>
                          </button>
                        </div>
                        <div className="slds-form-element__help">
                          Enter text and click the + icon to add a new text overlay
                        </div>
                      </div>

                      {/* List of Overlays */}
                      <div className="slds-m-top_medium">
                        <h4 className="slds-text-title_caps slds-m-bottom_x-small">Text Overlays</h4>
                        
                        {formState.textOverlays.length === 0 ? (
                          <div className="slds-box slds-box_xx-small slds-theme_shade slds-text-align_center slds-m-top_x-small">
                            <p className="slds-text-body_small slds-text-color_weak">
                              No text overlays added yet. Add your first one above!
                            </p>
                          </div>
                        ) : (
                          <ul className="slds-has-dividers_around-space">
                            {formState.textOverlays.map(overlay => (
                              <li 
                                key={overlay.id} 
                                className={`slds-item overlay-item ${formState.activeOverlayId === overlay.id ? 'slds-is-selected active-overlay-item' : ''}`}
                              >
                                <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center slds-p-around_xx-small">
                                  <button 
                                    className="slds-media slds-media_center overlay-select-button" 
                                    onClick={() => setActiveOverlay(overlay.id)}
                                    style={{ 
                                      width: 'calc(100% - 44px)',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      border: 'none',
                                      background: 'transparent',
                                      padding: '0.5rem',
                                      position: 'relative'
                                    }}
                                    aria-pressed={formState.activeOverlayId === overlay.id}
                                  >
                                    <div className="slds-media__figure">
                                      <span 
                                        className="slds-icon_container" 
                                        style={{ 
                                          width: '16px', 
                                          height: '16px', 
                                          borderRadius: '2px',
                                          backgroundColor: overlay.fontColor,
                                          border: overlay.fontColor === '#FFFFFF' ? '1px solid #dddbda' : 'none'
                                        }}
                                        title={`Color: ${overlay.fontColor}`}
                                      ></span>
                                    </div>
                                    <div className="slds-media__body slds-truncate" title={overlay.text}>
                                      <span className={`slds-text-body_regular ${formState.activeOverlayId === overlay.id ? 'slds-text-color_default' : 'slds-text-color_weak'}`}>
                                        {overlay.text || <em>Empty text</em>}
                                      </span>
                                      <span className="slds-text-body_small slds-text-color_weak slds-m-left_small">
                                        {fontPercentToPixels(
                                          activeImageSourceTab === 'desktop-mobile'
                                            ? (desktopMobileVersion === 'desktop' 
                                                ? (overlay.desktopFontSize ?? overlay.fontSize) 
                                                : (overlay.mobileFontSize ?? overlay.fontSize))
                                            : overlay.fontSize,
                                          activeImageSourceTab === 'desktop-mobile' ? FONT_REFERENCE_WIDTH : formState.width
                                        )}px
                                      </span>
                                    </div>
                                  </button>
                                  <div className="slds-no-flex">
                                    <button 
                                      className="slds-button slds-button_icon" 
                                      onClick={() => confirmDelete(overlay.id)}
                                      title="Delete this overlay"
                                    >
                                      <svg className="slds-button__icon" aria-hidden="true">
                                        <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#delete"></use>
                                      </svg>
                                      <span className="slds-assistive-text">Delete this overlay</span>
                                    </button>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Text Content Accordion */}
                <div className={`slds-accordion__section ${openAccordions.textContent ? 'slds-is-open' : ''}`}>
                  <div className="slds-accordion__summary">
                    <h3 className="slds-accordion__summary-heading">
                      <button
                        aria-controls="text-content-content"
                        aria-expanded={openAccordions.textContent}
                        className="slds-button slds-button_reset slds-accordion__summary-action"
                        onClick={() => toggleAccordion('textContent')}
                      >
                        <svg className="slds-icon slds-icon_small slds-icon-text-default slds-button__icon slds-button__icon_left" aria-hidden="true">
                          <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#text"></use>
                        </svg>
                        <span className="slds-accordion__summary-content">Text Content</span>
                        <svg className="slds-accordion__summary-action-icon slds-icon slds-icon_small slds-button__icon slds-button__icon_right" aria-hidden="true">
                          <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#chevrondown"></use>
                        </svg>
                      </button>
                    </h3>
                  </div>
                  <div 
                    className="slds-accordion__content" 
                    id="text-content-content"
                    hidden={!openAccordions.textContent}
                  >
                    <div className="form-section">
                      {!formState.activeOverlayId ? (
                        <div className="slds-box slds-box_xx-small slds-theme_shade slds-text-align_center">
                          <p className="slds-text-body_small slds-text-color_weak">
                            Please select a text overlay to edit its content
                          </p>
                        </div>
                      ) : (
                        <div className="slds-form-element slds-form-element_stacked">
                          <div className="slds-form-element__control">
                            <RichTextEditor
                              value={activeOverlay?.text || ''}
                              onChange={handleOverlayTextChange}
                              fontSize={fontPercentToPixels(
                                activeImageSourceTab === 'desktop-mobile'
                                  ? (desktopMobileVersion === 'desktop' 
                                      ? (activeOverlay?.desktopFontSize ?? activeOverlay?.fontSize ?? 5)
                                      : (activeOverlay?.mobileFontSize ?? activeOverlay?.fontSize ?? 5))
                                  : (activeOverlay?.fontSize ?? 5),
                                activeImageSourceTab === 'desktop-mobile' ? FONT_REFERENCE_WIDTH : formState.width
                              )}
                              onFontSizeChange={(sizePx) => {
                                const referenceWidth = activeImageSourceTab === 'desktop-mobile' ? FONT_REFERENCE_WIDTH : formState.width;
                                const percentValue = fontPixelsToPercent(sizePx, referenceWidth);
                                if (activeImageSourceTab === 'desktop-mobile') {
                                  updateActiveOverlay(
                                    desktopMobileVersion === 'desktop' ? 'desktopFontSize' : 'mobileFontSize',
                                    percentValue
                                  );
                                } else {
                                  updateActiveOverlay('fontSize', percentValue);
                                }
                              }}
                              minFontSize={activeImageSourceTab === 'desktop-mobile' ? 12 : Math.round(formState.width * 0.01)}
                              maxFontSize={activeImageSourceTab === 'desktop-mobile' ? 248 : Math.round(formState.width * 0.20)}
                              fontColor={activeOverlay?.fontColor || '#FFFFFF'}
                              onFontColorChange={(color) => updateActiveOverlay('fontColor', color)}
                              allCaps={activeOverlay?.allCaps || false}
                              onAllCapsChange={(enabled) => updateActiveOverlay('allCaps', enabled)}
                              alignment={activeOverlay?.alignment || 'left'}
                              onAlignmentChange={(alignment) => updateActiveOverlay('alignment', alignment)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Text Style & Position Accordion */}
                {/* Image Overlays Accordion */}
                <div className={`slds-accordion__section ${openAccordions.imageOverlays ? 'slds-is-open' : ''}`}>
                  <div className="slds-accordion__summary">
                    <h3 className="slds-accordion__summary-heading">
                      <button
                        aria-controls="image-overlays-content"
                        aria-expanded={openAccordions.imageOverlays}
                        className="slds-button slds-button_reset slds-accordion__summary-action"
                        onClick={() => toggleAccordion('imageOverlays')}
                      >
                        <svg className="slds-icon slds-icon_small slds-icon-text-default slds-button__icon slds-button__icon_left" aria-hidden="true">
                          <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#layers"></use>
                        </svg>
                        <span className="slds-accordion__summary-content">Image Overlays</span>
                        <svg className="slds-accordion__summary-action-icon slds-icon slds-icon_small slds-button__icon slds-button__icon_right" aria-hidden="true">
                          <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#chevrondown"></use>
                        </svg>
                      </button>
                    </h3>
                  </div>
                  <div 
                    className="slds-accordion__content" 
                    id="image-overlays-content"
                    hidden={!openAccordions.imageOverlays}
                  >
                    <div className="form-section">
                      {/* Primary Action: Add Image */}
                      <div className="slds-form-element slds-m-bottom_medium">
                        <label className="slds-form-element__label" htmlFor="new-image-overlay-url">
                          Add Image Overlay
                        </label>
                        
                        {/* URL Input - Primary Method */}
                        <div className="slds-form-element__control slds-m-bottom_small">
                          <div className="slds-input-has-icon slds-input-has-icon_right">
                            <input
                              type="url"
                              id="new-image-overlay-url"
                              className="slds-input"
                              placeholder="Enter image URL..."
                              value={newImageOverlayUrl}
                              onChange={(e) => setNewImageOverlayUrl(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addImageOverlay(newImageOverlayUrl);
                                }
                              }}
                            />
                            <button
                              className="slds-input__icon slds-input__icon_right slds-button slds-button_icon"
                              onClick={() => addImageOverlay(newImageOverlayUrl)}
                              disabled={!newImageOverlayUrl.trim() || isLoading}
                              title="Add image overlay"
                            >
                              <svg className="slds-button__icon" aria-hidden="true">
                                <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#add"></use>
                              </svg>
                              <span className="slds-assistive-text">Add image overlay</span>
                            </button>
                          </div>
                        </div>

                        {/* Secondary Option: Preset Logos */}
                        <div 
                          className="slds-box slds-box_xx-small slds-theme_shade" 
                          style={{ borderRadius: '4px', backgroundColor: '#fafaf9', padding: '8px 12px' }}
                        >
                          <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center" style={{ marginBottom: '6px' }}>
                            <div className="slds-media slds-media_center">
                              <div className="slds-media__figure">
                                <svg className="slds-icon slds-icon_x-small slds-icon-text-default" aria-hidden="true">
                                  <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#apps"></use>
                                </svg>
                              </div>
                              <div className="slds-media__body">
                                <span className="slds-text-body_regular">
                                  Quick Add: Preset Logos
                                </span>
                              </div>
                            </div>
                            {loadingPresetLogos && (
                              <div className="slds-text-body_small slds-text-color_weak">
                                <div className="slds-spinner slds-spinner_xx-small slds-spinner_inline" role="status" style={{ marginRight: '0.25rem' }}>
                                  <span className="slds-assistive-text">Loading</span>
                                  <div className="slds-spinner__dot-a"></div>
                                  <div className="slds-spinner__dot-b"></div>
                                </div>
                                Loading presets...
                              </div>
                            )}
                          </div>
                          
                          {presetLogos && (
                            <div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                                {/* System Logos - Secondary Actions */}
                                {presetLogos.systemLogos.map((logo) => (
                                  <button
                                    key={logo.id}
                                    type="button"
                                    className="slds-button slds-button_neutral slds-button_small"
                                    onClick={() => addPresetLogo(logo)}
                                    disabled={isLoading}
                                    style={{ borderRadius: '12px' }}
                                  >
                                    {logo.name}
                                  </button>
                                ))}
                                
                                {/* Trade Logos - Primary Preset Actions */}
                                {presetLogos.tradeLogos.map((logo) => (
                                  <button
                                    key={logo.id}
                                    type="button"
                                    className="slds-button slds-button_brand slds-button_small"
                                    onClick={() => addPresetLogo(logo)}
                                    disabled={isLoading}
                                    style={{ borderRadius: '12px' }}
                                    title={`Add ${logo.name} logo with multiple language options`}
                                  >
                                    <svg className="slds-button__icon slds-button__icon_left slds-button__icon_xx-small" aria-hidden="true">
                                      <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#world"></use>
                                    </svg>
                                    {logo.name}
                                  </button>
                                ))}
                              </div>
                              
                              <div className="slds-text-body_small slds-text-color_weak">
                                <svg className="slds-icon slds-icon_xx-small slds-m-right_xx-small" aria-hidden="true">
                                  <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#world"></use>
                                </svg>
                                Multi-language logos can be changed using the dropdown in each overlay below
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Image Overlays List - Improved */}
                      <div className="overlays-section">
                        <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center slds-m-bottom_small">
                          <h4 className="slds-text-heading_small slds-m-bottom_none">Your Image Overlays</h4>
                          {formState.imageOverlays.length > 0 && (
                            <span className="slds-badge slds-badge_lightest slds-text-body_small">
                              {formState.imageOverlays.length} overlay{formState.imageOverlays.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        
                        {formState.imageOverlays.length === 0 ? (
                          <div className="slds-illustration slds-illustration_small" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                            <svg className="slds-illustration__svg" viewBox="0 0 454 218" style={{ width: '100px', height: 'auto', opacity: 0.4, marginBottom: '1rem' }}>
                              <g>
                                <rect x="227" y="129" width="40" height="40" rx="4" fill="#c9c9c9"/>
                                <rect x="187" y="89" width="40" height="40" rx="4" fill="#e8e8e8"/>
                                <rect x="267" y="89" width="40" height="40" rx="4" fill="#e8e8e8"/>
                              </g>
                            </svg>
                            <div className="slds-text-longform">
                              <h3 className="slds-text-heading_medium slds-m-bottom_small">No image overlays yet</h3>
                              <p className="slds-text-body_regular slds-text-color_weak">
                                Add your first overlay using the URL input or preset logos above
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="slds-card" style={{ border: '1px solid #e5e5e5', borderRadius: '4px' }}>
                            {formState.imageOverlays.map((overlay, index) => (
                              <div 
                                key={overlay.id} 
                                className={`overlay-item ${formState.activeOverlayId === overlay.id && formState.activeOverlayType === 'image' ? 'slds-is-selected' : ''}`}
                                style={{ 
                                  borderBottom: index < formState.imageOverlays.length - 1 ? '1px solid #f3f2f2' : 'none',
                                  backgroundColor: formState.activeOverlayId === overlay.id && formState.activeOverlayType === 'image' ? '#f4f6fe' : 'white'
                                }}
                              >
                                <div className="slds-p-around_small">
                                  <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center">
                                    {/* Main Content */}
                                    <button
                                      className="slds-media slds-media_center overlay-select-button"
                                      onClick={() => setActiveOverlay(overlay.id, 'image')}
                                      title={`Select ${overlay.presetLogoId ? overlay.presetLogoId : 'image'} overlay`}
                                      style={{ 
                                        flexGrow: 1,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        border: 'none',
                                        background: 'transparent',
                                        padding: 0
                                      }}
                                      aria-pressed={formState.activeOverlayId === overlay.id && formState.activeOverlayType === 'image'}
                                    >
                                      <div className="slds-media__figure slds-m-right_small">
                                        <div style={{ position: 'relative' }}>
                                          <img 
                                            src={overlay.imageUrl} 
                                            alt={`${overlay.presetLogoId || 'Image'} overlay preview`}
                                            style={{ 
                                              width: '48px', 
                                              height: '48px', 
                                              objectFit: 'cover',
                                              borderRadius: '6px',
                                              border: formState.activeOverlayId === overlay.id ? '2px solid #1b96ff' : '1px solid #dddbda',
                                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                                            }}
                                          />
                                          {overlay.presetLogoType === 'trade' && (
                                            <div 
                                              style={{ 
                                                position: 'absolute',
                                                top: '-4px',
                                                right: '-4px',
                                                backgroundColor: '#1b96ff',
                                                borderRadius: '50%',
                                                width: '16px',
                                                height: '16px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                              }}
                                            >
                                              <svg style={{ width: '8px', height: '8px', fill: 'white' }}>
                                                <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#world"></use>
                                              </svg>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="slds-media__body">
                                        <h5 className={`slds-text-heading_small ${formState.activeOverlayId === overlay.id && formState.activeOverlayType === 'image' ? 'slds-text-color_brand' : 'slds-text-color_default'}`}>
                                          {overlay.presetLogoId ? `${overlay.presetLogoId} Logo` : `Image ${index + 1}`}
                                        </h5>
                                        <span className="slds-text-body_small slds-text-color_weak">
                                          Position: {Math.round(
                                            activeImageSourceTab === 'desktop-mobile' 
                                              ? (desktopMobileVersion === 'desktop' 
                                                  ? (overlay.desktopX ?? overlay.x) 
                                                  : (overlay.mobileX ?? overlay.x))
                                              : overlay.x
                                          )}%, {Math.round(
                                            activeImageSourceTab === 'desktop-mobile' 
                                              ? (desktopMobileVersion === 'desktop' 
                                                  ? (overlay.desktopY ?? overlay.y) 
                                                  : (overlay.mobileY ?? overlay.y))
                                              : overlay.y
                                          )}% • Size: {Math.round(
                                            activeImageSourceTab === 'desktop-mobile' 
                                              ? (desktopMobileVersion === 'desktop' 
                                                  ? (overlay.desktopWidth ?? overlay.width) 
                                                  : (overlay.mobileWidth ?? overlay.width))
                                              : overlay.width
                                          )}%
                                        </span>
                                      </div>
                                    </button>
                                    
                                    {/* Actions */}
                                    <div className="slds-no-flex slds-grid slds-gutters_xx-small slds-grid_vertical-align-center">
                                      {/* Language Selector for Trade Logos */}
                                      {overlay.presetLogoType === 'trade' && overlay.availableLanguages && overlay.availableLanguages.length > 1 && (
                                        <div className="slds-col" onClick={(e) => e.stopPropagation()}>
                                          <div className="slds-form-element" style={{ marginBottom: 0 }}>
                                            <div className="slds-form-element__control">
                                              <div className="slds-select_container" style={{ minWidth: '90px' }}>
                                                <select
                                                  className="slds-select slds-select_small"
                                                  value={overlay.selectedLanguage || 'default'}
                                                  onChange={(e) => changeTradeLogoLanguage(overlay.id, e.target.value)}
                                                  disabled={isLoading}
                                                  title="Change language variant"
                                                >
                                                  {overlay.availableLanguages
                                                    .sort((a, b) => {
                                                      if (a === 'default') return -1;
                                                      if (b === 'default') return 1;
                                                      return a.localeCompare(b);
                                                    })
                                                    .map(language => (
                                                      <option key={language} value={language}>
                                                        {language === 'default' ? 'Default' : language}
                                                      </option>
                                                    ))}
                                                </select>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Delete Button */}
                                      <div className="slds-col">
                                        <button 
                                          className="slds-button slds-button_icon slds-button_icon-border-filled" 
                                          onClick={() => deleteImageOverlay(overlay.id)}
                                          title="Delete this overlay"
                                        >
                                          <svg className="slds-button__icon" aria-hidden="true">
                                            <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#delete"></use>
                                          </svg>
                                          <span className="slds-assistive-text">Delete overlay</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </article>
      </div>
      
      {/* Right column - Preview - Using fixed positioning instead of sticky */}
      <div className="sticky-preview-column">
        <article className="slds-card slds-card_boundary shadow-md" aria-label="Image preview">
          <div className="slds-card__header slds-grid slds-grid_align-spread slds-border_bottom slds-p-around_medium">
            <div className="slds-media__body">
              <h2 className="slds-text-heading_medium slds-text-color_default">
                Preview
              </h2>
            </div>
          </div>
          <div className="slds-card__body slds-p-around_medium">
            {isLoading ? (
              <div className="slds-illustration slds-illustration_small slds-p-around_large animate-pulse">
                <div className="slds-align_absolute-center">
                  <div className="slds-spinner slds-spinner_medium" role="status" aria-live="polite">
                    <span className="slds-assistive-text">Loading preview</span>
                    <div className="slds-spinner__dot-a"></div>
                    <div className="slds-spinner__dot-b"></div>
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="slds-notify slds-notify_alert slds-theme_error" role="alert" aria-live="assertive">
                <span className="slds-assistive-text">Error</span>
                <div className="slds-notify__content">
                  <div className="slds-media slds-media_center">
                    <div className="slds-media__figure">
                      <Icons.Error size="small" />
                    </div>
                    <div className="slds-media__body">
                      <p className="slds-text-heading_small slds-m-bottom_small">
                        {error === 'size_exceeded' ? 'Image file size must be less than 2MB.' : error}
                      </p>
                      {error === 'size_exceeded' && (
                        <p>
                          Try compressing your image at{' '}
                          <a 
                            href="https://compressjpeg.com/" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-white underline"
                          >
                            compressjpeg.com
                          </a>
                          {' '}and upload again.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="slds-notify__close">
                  <button 
                    className="slds-button slds-button_icon slds-button_icon-inverse" 
                    onClick={() => setError(null)}
                    aria-label="Dismiss error message"
                  >
                    <Icons.Close />
                    <span className="slds-assistive-text">Close</span>
                  </button>
                </div>
              </div>
            ) : !formState.imageUrl ? (
              <div className="slds-box slds-theme_shade slds-text-align_center slds-p-around_medium empty-state" role="status">
                <div className="slds-m-bottom_medium">
                  <svg className="slds-icon slds-icon_large" aria-hidden="true" width="64" height="64" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4.86 8.86l-3 3.87L9 13.14 6 17h12l-3.86-5.14z"/>
                  </svg>
                </div>
                <p className="slds-text-heading_small slds-m-bottom_small">No image selected</p>
                <p className="slds-text-body_regular slds-text-color_weak">
                  Please enter an image URL, upload an image, or create a transparent canvas to see a preview
                </p>
              </div>
            ) : (
              <div className="preview-container">
                <div className="preview-canvas-wrapper">
                  <CanvasGenerator
                    {...formState}
                    onLoad={() => setIsLoading(false)}
                    onError={handleError}
                    onImageLoad={handleImageLoad}
                    onPositionChange={handlePositionChange}
                    onFontSizeChange={handleFontSizeChange}
                    onImageSizeChange={handleImageSizeChange}
                    className="preview-canvas"
                    isDesktopMobileMode={activeImageSourceTab === 'desktop-mobile'}
                    desktopMobileVersion={desktopMobileVersion}
                  />
                </div>
              </div>
            )}
          </div>
          <footer className="slds-card__footer slds-border_top slds-p-around_medium">
            <div className="slds-grid slds-grid_align-spread">
              <div className="slds-button-group slds-m-right_small">
                <button
                  className="slds-button slds-button_neutral share-button"
                  onClick={handleShare}
                  aria-label="Share configuration URL"
                  onMouseEnter={() => activeImageSourceTab === 'upload' && setShowShareTooltip(true)}
                  onMouseLeave={() => activeImageSourceTab === 'upload' && setShowShareTooltip(false)}
                >
                  <svg className="slds-button__icon slds-button__icon_left" aria-hidden="true">
                    {showShareSuccess ? <Icons.Success /> : <Icons.Share />}
                  </svg>
                  Share
                </button>
                {activeImageSourceTab === 'upload' && showShareTooltip && (
                  <div
                    className="slds-popover slds-popover_tooltip slds-nubbin_bottom tooltip-custom"
                    role="tooltip"
                    id="share-tooltip"
                  >
                    <div className="slds-popover__body">
                      Uploaded image won't be shared, only text content and position settings will be shared
                    </div>
                  </div>
                )}
              </div>
              {activeImageSourceTab === 'desktop-mobile' ? (
                <div className="slds-grid slds-gutters_small">
                  <div className="slds-col">
                    <button
                      className="slds-button slds-button_brand download-button"
                      onClick={() => handleDesktopMobileDownload('desktop')}
                      disabled={isLoading}
                      aria-label="Download desktop version (1240x968)"
                    >
                      <svg className="slds-button__icon slds-button__icon_left" aria-hidden="true">
                        <Icons.Download />
                      </svg>
                      Desktop
                    </button>
                  </div>
                  <div className="slds-col">
                    <button
                      className="slds-button slds-button_brand download-button"
                      onClick={() => handleDesktopMobileDownload('mobile')}
                      disabled={isLoading}
                      aria-label="Download mobile version (1240x1400)"
                    >
                      <svg className="slds-button__icon slds-button__icon_left" aria-hidden="true">
                        <Icons.Download />
                      </svg>
                      Mobile
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="slds-button slds-button_brand download-button"
                  onClick={() => handleDownload()}
                  disabled={isLoading}
                  aria-label="Download image with overlay"
                >
                  <svg className="slds-button__icon slds-button__icon_left" aria-hidden="true">
                    <Icons.Download />
                  </svg>
                  Download
                </button>
              )}
            </div>
          </footer>
        </article>
      </div>
      {showToast && (
        <div className="slds-notify_container slds-is-fixed">
          <div 
            className="slds-notify slds-notify_toast slds-theme_success" 
            role="status" 
            aria-live="polite"
          >
            <div className="slds-notify__content">
              <h2 className="slds-text-heading_small">{toastMessage}</h2>
            </div>
            <div className="slds-notify__close">
              <button 
                className="slds-button slds-button_icon slds-button_icon-inverse" 
                onClick={() => setShowToast(false)}
                aria-label="Close notification"
              >
                <Icons.Close />
                <span className="slds-assistive-text">Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingDeleteId && (
        <div className="slds-backdrop slds-backdrop_open" role="presentation"></div>
      )}
      {pendingDeleteId && (
        <section
          role="dialog"
          tabIndex={-1}
          aria-modal="true"
          aria-labelledby="modal-heading-01"
          aria-describedby="modal-content-id-1"
          className="slds-modal slds-fade-in-open"
        >
          <div className="slds-modal__container">
            <header className="slds-modal__header">
              <button
                className="slds-button slds-button_icon slds-modal__close slds-button_icon-inverse"
                title="Close"
                onClick={cancelDelete}
              >
                <svg className="slds-button__icon slds-button__icon_large" aria-hidden="true">
                  <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#close"></use>
                </svg>
                <span className="slds-assistive-text">Cancel</span>
              </button>
              <h2 id="modal-heading-01" className="slds-modal__title slds-hyphenate">
                Delete Text Overlay
              </h2>
            </header>
            <div className="slds-modal__content slds-p-around_medium" id="modal-content-id-1">
              <p>Are you sure you want to delete this text overlay? This action cannot be undone.</p>
            </div>
            <footer className="slds-modal__footer">
              <button className="slds-button slds-button_neutral" onClick={cancelDelete}>Cancel</button>
              <button className="slds-button slds-button_destructive" onClick={handleDeleteConfirmed}>Delete</button>
            </footer>
          </div>
        </section>
      )}
    </div>
  );
}
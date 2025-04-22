import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
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
  fontColor: string;
  x: number;
  y: number;
}

interface FormState {
  textOverlays: TextOverlay[];
  activeOverlayId: string | null;
  imageUrl: string;
  width: number;
  height: number;
  brightness: number;
  imageZoom: number;
  imageX: number;
  imageY: number;
}

type FormStateKey = keyof Omit<FormState, 'textOverlays' | 'activeOverlayId'>;
type NumericKeys = Extract<FormStateKey, 'width' | 'height' | 'brightness' | 'imageX' | 'imageY' | 'imageZoom'>;
type StringKeys = Extract<FormStateKey, 'imageUrl'>;

export function ClientApp() {
  const [formState, setFormState] = useState<FormState>({
    textOverlays: [],
    activeOverlayId: null,
    imageUrl: '',
    width: 800,
    height: 600,
    brightness: 100, // normal brightness (100%)
    imageZoom: 1,
    imageX: 0,
    imageY: 0
  });
  const [originalImageUrl, setOriginalImageUrl] = useState<string>('');
  const [activeImageSourceTab, setActiveImageSourceTab] = useState<'url' | 'upload'>('url');
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

  // Add state for accordion sections
  const [openAccordions, setOpenAccordions] = useState({
    imageSource: true,
    imageAdjustments: false,
    textOverlays: true,
    textContent: true, 
    textStyle: false
  });
  
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
      y: 10 + (formState.textOverlays.length * 10) % 80 // Staggered positioning
    };
    
    setFormState(prev => ({
      ...prev,
      textOverlays: [...prev.textOverlays, newOverlay],
      activeOverlayId: newOverlay.id
    }));
    
    setNewOverlayText(''); // Clear input field
  };
  
  // Function to update an active text overlay
  const updateActiveOverlay = (field: keyof TextOverlay, value: string | number) => {
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
  const setActiveOverlay = (id: string | null) => {
    setFormState(prev => ({
      ...prev,
      activeOverlayId: id
    }));
  };
  
  // Function to delete an overlay
  const deleteOverlay = (id: string) => {
    setFormState(prev => {
      const updatedOverlays = prev.textOverlays.filter(overlay => overlay.id !== id);
      return {
        ...prev,
        textOverlays: updatedOverlays,
        activeOverlayId: prev.activeOverlayId === id ? (updatedOverlays.length > 0 ? updatedOverlays[0].id : null) : prev.activeOverlayId
      };
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
  
  // Function to handle text change for an overlay
  const handleOverlayTextChange = (value: string) => {
    if (formState.activeOverlayId) {
      updateActiveOverlay('text', value);
    }
  };
  
  // Get currently active overlay
  const activeOverlay = formState.activeOverlayId 
    ? formState.textOverlays.find(overlay => overlay.id === formState.activeOverlayId) 
    : null;

  // Function to toggle accordion sections
  const toggleAccordion = (section: keyof typeof openAccordions) => {
    setOpenAccordions(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const numericKeys: NumericKeys[] = ['width', 'height', 'brightness', 'imageX', 'imageY', 'imageZoom'];
    const stringKeys: StringKeys[] = [];  // Removed imageUrl
    const urlState: Partial<FormState> = {};
    
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
        }
      } catch (error) {
        console.error('Failed to parse text overlays from URL:', error);
        // Continue with other parameters even if overlay parsing fails
      }
    }

    // Handle imageUrl separately
    const imageUrl = params.get('imageUrl');
    if (imageUrl) {
      setIsLoading(true);
      setOriginalImageUrl(imageUrl); // Store the original URL from params
      fetch('/api/load-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ images: [imageUrl] }),
      })
      .then(response => response.json())
      .then(data => {
        setFormState(prev => ({
          ...prev,
          ...urlState,
          imageUrl: data.images[0]
        }));
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error loading shared image:', error);
        setError('Failed to load shared image');
        setOriginalImageUrl(''); // Clear original URL on error
        setIsLoading(false);
      });
    } else if (Object.keys(urlState).length) {
      setFormState(prev => ({ ...prev, ...urlState }));
    }
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
      setFormState(prev => ({ ...prev, [name]: value }));
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
      // Use POST if in upload mode or if the imageUrl is a base64 data URL
      if (activeImageSourceTab === 'upload' || formState.imageUrl.startsWith('data:image/')) {
        const payload = { ...formState, download: true };
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
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `overlay-${Date.now()}.jpg`;
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

  const handleShare = () => {
    const url = new URL(window.location.href);
    
    // Add the basic parameters
    const baseParams: (keyof Omit<FormState, 'textOverlays' | 'activeOverlayId' | 'imageUrl'>)[] = 
      ['width', 'height', 'brightness', 'imageZoom', 'imageX', 'imageY'];
    
    baseParams.forEach(key => {
      url.searchParams.set(key, String(formState[key]));
    });
    
    // Add the image URL (using original URL, not base64)
    url.searchParams.set('imageUrl', originalImageUrl);
    
    // Encode text overlays as JSON in the URL
    if (formState.textOverlays.length > 0) {
      const overlaysJson = JSON.stringify(formState.textOverlays);
      url.searchParams.set('overlays', encodeURIComponent(overlaysJson));
    }

    navigator.clipboard.writeText(url.toString());
    setToastMessage('Settings URL copied to clipboard!');
    setShowToast(true);
    setShowShareSuccess(true);
    setTimeout(() => {
      setShowToast(false);
      setShowShareSuccess(false);
    }, 1500);
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

  // Modified slider label formatting
  const formatSliderLabel = (value: number, type: 'x' | 'y' | 'fontSize') => {
    return `${value}% ${type === 'fontSize' ? 'of image width' : `from ${type === 'x' ? 'left' : 'top'}`}`;
  };

  const handleColorSwatchClick = (color: string) => {
    setFormState(prev => ({ ...prev, fontColor: color }));
  };

  // Handle position change for a text overlay
  const handlePositionChange = (overlayId: string, newX: number, newY: number) => {
    // Special case: If newX and newY are both -1, this is a signal to just select the overlay
    if (newX === -1 && newY === -1) {
      setActiveOverlay(overlayId);
      return;
    }
    
    // Normal case: Update the position of the overlay
    setFormState(prev => ({
      ...prev,
      textOverlays: prev.textOverlays.map(overlay => 
        overlay.id === overlayId
          ? { ...overlay, x: Math.round(newX), y: Math.round(newY) }
          : overlay
      ),
      // Also make this the active overlay when dragging it
      activeOverlayId: overlayId
    }));
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
                        <svg className="slds-accordion__summary-action-icon slds-button__icon slds-button__icon_left" aria-hidden="true">
                          <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#switch"></use>
                        </svg>
                        <span className="slds-accordion__summary-content">Image Source</span>
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
                          <ul className="slds-tabs_scoped__nav" role="tablist">
                            <li className={`slds-tabs_scoped__item ${activeImageSourceTab === 'url' ? 'slds-is-active' : ''}`} role="presentation">
                              <button
                                className="slds-tabs_scoped__link"
                                role="tab"
                                aria-selected={activeImageSourceTab === 'url'}
                                aria-controls="image-url-tab-content"
                                id="image-url-tab"
                                onClick={() => setActiveImageSourceTab('url')}
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
                                onClick={() => setActiveImageSourceTab('upload')}
                              >
                                Image Upload
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
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              
                {/* Image Adjustments Accordion */}
                <div className={`slds-accordion__section ${openAccordions.imageAdjustments ? 'slds-is-open' : ''}`}>
                  <div className="slds-accordion__summary">
                    <h3 className="slds-accordion__summary-heading">
                      <button
                        aria-controls="image-adjustments-content"
                        aria-expanded={openAccordions.imageAdjustments}
                        className="slds-button slds-button_reset slds-accordion__summary-action"
                        onClick={() => toggleAccordion('imageAdjustments')}
                      >
                        <svg className="slds-accordion__summary-action-icon slds-button__icon slds-button__icon_left" aria-hidden="true">
                          <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#image"></use>
                        </svg>
                        <span className="slds-accordion__summary-content">Image Adjustments</span>
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
                        <svg className="slds-accordion__summary-action-icon slds-button__icon slds-button__icon_left" aria-hidden="true">
                          <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#layers"></use>
                        </svg>
                        <span className="slds-accordion__summary-content">Text Overlays</span>
                        <span className="slds-badge slds-m-left_xx-small">{formState.textOverlays.length}</span>
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
                                <div className="slds-grid slds-grid_align-spread slds-p-around_xx-small">
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
                                        {overlay.fontSize}%
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
                        <svg className="slds-accordion__summary-action-icon slds-button__icon slds-button__icon_left" aria-hidden="true">
                          <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#text"></use>
                        </svg>
                        <span className="slds-accordion__summary-content">Text Content</span>
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
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Text Style & Position Accordion */}
                <div className={`slds-accordion__section ${openAccordions.textStyle ? 'slds-is-open' : ''}`}>
                  <div className="slds-accordion__summary">
                    <h3 className="slds-accordion__summary-heading">
                      <button
                        aria-controls="text-style-content"
                        aria-expanded={openAccordions.textStyle}
                        className="slds-button slds-button_reset slds-accordion__summary-action"
                        onClick={() => toggleAccordion('textStyle')}
                      >
                        <svg className="slds-accordion__summary-action-icon slds-button__icon slds-button__icon_left" aria-hidden="true">
                          <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#brush"></use>
                        </svg>
                        <span className="slds-accordion__summary-content">Text Style & Position</span>
                      </button>
                    </h3>
                  </div>
                  <div 
                    className="slds-accordion__content" 
                    id="text-style-content"
                    hidden={!openAccordions.textStyle}
                  >
                    {/* Text Style Section */}
                    <div className="form-section">
                      {!formState.activeOverlayId ? (
                        <div className="slds-box slds-box_xx-small slds-theme_shade slds-text-align_center">
                          <p className="slds-text-body_small slds-text-color_weak">
                            Please select a text overlay to edit its style
                          </p>
                        </div>
                      ) : (
                        <fieldset className="slds-form-element">
                          <legend className="slds-form-element__label slds-form-element__legend">Text Style</legend>
                          <div className="slds-form-element_compound">
                            <div className="slds-grid slds-gutters_medium">
                              <div className="slds-col slds-size_2-of-3">
                                <div className="slds-form-element">
                                  <label className="slds-form-element__label" htmlFor="fontSize">
                                    Font Size: {formatSliderLabel(activeOverlay?.fontSize || 5, 'fontSize')}
                                  </label>
                                  <div className="slds-form-element__control">
                                    <div className="slds-slider custom-slider">
                                      <input
                                        type="range"
                                        id="fontSize"
                                        min={1}
                                        max={20}
                                        value={activeOverlay?.fontSize || 5}
                                        onChange={(e) => updateActiveOverlay('fontSize', Number(e.target.value))}
                                        className="slds-slider__range"
                                        aria-valuemin={1}
                                        aria-valuemax={20}
                                        aria-valuenow={activeOverlay?.fontSize || 5}
                                        aria-valuetext={`${activeOverlay?.fontSize || 5}% of image width`}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="slds-col slds-size_1-of-3">
                                <div className="slds-form-element">
                                  <label className="slds-form-element__label" htmlFor="fontColor">Color</label>
                                  <div className="slds-form-element__control">
                                    <div className="slds-color-picker_swatches color-swatch-container">
                                      <button
                                        type="button"
                                        className={`slds-color-picker__swatch ${activeOverlay?.fontColor === '#DB011C' ? 'slds-is-selected' : ''}`}
                                        aria-label="Red Color"
                                        title="Red"
                                        style={{ backgroundColor: '#DB011C' }}
                                        onClick={() => updateActiveOverlay('fontColor', '#DB011C')}
                                      >
                                        {activeOverlay?.fontColor === '#DB011C' && 
                                          <span className="slds-color-picker__swatch-check" style={{ color: '#FFFFFF' }}>
                                            <Icons.Success size="x-small" />
                                          </span>
                                        }
                                      </button>
                                      <button
                                        type="button"
                                        className={`slds-color-picker__swatch ${activeOverlay?.fontColor === '#000000' ? 'slds-is-selected' : ''}`}
                                        aria-label="Black Color"
                                        title="Black"
                                        style={{ backgroundColor: '#000000' }}
                                        onClick={() => updateActiveOverlay('fontColor', '#000000')}
                                      >
                                        {activeOverlay?.fontColor === '#000000' && 
                                          <span className="slds-color-picker__swatch-check" style={{ color: '#FFFFFF' }}>
                                            <Icons.Success size="x-small" />
                                          </span>
                                        }
                                      </button>
                                      <button
                                        type="button"
                                        className={`slds-color-picker__swatch ${activeOverlay?.fontColor === '#FFFFFF' ? 'slds-is-selected' : ''}`}
                                        aria-label="White Color"
                                        title="White"
                                        style={{ backgroundColor: '#FFFFFF', border: '1px solid #dddbda' }}
                                        onClick={() => updateActiveOverlay('fontColor', '#FFFFFF')}
                                      >
                                        {activeOverlay?.fontColor === '#FFFFFF' && 
                                          <span className="slds-color-picker__swatch-check" style={{ color: '#000000' }}>
                                            <Icons.Success size="x-small" />
                                          </span>
                                        }
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </fieldset>
                      )}
                    </div>
                    
                    {/* Position Section */}
                    <div className="form-section">
                      {!formState.activeOverlayId ? (
                        <div className="slds-box slds-box_xx-small slds-theme_shade slds-text-align_center">
                          <p className="slds-text-body_small slds-text-color_weak">
                            Please select a text overlay to edit its position
                          </p>
                        </div>
                      ) : (
                        <fieldset className="slds-form-element">
                          <legend className="slds-form-element__label slds-form-element__legend">Position</legend>
                          <div className="slds-form-element_compound">
                            <div className="slds-grid slds-gutters_medium">
                              <div className="slds-col">
                                <div className="slds-form-element">
                                  <label className="slds-form-element__label" htmlFor="x-position">
                                    X Position: {formatSliderLabel(activeOverlay?.x || 0, 'x')}
                                  </label>
                                  <div className="slds-form-element__control">
                                    <div className="slds-slider custom-slider">
                                      <input
                                        type="range"
                                        id="x-position"
                                        min={0}
                                        max={100}
                                        value={activeOverlay?.x || 0}
                                        onChange={(e) => updateActiveOverlay('x', Number(e.target.value))}
                                        className="slds-slider__range"
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={activeOverlay?.x || 0}
                                        aria-valuetext={`${activeOverlay?.x || 0}% from left`}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="slds-col">
                                <div className="slds-form-element">
                                  <label className="slds-form-element__label" htmlFor="y-position">
                                    Y Position: {formatSliderLabel(activeOverlay?.y || 0, 'y')}
                                  </label>
                                  <div className="slds-form-element__control">
                                    <div className="slds-slider custom-slider">
                                      <input
                                        type="range"
                                        id="y-position"
                                        min={0}
                                        max={100}
                                        value={activeOverlay?.y || 0}
                                        onChange={(e) => updateActiveOverlay('y', Number(e.target.value))}
                                        className="slds-slider__range"
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={activeOverlay?.y || 0}
                                        aria-valuetext={`${activeOverlay?.y || 0}% from top`}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="slds-form-element__help slds-m-top_x-small">
                              <p className="position-tip">
                                <strong>Tip:</strong> You can also click and drag the text directly on the preview image to position it.
                              </p>
                            </div>
                          </div>
                        </fieldset>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <footer className="slds-card__footer slds-border_top slds-p-around_medium">
            <div className="slds-grid slds-grid_align-spread">
              <div
                className="share-button-wrapper"
                style={{ position: 'relative', display: 'inline-block' }}
                onMouseEnter={() => activeImageSourceTab === 'upload' && setShowShareTooltip(true)}
                onMouseLeave={() => activeImageSourceTab === 'upload' && setShowShareTooltip(false)}
              >
                <button
                  className="slds-button slds-button_neutral share-button"
                  onClick={handleShare}
                  aria-label="Share configuration URL"
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
                    <div style={{ position: 'relative' }}>
                      Uploaded image won't be shared, only text content and position settings will be shared
                      <div className="tooltip-arrow"></div>
                    </div>
                  </div>
                )}
              </div>
              <button
                className="slds-button slds-button_brand download-button"
                onClick={(e) => {
                  // Create ripple effect
                  const button = e.currentTarget;
                  const ripple = button.querySelector('.button-ripple-effect') as HTMLElement;
                  if (ripple) {
                    ripple.style.opacity = '1';
                    ripple.style.transform = 'translate(-50%, -50%) scale(2.5)';
                    setTimeout(() => {
                      ripple.style.opacity = '0';
                      ripple.style.transform = 'translate(-50%, -50%) scale(0)';
                    }, 600);
                  }
                  
                  // Process download
                  handleDownload();
                }}
                disabled={isLoading}
                aria-label="Download image with overlay"
                style={{
                  position: 'relative', 
                  overflow: 'hidden',
                  transition: 'transform 0.2s ease, background-color 0.3s ease'
                }}
              >
                <svg className="slds-button__icon slds-button__icon_left download-icon" aria-hidden="true">
                  <Icons.Download />
                </svg>
                Download
                <span className="button-ripple-effect" style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: '120%',
                  height: '120%',
                  transform: 'translate(-50%, -50%) scale(0)',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '50%',
                  opacity: '0',
                  pointerEvents: 'none',
                  transition: 'transform 0.5s ease-out, opacity 0.5s ease-out'
                }} />
              </button>
            </div>
          </footer>
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
                  Please enter an image URL or upload an image to see a preview
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
                    className="preview-canvas"
                  />
                </div>
              </div>
            )}
          </div>
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
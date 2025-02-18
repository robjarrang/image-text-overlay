import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Icons } from './Icons';

const CanvasGenerator = dynamic(() => import('./CanvasGenerator').then(mod => ({ default: mod.CanvasGenerator })), {
  ssr: false
});
const RichTextEditor = dynamic(() => import('./RichTextEditor').then(mod => ({ default: mod.RichTextEditor })), {
  ssr: false
});

interface FormState {
  text: string;
  imageUrl: string;
  fontSize: number; // now as percentage of image width
  fontColor: string;
  x: number; // now as percentage of image width
  y: number; // now as percentage of image height
  width: number;
  height: number;
}

type FormStateKey = keyof FormState;
type NumericKeys = Extract<FormStateKey, 'x' | 'y' | 'width' | 'height' | 'fontSize'>;
type StringKeys = Extract<FormStateKey, 'text' | 'imageUrl' | 'fontColor'>;

export function ClientApp() {
  const [formState, setFormState] = useState<FormState>({
    text: '',
    imageUrl: '',
    fontSize: 5, // 5% of image width
    fontColor: '#000000',
    x: 10, // 10% from left
    y: 10, // 10% from top
    width: 800,
    height: 600
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const numericKeys: NumericKeys[] = ['x', 'y', 'width', 'height', 'fontSize'];
    const stringKeys: StringKeys[] = ['text', 'fontColor'];  // Removed imageUrl
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
    
    // Add the params individually to handle types correctly
    Object.entries(formState).forEach(([key, value]) => {
      if (key === 'imageUrl') return; // Skip the base64 imageUrl
      url.searchParams.set(key, String(value));
    });
    url.searchParams.set('imageUrl', originalImageUrl);

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

  return (
    <div className="slds-grid slds-wrap slds-gutters_large">
      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-col_padded">
        <article className="slds-card">
          <div className="slds-card__header">
            <header className="slds-media slds-media_center slds-has-flexi-truncate">
              <div className="slds-media__body">
                <h1 className="slds-card__header-title">
                  <span className="slds-text-heading_medium">Image Text Overlay Editor</span>
                </h1>
              </div>
            </header>
          </div>
          <div className="slds-card__body slds-p-around_medium">
            <form className="slds-form" onSubmit={(e) => e.preventDefault()} role="form" aria-label="Image overlay configuration">
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
                      <input
                        type="url"
                        id="imageUrl"
                        name="imageUrl"
                        value={originalImageUrl}  // Show the original URL instead of base64
                        onChange={handleInputChange}
                        className="slds-input"
                        placeholder="https://example.com/image.jpg"
                        aria-describedby="imageUrlHelp"
                        required={activeImageSourceTab !== 'upload'}
                      />
                      <div className="slds-form-element__help" id="imageUrlHelp">
                        Enter the URL of the image you want to add text to
                      </div>
                    </div>
                  </div>

                  <div id="image-upload-tab-content" className={`slds-tabs_scoped__content ${activeImageSourceTab === 'upload' ? '' : 'slds-hide'}`} role="tabpanel" aria-labelledby="image-upload-tab">
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

              <div className="slds-form-element slds-form-element_stacked">
                <div className="slds-grid slds-grid_vertical-align-center" style={{ position: 'relative' }}>
                  <label className="slds-form-element__label" htmlFor="textInput">Text Content</label>
                  <div className="slds-form-element__icon slds-m-left_x-small slds-relative">
                    <button className="slds-button slds-button_icon" aria-describedby="markup-help" onMouseEnter={() => {
                      const popover = document.getElementById('markup-help');
                      if (popover) popover.classList.remove('slds-hide');
                    }} onMouseLeave={() => {
                      const popover = document.getElementById('markup-help');
                      if (popover) popover.classList.add('slds-hide');
                    }}>
                      <svg className="slds-button__icon slds-icon-text-default" aria-hidden="true">
                        <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#info"></use>
                      </svg>
                      <span className="slds-assistive-text">Help</span>
                    </button>
                    <div id="markup-help" className="slds-popover slds-popover_tooltip slds-nubbin_bottom-left slds-hide" role="tooltip" style={{ position: 'absolute', bottom: '140%', left: '50%', transform: 'translateX(-1rem)', width: 'max-content', maxWidth: '20rem' }}>
                      <div className="slds-popover__body">
                        [center], [left], [right] for text alignment<br/>
                        ^{'{text}'} for superscript<br/>
                        ® for registered trademark symbol
                      </div>
                    </div>
                  </div>
                </div>
                <div className="slds-form-element__control">
                  <RichTextEditor
                    value={formState.text}
                    onChange={handleTextChange}
                  />
                </div>
              </div>

              <fieldset className="slds-form-element">
                <legend className="slds-form-element__label slds-form-element__legend">Text Style</legend>
                <div className="slds-form-element_compound">
                  <div className="slds-grid slds-gutters_medium">
                    <div className="slds-col slds-size_2-of-3">
                      <div className="slds-form-element">
                        <label className="slds-form-element__label" htmlFor="fontSize">
                          Font Size: {formatSliderLabel(formState.fontSize, 'fontSize')}
                        </label>
                        <div className="slds-form-element__control">
                          <div className="slds-slider">
                            <input
                              type="range"
                              id="fontSize"
                              name="fontSize"
                              min={1}
                              max={20}
                              value={formState.fontSize}
                              onChange={handleInputChange}
                              className="slds-slider__range"
                              aria-valuemin={1}
                              aria-valuemax={20}
                              aria-valuenow={formState.fontSize}
                              aria-valuetext={`${formState.fontSize}% of image width`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="slds-col slds-size_1-of-3">
                      <div className="slds-form-element">
                        <label className="slds-form-element__label" htmlFor="fontColor">Color</label>
                        <div className="slds-form-element__control">
                          <div className="slds-color-picker_swatches">
                            <button
                              type="button"
                              className={`slds-color-picker__swatch ${formState.fontColor === '#DB011C' ? 'slds-is-selected' : ''}`}
                              aria-label="Red Color"
                              title="Red"
                              style={{ backgroundColor: '#DB011C' }}
                              onClick={() => handleColorSwatchClick('#DB011C')}
                            >
                              {formState.fontColor === '#DB011C' && 
                                <span className="slds-color-picker__swatch-check" style={{ color: '#FFFFFF' }}>
                                  <Icons.Success size="x-small" />
                                </span>
                              }
                            </button>
                            <button
                              type="button"
                              className={`slds-color-picker__swatch ${formState.fontColor === '#000000' ? 'slds-is-selected' : ''}`}
                              aria-label="Black Color"
                              title="Black"
                              style={{ backgroundColor: '#000000' }}
                              onClick={() => handleColorSwatchClick('#000000')}
                            >
                              {formState.fontColor === '#000000' && 
                                <span className="slds-color-picker__swatch-check" style={{ color: '#FFFFFF' }}>
                                  <Icons.Success size="x-small" />
                                </span>
                              }
                            </button>
                            <button
                              type="button"
                              className={`slds-color-picker__swatch ${formState.fontColor === '#FFFFFF' ? 'slds-is-selected' : ''}`}
                              aria-label="White Color"
                              title="White"
                              style={{ backgroundColor: '#FFFFFF', border: '1px solid #dddbda' }}
                              onClick={() => handleColorSwatchClick('#FFFFFF')}
                            >
                              {formState.fontColor === '#FFFFFF' && 
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

              <fieldset className="slds-form-element">
                <legend className="slds-form-element__label slds-form-element__legend">Position</legend>
                <div className="slds-form-element_compound">
                  <div className="slds-grid slds-gutters_medium">
                    <div className="slds-col">
                      <div className="slds-form-element">
                        <label className="slds-form-element__label" htmlFor="x-position">
                          X Position: {formatSliderLabel(formState.x, 'x')}
                        </label>
                        <div className="slds-form-element__control">
                          <div className="slds-slider">
                            <input
                              type="range"
                              id="x-position"
                              name="x"
                              min={0}
                              max={100}
                              value={formState.x}
                              onChange={handleInputChange}
                              className="slds-slider__range"
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={formState.x}
                              aria-valuetext={`${formState.x}% from left`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="slds-col">
                      <div className="slds-form-element">
                        <label className="slds-form-element__label" htmlFor="y-position">
                          Y Position: {formatSliderLabel(formState.y, 'y')}
                        </label>
                        <div className="slds-form-element__control">
                          <div className="slds-slider">
                            <input
                              type="range"
                              id="y-position"
                              name="y"
                              min={0}
                              max={100}
                              value={formState.y}
                              onChange={handleInputChange}
                              className="slds-slider__range"
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={formState.y}
                              aria-valuetext={`${formState.y}% from top`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </fieldset>
            </form>
          </div>
          <footer className="slds-card__footer">
            <div className="slds-grid slds-grid_align-spread">
              <div
                className="share-button-wrapper"
                style={{ position: 'relative', display: 'inline-block' }}
                onMouseEnter={() => activeImageSourceTab === 'upload' && setShowShareTooltip(true)}
                onMouseLeave={() => activeImageSourceTab === 'upload' && setShowShareTooltip(false)}
              >
                <button
                  className="slds-button slds-button_neutral"
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
                    className="slds-popover slds-popover_tooltip slds-nubbin_bottom"
                    role="tooltip"
                    id="share-tooltip"
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 12px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '280px',
                      maxWidth: '90vw',
                      background: 'var(--slds-g-color-neutral-95, #171717)',
                      color: 'var(--slds-g-color-neutral-0, #ffffff)',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.25rem',
                      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
                      fontSize: '0.8125rem',
                      lineHeight: '1.4',
                      zIndex: 7000,
                      animation: 'slds-popup-fade-in 0.1s linear',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      Uploaded image won't be shared, only text content and position settings will be shared
                      <div 
                        style={{
                          position: 'absolute',
                          bottom: '-20px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 0,
                          height: 0,
                          borderLeft: '8px solid transparent',
                          borderRight: '8px solid transparent',
                          borderTop: '8px solid var(--slds-g-color-neutral-95, #171717)'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <button
                className="slds-button slds-button_brand download-button"
                onClick={handleDownload}
                disabled={isLoading}
                aria-label="Download image with overlay"
              >
                <svg className="slds-button__icon slds-button__icon_left download-icon" aria-hidden="true">
                  <Icons.Download />
                </svg>
                {isLoading ? 'Generating...' : 'Download'}
              </button>
            </div>
          </footer>
        </article>
      </div>

      <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-col_padded">
        <article className="slds-card" aria-label="Image preview">
          <div className="slds-card__header">
            <header className="slds-media slds-media_center">
              <div className="slds-media__body">
                <h2 className="slds-card__header-title">
                  <span className="slds-text-heading_medium">Preview</span>
                </h2>
              </div>
            </header>
          </div>
          <div className="slds-card__body slds-p-around_medium">
            {isLoading ? (
              <div className="slds-illustration slds-illustration_small slds-p-around_large">
                <div className="slds-align_absolute-center">
                  <div className="slds-spinner slds-spinner_medium" role="status" aria-live="polite">
                    <span className="slds-assistive-text">Loading preview</span>
                    <div className="slds-spinner__dot-a"></div>
                    <div className="slds-spinner__dot-b"></div>
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="slds-notify slds-notify_alert slds-theme_alert-texture slds-theme_error" role="alert" aria-live="assertive">
                <span className="slds-assistive-text">Error</span>
                <h2>{error}</h2>
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
              <div className="slds-box slds-theme_shade slds-text-align_center slds-p-around_medium" role="status">
                <div className="slds-m-bottom_small">
                  <svg className="slds-icon slds-icon_large" aria-hidden="true">
                    <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#image"></use>
                  </svg>
                </div>
                <p className="slds-text-body_regular slds-text-color_weak">
                  Please enter an image URL or upload an image to see a preview
                </p>
              </div>
            ) : (
              <div className="slds-p-around_medium">
                <CanvasGenerator
                  {...formState}
                  onLoad={() => setIsLoading(false)}
                  onError={handleError}
                  onImageLoad={handleImageLoad}
                />
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
    </div>
  );
}
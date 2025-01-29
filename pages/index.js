import React, { useState, useCallback, useRef, useEffect } from 'react';
import CanvasGenerator from '../components/CanvasGenerator';

export default function Home() {
  // Move initial state to a constant
  const defaultFormData = {
    text: 'Default text',
    imageUrl: `https://image.mail.milwaukeetool.eu/lib/fe2f11717564047a761c78/m/1/44172983-64b7-47c2-828e-4141121047e8.jpg`,
    width: '600',
    height: '400',
    fontSize: '40',
    fontColor: '#FFFFFF',
    x: '10',
    y: '50',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  const [formData, setFormData] = useState(defaultFormData);

  // Add this function to generate a shareable URL
  const generateShareableUrl = useCallback(() => {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();
    Object.entries(formData).forEach(([key, value]) => {
      params.append(key, value);
    });
    return `${baseUrl}/?${params.toString()}`;
  }, [formData]);

  // Add this function to load form data from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramsData = {};
    params.forEach((value, key) => {
      if (key in defaultFormData) {
        paramsData[key] = value;
      }
    });
    
    if (Object.keys(paramsData).length > 0) {
      setFormData(prev => ({
        ...prev,
        ...paramsData
      }));
      setIsCanvasLoading(true); // Force canvas to refresh
    }
  }, []); // Empty dependency array means this runs once on mount

  // Add share button click handler
  const handleShare = useCallback(async () => {
    const shareableUrl = generateShareableUrl();
    try {
      await navigator.clipboard.writeText(shareableUrl);
      showToast('Shareable URL copied to clipboard!');
    } catch (error) {
      showToast('Failed to copy URL', 'error');
    }
  }, [generateShareableUrl]);

  const [generatedUrl, setGeneratedUrl] = useState('');
  const [isCanvasLoading, setIsCanvasLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const canvasRef = useRef(null);

  const [openSections, setOpenSections] = useState({
    textContent: true,
    imageSettings: false,
    textPosition: false
  });

  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const toggleSection = useCallback((e, section) => {
    e.preventDefault();
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    
    console.log(`Input changed: ${name} = ${value}`);

    if (name === 'fontColor') {
      const validHexColor = value.startsWith('#') ? value : `#${value}`;
      setFormData(prev => ({ ...prev, [name]: validHexColor }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  }, []);

  const handlePositionChange = useCallback((newX, newY) => {
    setFormData(prev => ({
      ...prev,
      x: newX.toString(),
      y: newY.toString()
    }));
  }, []);

  const centerVertically = useCallback(() => {
    const centerY = Math.round(parseInt(formData.height) / 2);
    setFormData(prev => ({ ...prev, y: centerY.toString() }));
  }, [formData.height]);

  const centerHorizontally = useCallback(() => {
    const centerX = Math.round(parseInt(formData.width) / 2);
    setFormData(prev => ({ ...prev, x: centerX.toString() }));
  }, [formData.width]);

  const handleGenerateImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      showToast('Canvas not available', 'error');
      return;
    }

    try {
      setIsGenerating(true);
      setShowCopySuccess(false);
      
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) {
            resolve(b);
          } else {
            reject(new Error('Failed to create image'));
          }
        }, 'image/png');
      });

      const response = await fetch('/api/save-image', {
        method: 'POST',
        body: blob
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      setGeneratedUrl(data.url);
      await navigator.clipboard.writeText(data.url);
      showToast('URL copied to clipboard!');
    } catch (error) {
      console.error('Error:', error);
      showToast(error.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div className="container">
        <h1 className="slds-text-heading_large">Image Text Overlay Generator</h1>
        
        <div className="form-container">
          <form className="slds-form">
            <div className="slds-accordion">
              <section className={`slds-accordion__section ${openSections.textContent ? 'slds-is-open' : ''}`}>
                <div className="slds-accordion__summary">
                  <h3 className="slds-accordion__summary-heading">
                    <button
                      aria-controls="accordion-text-content"
                      aria-expanded={openSections.textContent}
                      className="slds-button slds-button_reset slds-accordion__summary-action"
                      onClick={(e) => toggleSection(e, 'textContent')}
                      type="button"
                    >
                      <svg className="slds-accordion__summary-action-icon slds-button__icon slds-button__icon_left" aria-hidden="true">
                        <use xlinkHref="#chevrondown"></use>
                      </svg>
                      <span className="slds-accordion__summary-content">Text Content & Style</span>
                    </button>
                  </h3>
                </div>
                <div 
                  className="slds-accordion__content" 
                  id="accordion-text-content"
                  hidden={!openSections.textContent}
                >
                  <div className="slds-form-element">
                    <label className="slds-form-element__label" htmlFor="text">Text Content</label>
                    <div className="slds-form-element__control">
                      <input
                        className="slds-input"
                        type="text"
                        id="text"
                        name="text"
                        value={formData.text}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="slds-form-element__help" id="textHint">
                      Enter the text you want to overlay on the image
                    </div>
                  </div>
                  
                  <div className="slds-form-element">
                    <label className="slds-form-element__label" htmlFor="fontSize">Font Size</label>
                    <div className="slds-form-element__control">
                      <input
                        className="slds-input"
                        type="range"
                        id="fontSize"
                        name="fontSize"
                        min="12"
                        max="120"
                        value={formData.fontSize}
                        onChange={handleInputChange}
                      />
                      <span>{formData.fontSize}px</span>
                    </div>
                  </div>
                  
                  <div className="slds-form-element">
                    <label className="slds-form-element__label" htmlFor="fontColor">Font Color</label>
                    <div className="color-boxes">
                      <button
                        type="button"
                        className={`color-box ${formData.fontColor === '#DB011C' ? 'selected' : ''}`}
                        style={{ backgroundColor: '#DB011C' }}
                        onClick={() => handleInputChange({ target: { name: 'fontColor', value: '#DB011C' }})}
                        aria-label="Red"
                      />
                      <button
                        type="button"
                        className={`color-box ${formData.fontColor === '#000000' ? 'selected' : ''}`}
                        style={{ backgroundColor: '#000000' }}
                        onClick={() => handleInputChange({ target: { name: 'fontColor', value: '#000000' }})}
                        aria-label="Black"
                      />
                      <button
                        type="button"
                        className={`color-box ${formData.fontColor === '#FFFFFF' ? 'selected' : ''}`}
                        style={{ backgroundColor: '#FFFFFF' }}
                        onClick={() => handleInputChange({ target: { name: 'fontColor', value: '#FFFFFF' }})}
                        aria-label="White"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className={`slds-accordion__section ${openSections.imageSettings ? 'slds-is-open' : ''}`}>
                <div className="slds-accordion__summary">
                  <h3 className="slds-accordion__summary-heading">
                    <button
                      aria-controls="accordion-image-settings"
                      aria-expanded={openSections.imageSettings}
                      className="slds-button slds-button_reset slds-accordion__summary-action"
                      onClick={(e) => toggleSection(e, 'imageSettings')}
                      type="button"
                    >
                      <svg className="slds-accordion__summary-action-icon slds-button__icon slds-button__icon_left" aria-hidden="true">
                        <use xlinkHref="#chevrondown"></use>
                      </svg>
                      <span className="slds-accordion__summary-content">Image Settings</span>
                    </button>
                  </h3>
                </div>
                <div 
                  className="slds-accordion__content" 
                  id="accordion-image-settings"
                  hidden={!openSections.imageSettings}
                >
                  <div className="slds-form-element">
                    <label className="slds-form-element__label" htmlFor="imageUrl">Image URL</label>
                    <div className="slds-form-element__control">
                      <input
                        className="slds-input"
                        type="url"
                        id="imageUrl"
                        name="imageUrl"
                        value={formData.imageUrl}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="slds-form-element__help" id="urlHint">
                      Enter a valid image URL
                    </div>
                  </div>
                  
                  <div className="slds-form-element">
                    <label className="slds-form-element__label" htmlFor="width">Width</label>
                    <div className="slds-form-element__control">
                      <input
                        className="slds-input"
                        type="number"
                        id="width"
                        name="width"
                        value={formData.width}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="slds-form-element">
                    <label className="slds-form-element__label" htmlFor="height">Height</label>
                    <div className="slds-form-element__control">
                      <input
                        className="slds-input"
                        type="number"
                        id="height"
                        name="height"
                        value={formData.height}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="slds-form-element">
                    <label className="slds-form-element__label" htmlFor="backgroundSize">Background Size</label>
                    <div className="slds-form-element__control">
                      <select
                        className="slds-select"
                        id="backgroundSize"
                        name="backgroundSize"
                        value={formData.backgroundSize}
                        onChange={handleInputChange}
                      >
                        <option value="cover">Cover (Fill)</option>
                        <option value="contain">Contain (Fit)</option>
                        <option value="100% 100%">Stretch</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="slds-form-element">
                    <label className="slds-form-element__label" htmlFor="backgroundPosition">Background Position</label>
                    <div className="slds-form-element__control">
                      <select
                        className="slds-select"
                        id="backgroundPosition"
                        name="backgroundPosition"
                        value={formData.backgroundPosition}
                        onChange={handleInputChange}
                      >
                        <option value="center">Center</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              <section className={`slds-accordion__section ${openSections.textPosition ? 'slds-is-open' : ''}`}>
                <div className="slds-accordion__summary">
                  <h3 className="slds-accordion__summary-heading">
                    <button
                      aria-controls="accordion-text-position"
                      aria-expanded={openSections.textPosition}
                      className="slds-button slds-button_reset slds-accordion__summary-action"
                      onClick={(e) => toggleSection(e, 'textPosition')}
                      type="button"
                    >
                      <svg className="slds-accordion__summary-action-icon slds-button__icon slds-button__icon_left" aria-hidden="true">
                        <use xlinkHref="#chevrondown"></use>
                      </svg>
                      <span className="slds-accordion__summary-content">Text Position</span>
                    </button>
                  </h3>
                </div>
                <div 
                  className="slds-accordion__content" 
                  id="accordion-text-position"
                  hidden={!openSections.textPosition}
                >
                  <p>Adjust the text position using the controls below:</p>
                  
                  <div className="slds-form-element">
                    <label className="slds-form-element__label" htmlFor="x">X Position</label>
                    <div className="slds-form-element__control">
                      <input
                        className="slds-input"
                        type="range"
                        id="x"
                        name="x"
                        value={formData.x}
                        onChange={handleInputChange}
                        min="0"
                        max={formData.width}
                      />
                      <span>{formData.x}px</span>
                    </div>
                  </div>
                  
                  <div className="slds-form-element">
                    <label className="slds-form-element__label" htmlFor="y">Y Position</label>
                    <div className="slds-form-element__control">
                      <input
                        className="slds-input"
                        type="range"
                        id="y"
                        name="y"
                        value={formData.y}
                        onChange={handleInputChange}
                        min="0"
                        max={formData.height}
                      />
                      <span>{formData.y}px</span>
                    </div>
                  </div>
                  
                  <div className="center-buttons-container button-row">
                    <button
                      type="button"
                      onClick={centerVertically}
                      className="btn-secondary"
                    >
                      Center Vertically
                    </button>
                    <button
                      type="button"
                      onClick={centerHorizontally}
                      className="btn-secondary"
                    >
                      Center Horizontally
                    </button>
                  </div>
                  <p className="position-display">X: {formData.x}, Y: {formData.y}</p>
                </div>
              </section>
            </div>
          </form>
        </div>

        <div className="preview-container">
          <div className={`preview-section ${isCanvasLoading || isGenerating ? 'dimmed' : ''}`}>
            {(isCanvasLoading || isGenerating) && <div className="loader"></div>}
            <CanvasGenerator
              {...formData}
              width={Number(formData.width)}
              height={Number(formData.height)}
              fontSize={Number(formData.fontSize)}
              x={Number(formData.x)}
              y={Number(formData.y)}
              onLoad={() => setIsCanvasLoading(false)}
              ref={canvasRef}
            />
          </div>

          <div className="center-buttons-container">
            <button
              onClick={handleGenerateImage}
              className={`generate-button ${isGenerating ? 'loading' : ''}`}
              disabled={isCanvasLoading || isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate URL'}
            </button>
            <button
              onClick={handleShare}
              className="share-button"
              title="Share these settings"
            >
              Share Settings
            </button>
          </div>

          {generatedUrl && (
            <div className="result" role="alert">
              <div className="result-header">
                <h2>Generated URL</h2>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(generatedUrl);
                    showToast('URL copied again!');
                  }}
                  className="copy-link-button"
                  title="Copy URL"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                  </svg>
                </button>
              </div>
              <p className="url-display">{generatedUrl}</p>
            </div>
          )}

          {toast.show && (
            <div className={`toast-notification ${toast.type}`}>
              {toast.message}
            </div>
          )}
        </div>
      </div>
      <footer className="footer">
        <svg width="180" height="48" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 48" role="img">
          <path d="M1.894 3.348 4.98 6.75v30.887a13.738 13.738 0 0 1-1.08 6.047A8.816 8.816 0 0 1 0 47.3l.163.7c8.93-1.513 13.423-6.485 13.423-14.849V0L1.894 2.97ZM40.061 29.079l.054-13.8c0-5.249-3.518-8.119-9.2-8.119-3.626 0-8.065 1.028-13.423 3.085l3.789 5.953h.215c2.923-3.41 4.817-5.521 5.737-6.386.92-.92 1.623-1.354 2.165-1.354 1.57 0 2.327 1.083 2.327 3.248v5.412a31.513 31.513 0 0 0-10.77 3.518c-3.085 1.731-4.98 4.384-4.98 7.578 0 4.383 3.356 6.657 7.415 6.657a9.754 9.754 0 0 0 8.389-4.709h.108v4.655l11.257-2v-.382c-2.6-2-3.085-2.544-3.085-3.356m-8.333-.324a4.773 4.773 0 0 1-4.059 2.219c-1.894 0-3.518-1.569-3.518-4.168 0-3.518 3.194-6.766 7.577-8.5ZM56.24 12.787h-.111l.109-6.007-11.635 2.98v.217l3.085 3.356V31.36l-3.085 1.774v1.136h16.126v-1.131l-4.435-1.779v-17q1.218-1.95 2.111-1.949c.487 0 2.76 1.028 6.711 3.03l1.353-7.523A6.143 6.143 0 0 0 63.6 7.16c-3.247 0-5.412 2.111-7.36 5.629M79.057 12.787h-.1l.109-6.007-11.642 2.98v.217l3.085 3.356V31.36l-3.085 1.774v1.136h16.133v-1.131l-4.442-1.779v-17q1.218-1.95 2.11-1.949c.487 0 2.76 1.028 6.712 3.03l1.353-7.523a6.144 6.144 0 0 0-2.869-.758c-3.247 0-5.412 2.111-7.36 5.629M113.271 29.079l.054-13.8c0-5.249-3.518-8.119-9.2-8.119-3.626 0-8.065 1.028-13.423 3.085l3.788 5.953h.217c2.923-3.41 4.817-5.521 5.737-6.386.92-.92 1.623-1.354 2.164-1.354 1.57 0 2.327 1.083 2.327 3.248v5.412a31.514 31.514 0 0 0-10.77 3.518c-3.085 1.731-4.98 4.384-4.98 7.578 0 4.383 3.356 6.657 7.415 6.657a9.754 9.754 0 0 0 8.389-4.709h.108v4.655l11.257-2v-.382c-2.6-2-3.085-2.544-3.085-3.356m-8.335-.324a4.773 4.773 0 0 1-4.059 2.219c-1.894 0-3.518-1.569-3.518-4.168 0-3.518 3.194-6.766 7.577-8.5ZM146.824 15.385c0-6.874-4.872-8.227-8.065-8.227-3.735 0-7.145 2.327-9.309 5.737h-.055l.055-6.116-11.637 2.982v.379l3.085 3.41v17.811l-3.085 1.774v1.137h14.83v-1.133l-3.139-1.778V14.303a6.312 6.312 0 0 1 4.871-2.706c2.327 0 3.9 1.625 3.9 4.925v14.839l-3.136 1.774v1.137h14.83v-1.133l-3.145-1.778ZM169.559 29.45l-9.146-.053q-3.093 0-3.092-2.373a2.922 2.922 0 0 1 .819-2 16.911 16.911 0 0 0 6.375 1.126 14.676 14.676 0 0 0 9.014-2.583 8.064 8.064 0 0 0 3.436-6.8 8.174 8.174 0 0 0-4.044-7.3h6.82V2.981h-.45l-8.384 5.455a16.667 16.667 0 0 0-6.4-1.134 14.509 14.509 0 0 0-9.013 2.61 8.124 8.124 0 0 0-3.436 6.855 8.32 8.32 0 0 0 4.89 7.7c-3.515 1.662-5.26 3.744-5.26 6.222a4.739 4.739 0 0 0 3.357 4.693c-3.515.738-5.577 2.583-5.577 4.987q0 5.813 13.851 5.827a26.165 26.165 0 0 0 11.947-2.426c3.146-1.608 4.732-3.955 4.732-7.091q0-7.119-10.441-7.223m-5.042-21.02c2.749 0 4.017 2.347 4.017 8.33 0 2.979-.317 5.115-.978 6.353a3.217 3.217 0 0 1-3.039 1.847 3.144 3.144 0 0 1-2.987-1.846c-.634-1.239-.951-3.374-.951-6.353 0-5.9 1.215-8.33 3.938-8.33m-.212 36.618c-5.63 0-8.828-2.056-8.828-5.509a3.644 3.644 0 0 1 2.22-3.507 14.1 14.1 0 0 0 1.692.106l9.04.106q4.916 0 4.916 3.559c0 3.242-3.119 5.247-9.04 5.247" />
        </svg>
      </footer>
    </>
  );
}
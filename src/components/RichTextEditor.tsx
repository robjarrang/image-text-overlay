import { useState, useRef, useEffect } from 'react';
import { Icons } from './Icons';

// Common font sizes in pixels
const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 112, 128, 160, 192, 248];

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  fontSize?: number; // Font size in pixels
  onFontSizeChange?: (size: number) => void;
  minFontSize?: number;
  maxFontSize?: number;
}

export function RichTextEditor({ value, onChange, fontSize, onFontSizeChange, minFontSize = 12, maxFontSize = 248 }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [showFontSizeDropdown, setShowFontSizeDropdown] = useState<boolean>(false);
  const fontSizeDropdownRef = useRef<HTMLDivElement>(null);

  // Filter font sizes based on min/max
  const availableFontSizes = FONT_SIZE_OPTIONS.filter(size => size >= minFontSize && size <= maxFontSize);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fontSizeDropdownRef.current && !fontSizeDropdownRef.current.contains(event.target as Node)) {
        setShowFontSizeDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add this function to handle block alignment
  const handleBlockAlignment = (alignment: 'left' | 'center' | 'right') => {
    if (!textareaRef.current) return;
    
    setActiveButton(alignment);
    setTimeout(() => setActiveButton(null), 300);
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = value;
    
    // Find the start of the first line in selection
    let lineStart = start;
    while (lineStart > 0 && text[lineStart - 1] !== '\n') {
      lineStart--;
    }
    
    // Check if there's already an alignment tag at the beginning of this block
    const beforeSelection = text.substring(0, lineStart);
    const afterLineStart = text.substring(lineStart);
    
    // Remove any existing alignment tag at the current position
    const cleanedAfter = afterLineStart.replace(/^\[(left|center|right)\]/, '');
    
    // Add the new alignment tag
    const newText = beforeSelection + `[${alignment}]` + cleanedAfter;
    
    onChange(newText);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      const offset = `[${alignment}]`.length;
      textarea.selectionStart = start + offset;
      textarea.selectionEnd = end + offset;
    }, 0);
  };

  // Function to handle superscript
  const handleSuperscriptClick = () => {
    if (!textareaRef.current) return;
    
    setActiveButton('super');
    setTimeout(() => setActiveButton(null), 300);
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    if (selectedText) {
      const newText = `^{${selectedText}}`;
      const newValue = value.substring(0, start) + newText + value.substring(end);
      onChange(newValue);
      
      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = start + 2; // +2 for ^{
        textarea.selectionEnd = start + 2 + selectedText.length;
      }, 0);
    }
  };

  // Function to insert symbol at cursor
  const handleSymbolClick = (symbol: string, buttonId: string) => {
    if (!textareaRef.current) return;
    
    setActiveButton(buttonId);
    setTimeout(() => setActiveButton(null), 300);
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // Automatically superscript the ® symbol
    const symbolToInsert = symbol === '®' ? `^{${symbol}}` : symbol;
    
    // Insert the symbol
    const newValue = value.substring(0, start) + symbolToInsert + value.substring(end);
    onChange(newValue);
    
    // Place cursor after the inserted symbol
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + symbolToInsert.length;
      textarea.selectionEnd = start + symbolToInsert.length;
    }, 0);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Arrow key navigation for toolbar buttons
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (document.activeElement?.getAttribute('role') === 'toolbar') {
        const buttons = Array.from(document.querySelectorAll('[role="toolbar"] button'));
        const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
        let newIndex;
        
        if (e.key === 'ArrowLeft') {
          newIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1;
        } else {
          newIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0;
        }
        
        (buttons[newIndex] as HTMLButtonElement).focus();
        e.preventDefault();
      }
    }
  };

  // Apply syntax highlighting to the textarea
  useEffect(() => {
    if (!textareaRef.current) return;
    
    // Update textarea display classes based on content
    const highlightSyntax = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      
      // We're adding a class to the textarea that will enable our syntax highlighting CSS
      textarea.classList.add('syntax-highlighted');
      
      // Make sure textarea has the most current value
      textarea.value = value;
    };
    
    highlightSyntax();
  }, [value]);

  // Create ripple effect 
  const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    
    const rect = button.getBoundingClientRect();
    
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - rect.left - radius}px`;
    circle.style.top = `${event.clientY - rect.top - radius}px`;
    circle.classList.add('ripple');
    
    // Remove existing ripples
    const ripple = button.querySelector('.ripple');
    if (ripple) {
      ripple.remove();
    }
    
    button.appendChild(circle);
    
    // Clean up the ripple element after animation completes
    setTimeout(() => {
      if (circle) {
        circle.remove();
      }
    }, 600);
  };

  return (
    <div className="slds-form-element editor-component">
      {/* Toolbar */}
      <div className="slds-grid slds-grid_vertical-align-center slds-m-bottom_small">
        <div 
          className="slds-button-group" 
          role="toolbar" 
          aria-label="Text formatting controls"
          onKeyDown={handleKeyDown}
          style={{
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
          }}
        >
          <button
            className={`slds-button slds-button_icon slds-button_icon-border-filled ${activeButton === 'left' ? 'button-flash' : ''}`}
            onClick={(e) => { 
              createRipple(e);
              handleBlockAlignment('left');
            }}
            type="button"
            aria-label="Align text left"
            title="Align Left"
            style={{
              position: 'relative',
              overflow: 'hidden',
              transitionProperty: 'transform, background-color',
              transitionDuration: '0.2s',
              transitionTimingFunction: 'ease'
            }}
          >
            <Icons.AlignLeft />
            <span className="slds-assistive-text">Align text left</span>
          </button>
          <button
            className={`slds-button slds-button_icon slds-button_icon-border-filled ${activeButton === 'center' ? 'button-flash' : ''}`}
            onClick={(e) => {
              createRipple(e);
              handleBlockAlignment('center');
            }}
            type="button"
            aria-label="Align text center"
            title="Center"
            style={{
              position: 'relative',
              overflow: 'hidden',
              transitionProperty: 'transform, background-color',
              transitionDuration: '0.2s',
              transitionTimingFunction: 'ease'
            }}
          >
            <Icons.AlignCenter />
            <span className="slds-assistive-text">Align text center</span>
          </button>
          <button
            className={`slds-button slds-button_icon slds-button_icon-border-filled ${activeButton === 'right' ? 'button-flash' : ''}`}
            onClick={(e) => {
              createRipple(e);
              handleBlockAlignment('right');
            }}
            type="button"
            aria-label="Align text right"
            title="Align Right"
            style={{
              position: 'relative',
              overflow: 'hidden',
              transitionProperty: 'transform, background-color',
              transitionDuration: '0.2s',
              transitionTimingFunction: 'ease'
            }}
          >
            <Icons.AlignRight />
            <span className="slds-assistive-text">Align text right</span>
          </button>
          <button
            className={`slds-button slds-button_icon slds-button_icon-border-filled superscript-button ${activeButton === 'super' ? 'button-flash' : ''}`}
            onClick={(e) => {
              createRipple(e);
              handleSuperscriptClick();
            }}
            type="button"
            aria-label="Format text as superscript"
            title="Superscript"
            style={{
              position: 'relative',
              overflow: 'hidden',
              transitionProperty: 'transform, background-color',
              transitionDuration: '0.2s',
              transitionTimingFunction: 'ease'
            }}
          >
            <svg className="slds-button__icon superscript-icon" aria-hidden="true">
              <Icons.Formula />
            </svg>
            <span className="slds-assistive-text">Format text as superscript</span>
          </button>
          <button
            className={`slds-button slds-button_icon slds-button_icon-border-filled formatting-button ${activeButton === 'reg' ? 'button-flash' : ''}`}
            onClick={(e) => {
              createRipple(e);
              handleSymbolClick('®', 'reg');
            }}
            type="button"
            aria-label="Insert Registered Trademark symbol"
            title="Insert ®"
            style={{
              position: 'relative',
              overflow: 'hidden',
              transitionProperty: 'transform, background-color',
              transitionDuration: '0.2s',
              transitionTimingFunction: 'ease'
            }}
          >
            <span className="slds-icon-text-default" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>®</span>
            <span className="slds-assistive-text">Insert Registered Trademark symbol</span>
          </button>
          <button
            className={`slds-button slds-button_icon slds-button_icon-border-filled formatting-button ${activeButton === 'tm' ? 'button-flash' : ''}`}
            onClick={(e) => {
              createRipple(e);
              handleSymbolClick('™', 'tm');
            }}
            type="button"
            aria-label="Insert Trademark symbol"
            title="Insert ™"
            style={{
              position: 'relative',
              overflow: 'hidden',
              transitionProperty: 'transform, background-color',
              transitionDuration: '0.2s',
              transitionTimingFunction: 'ease'
            }}
          >
            <span className="slds-icon-text-default" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>™</span>
            <span className="slds-assistive-text">Insert Trademark symbol</span>
          </button>
        </div>
        
        {/* Font Size Dropdown */}
        {fontSize !== undefined && onFontSizeChange && (
          <div 
            ref={fontSizeDropdownRef}
            className={`slds-dropdown-trigger slds-dropdown-trigger_click slds-m-left_x-small ${showFontSizeDropdown ? 'slds-is-open' : ''}`}
            style={{ position: 'relative', display: 'inline-block' }}
          >
            <button
              type="button"
              className="slds-button slds-button_neutral"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowFontSizeDropdown(!showFontSizeDropdown);
              }}
              aria-haspopup="listbox"
              aria-expanded={showFontSizeDropdown}
              title="Font Size"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '0 8px',
                minWidth: '70px',
                height: '32px',
                borderRadius: '4px',
                fontSize: '0.8125rem',
                fontWeight: 500
              }}
            >
              <span>{fontSize}px</span>
              <svg className="slds-button__icon slds-button__icon_x-small" aria-hidden="true" style={{ marginLeft: '2px' }}>
                <use xlinkHref="/assets/icons/utility-sprite/svg/symbols.svg#chevrondown"></use>
              </svg>
            </button>
            {showFontSizeDropdown && (
              <div 
                className="slds-dropdown slds-dropdown_left"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  zIndex: 9999,
                  minWidth: '90px',
                  maxHeight: '250px',
                  overflowY: 'auto',
                  backgroundColor: 'white',
                  border: '1px solid #dddbda',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.16)',
                  display: 'block'
                }}
              >
                <ul className="slds-dropdown__list" role="listbox" style={{ margin: 0, padding: 0 }}>
                  {availableFontSizes.map((size) => (
                    <li 
                      key={size} 
                      className="slds-dropdown__item" 
                      role="presentation"
                      style={{ listStyle: 'none' }}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={fontSize === size}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onFontSizeChange(size);
                          setShowFontSizeDropdown(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          background: fontSize === size ? '#f3f2f2' : 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '0.8125rem',
                          display: 'block'
                        }}
                      >
                        {size}px
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {/* Help button */}
        <div className="slds-m-left_small">
          <button 
            className={`slds-button slds-button_icon slds-button_icon-border-filled ${showHelp ? 'slds-is-selected' : ''}`}
            onClick={() => setShowHelp(!showHelp)}
            aria-label="Formatting help"
            title="Formatting Help"
            style={{
              position: 'relative',
              overflow: 'hidden',
              transition: 'background-color 0.2s ease'
            }}
          >
            <Icons.Help />
            <span className="slds-assistive-text">Formatting help</span>
          </button>
        </div>
      </div>
      
      {/* Help panel */}
      <div 
        className={`slds-box slds-theme_shade slds-m-bottom_small formatting-help ${showHelp ? 'help-panel-visible' : 'help-panel-hidden'}`}
        style={{
          borderRadius: '8px',
          overflow: 'hidden',
          maxHeight: showHelp ? '500px' : '0',
          opacity: showHelp ? 1 : 0,
          transition: 'max-height 0.3s ease-in-out, opacity 0.2s ease-in-out, margin 0.2s ease-in-out',
          margin: showHelp ? '0 0 1rem 0' : '0',
          padding: showHelp ? '1rem' : '0 1rem'
        }}
      >
        <div className="slds-text-heading_small slds-m-bottom_xx-small">Formatting Help</div>
        <div className="slds-grid slds-wrap">
          <div className="slds-col slds-size_1-of-2 slds-p-right_small">
            <h3 className="slds-text-heading_small">Text Alignment</h3>
            <ul className="slds-list_dotted">
              <li>
                <code className="syntax-tag alignment-tag">[left]</code> - Aligns text to the left
              </li>
              <li>
                <code className="syntax-tag alignment-tag">[center]</code> - Centers the text
              </li>
              <li>
                <code className="syntax-tag alignment-tag">[right]</code> - Aligns text to the right
              </li>
            </ul>
          </div>
          <div className="slds-col slds-size_1-of-2">
            <h3 className="slds-text-heading_small">Text Formatting</h3>
            <ul className="slds-list_dotted">
              <li>
                <code className="syntax-tag superscript-tag">^{'{text}'}</code> - Makes text superscript
              </li>
              <li>
                <code>®</code> - Registered trademark symbol
              </li>
              <li>
                <code>™</code> - Trademark symbol
              </li>
            </ul>
          </div>
        </div>
        <div className="slds-m-top_small">
          <p className="slds-text-body_small">
            <strong>Tip:</strong> Alignment tags apply to the current line and all following lines until a new alignment is set. 
            For example, adding [center] once will center all subsequent lines.
          </p>
          <div className="slds-box slds-theme_shade slds-m-top_x-small">
            <p className="slds-text-body_small slds-m-bottom_x-small"><strong>Example:</strong></p>
            <pre className="slds-text-body_small" style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.05)', padding: '0.5rem', borderRadius: '4px' }}>
[center]This line is centered
This is also centered
Still centered
[left]Now back to left
This stays left
            </pre>
          </div>
        </div>
      </div>
      
      {/* Text area with syntax highlighting - Modified structure for proper focus handling */}
      <div className="rich-text-editor-container">
        <div className="slds-form-element__control rich-text-editor-wrapper">
          <textarea
            ref={textareaRef}
            id="textInput"
            className="slds-textarea syntax-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            rows={4}
            placeholder="Enter text here. Use the buttons above to format text."
            aria-label="Text content"
            aria-describedby="textInputHelp"
            style={{ borderRadius: '8px', overflow: 'hidden' }}
          />
        </div>
        {/* Help text moved outside the rich-text-editor-wrapper for proper focus handling */}
        <div className="slds-form-element__help help-text-container" id="textInputHelp">
          Select text and use the formatting buttons above to apply alignment or superscript formatting
        </div>
      </div>
    </div>
  );
}
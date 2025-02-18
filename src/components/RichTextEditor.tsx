import { Icons } from './Icons';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {  
  const handleAlignmentClick = (alignment: 'left' | 'center' | 'right') => {
    const textarea = document.querySelector('#textInput') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    if (selectedText) {
      const newText = `[${alignment}]${selectedText}`;
      const newValue = value.substring(0, start) + newText + value.substring(end);
      onChange(newValue);
      
      // Restore cursor position after the inserted text
      setTimeout(() => {
        textarea.selectionStart = start + alignment.length + 2;
        textarea.selectionEnd = start + alignment.length + 2 + selectedText.length;
        textarea.focus();
      }, 0);
    }
  };

  const handleSuperscriptClick = () => {
    const textarea = document.querySelector('#textInput') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    if (selectedText) {
      const newText = `^{${selectedText}}`;
      const newValue = value.substring(0, start) + newText + value.substring(end);
      onChange(newValue);
      
      // Restore cursor position after the inserted text
      setTimeout(() => {
        textarea.selectionStart = start + 2;
        textarea.selectionEnd = start + 2 + selectedText.length;
        textarea.focus();
      }, 0);
    }
  };

  const handleRegisteredTrademarkClick = () => {
    const textarea = document.querySelector('#textInput') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const registeredSymbol = '®';
    
    // Insert the symbol at cursor position
    const newValue = value.substring(0, start) + registeredSymbol + value.substring(end);
    onChange(newValue);
    
    // Place cursor after the inserted symbol
    setTimeout(() => {
      textarea.selectionStart = start + 1;
      textarea.selectionEnd = start + 1;
      textarea.focus();
    }, 0);
  };

  // Handler for keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
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

  return (
    <div className="slds-form-element">
      <div className="slds-m-bottom_small">
        <div 
          className="slds-button-group" 
          role="toolbar" 
          aria-label="Text formatting controls"
          onKeyDown={handleKeyDown}
        >
          <button
            className="slds-button slds-button_icon slds-button_icon-border-filled"
            onClick={() => handleAlignmentClick('left')}
            type="button"
            aria-label="Align text left"
            title="Align Left"
          >
            <Icons.AlignLeft />
            <span className="slds-assistive-text">Align text left</span>
          </button>
          <button
            className="slds-button slds-button_icon slds-button_icon-border-filled"
            onClick={() => handleAlignmentClick('center')}
            type="button"
            aria-label="Align text center"
            title="Center"
          >
            <Icons.AlignCenter />
            <span className="slds-assistive-text">Align text center</span>
          </button>
          <button
            className="slds-button slds-button_icon slds-button_icon-border-filled"
            onClick={() => handleAlignmentClick('right')}
            type="button"
            aria-label="Align text right"
            title="Align Right"
          >
            <Icons.AlignRight />
            <span className="slds-assistive-text">Align text right</span>
          </button>
          <button
            className="slds-button slds-button_icon slds-button_icon-border-filled superscript-button"
            onClick={handleSuperscriptClick}
            type="button"
            aria-label="Format text as superscript"
            title="Superscript"
          >
            <svg className="slds-button__icon superscript-icon" aria-hidden="true">
              <Icons.Formula />
            </svg>
            <span className="slds-assistive-text">Format text as superscript</span>
          </button>
          <button
            className="slds-button slds-button_icon slds-button_icon-border-filled formatting-button"
            onClick={handleRegisteredTrademarkClick}
            type="button"
            aria-label="Insert Registered Trademark symbol"
            title="Insert ®"
          >
            <span className="slds-icon-text-default" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>®</span>
            <span className="slds-assistive-text">Insert Registered Trademark symbol</span>
          </button>
        </div>
      </div>
      <div className="slds-form-element__control">
        <textarea
          id="textInput"
          className="slds-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder="Enter text here. Use the buttons above to format text."
          aria-label="Text content"
          aria-describedby="textInputHelp"
        />
        <div className="slds-form-element__help" id="textInputHelp">
          Select text and use the formatting buttons above to apply alignment or superscript formatting
        </div>
      </div>
    </div>
  );
}
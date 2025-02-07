import React, { useState, useEffect, useRef } from 'react';
import { AlignLeftIcon, AlignCenterIcon, AlignRightIcon, SuperscriptIcon } from './Icons';

interface RichTextEditorProps {
  value: string;
  onChange: (text: string) => void;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('left');
  const [isSuperscript, setIsSuperscript] = useState(false);

  // Convert the stored format to HTML for display
  const convertToHtml = (text: string): string => {
    const lines = text.split('\\n');
    return lines.map(line => {
      let content = line;
      let lineAlignment = 'left';

      if (line.startsWith('[center]')) {
        content = line.substring(8);
        lineAlignment = 'center';
      } else if (line.startsWith('[right]')) {
        content = line.substring(7);
        lineAlignment = 'right';
      } else if (line.startsWith('[left]')) {
        content = line.substring(6);
        lineAlignment = 'left';
      }

      content = content.replace(/\^{([^}]+)}/g, '<span class="superscript">$1</span>');
      return `<div style="text-align: ${lineAlignment}">${content}</div>`;
    }).join('');
  };

  const convertFromHtml = (html: string, forcedAlignment?: 'left' | 'center' | 'right'): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const lines = Array.from(tempDiv.children).map(child => {
      let content = child.innerHTML;
      content = content.replace(/<span class="superscript">([^<]+)<\/span>/g, '^{$1}');
      
      const currentAlignment = forcedAlignment || (child as HTMLElement).style.textAlign || alignment;
      
      if (currentAlignment === 'center') return `[center]${content}`;
      if (currentAlignment === 'right') return `[right]${content}`;
      return `[left]${content}`;
    });

    return lines.join('\\n');
  };

  useEffect(() => {
    // Only update content if value exists and has changed
    if (value && editorRef.current) {
      const htmlContent = convertToHtml(value);
      if (editorRef.current.innerHTML !== htmlContent) {
        editorRef.current.innerHTML = htmlContent;
      }
      
      // Update alignment based on the first line
      const firstLine = value.split('\\n')[0];
      if (firstLine.startsWith('[center]')) {
        setAlignment('center');
      } else if (firstLine.startsWith('[right]')) {
        setAlignment('right');
      } else if (firstLine.startsWith('[left]')) {
        setAlignment('left');
      }
    }
  }, [value]);

  const handleAlignmentChange = (newAlignment: 'left' | 'center' | 'right') => {
    setAlignment(newAlignment);
    
    if (editorRef.current) {
      Array.from(editorRef.current.children).forEach(child => {
        (child as HTMLElement).style.textAlign = newAlignment;
      });
      
      onChange(convertFromHtml(editorRef.current.innerHTML, newAlignment));
    }
  };

  const toggleSuperscript = () => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || !selection.toString()) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    
    const parentNode = range.commonAncestorContainer.parentNode;
    if (parentNode instanceof HTMLElement && parentNode.classList.contains('superscript')) {
      const text = parentNode.textContent || '';
      const textNode = document.createTextNode(text);
      parentNode.parentNode?.replaceChild(textNode, parentNode);
      setIsSuperscript(false);
    } else {
      const superscriptSpan = document.createElement('span');
      superscriptSpan.className = 'superscript';
      range.surroundContents(superscriptSpan);
      setIsSuperscript(true);
    }
    
    onChange(convertFromHtml(editorRef.current.innerHTML));
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (editorRef.current) {
      // Ensure there's always at least one div
      if (!editorRef.current.children.length) {
        editorRef.current.innerHTML = `<div style="text-align: ${alignment}"><br></div>`;
      }
      
      // Make sure every top-level node is a div with alignment
      Array.from(editorRef.current.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          const wrapper = document.createElement('div');
          wrapper.style.textAlign = alignment;
          node.parentNode?.insertBefore(wrapper, node);
          wrapper.appendChild(node);
        } else if (node instanceof HTMLElement && node.tagName !== 'DIV') {
          const wrapper = document.createElement('div');
          wrapper.style.textAlign = alignment;
          node.parentNode?.insertBefore(wrapper, node);
          wrapper.appendChild(node);
        }
      });

      onChange(convertFromHtml(editorRef.current.innerHTML));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertHTML', false, `<div style="text-align: ${alignment}"><br></div>`);
    }
  };

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar">
        <div className="button-group">
          <button
            type="button"
            className={`icon-button ${alignment === 'left' ? 'active' : ''}`}
            onClick={() => handleAlignmentChange('left')}
            title="Left Align"
          >
            <AlignLeftIcon />
          </button>
          <button
            type="button"
            className={`icon-button ${alignment === 'center' ? 'active' : ''}`}
            onClick={() => handleAlignmentChange('center')}
            title="Center Align"
          >
            <AlignCenterIcon />
          </button>
          <button
            type="button"
            className={`icon-button ${alignment === 'right' ? 'active' : ''}`}
            onClick={() => handleAlignmentChange('right')}
            title="Right Align"
          >
            <AlignRightIcon />
          </button>
          <div className="toolbar-divider" />
          <button
            type="button"
            className={`icon-button ${isSuperscript ? 'active' : ''}`}
            onClick={toggleSuperscript}
            title="Toggle Superscript"
          >
            <SuperscriptIcon />
          </button>
        </div>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className="rich-text-content"
        tabIndex={0}
        suppressContentEditableWarning={true}
        spellCheck={false}
      />
    </div>
  );
};

export default RichTextEditor;
interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  assistiveText?: string;
}

export function LoadingSpinner({ size = 'medium', assistiveText = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="loading-spinner-wrapper" role="status">
      <div className={`slds-spinner slds-spinner_${size}`} aria-hidden="true">
        <div className="slds-spinner__dot-a"></div>
        <div className="slds-spinner__dot-b"></div>
      </div>
      <span className="slds-assistive-text">{assistiveText}</span>
    </div>
  );
}
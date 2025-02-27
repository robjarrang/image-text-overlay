interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  assistiveText?: string;
  variant?: 'primary' | 'secondary' | 'white';
  className?: string;
}

export function LoadingSpinner({
  size = 'medium',
  assistiveText = 'Loading...',
  variant = 'primary',
  className = ''
}: LoadingSpinnerProps) {
  // Map size to pixel values for styling
  const sizeMap = {
    small: '1.25rem',
    medium: '2rem',
    large: '3rem'
  };
  
  // Determine colors based on variant
  const getColor = () => {
    switch (variant) {
      case 'secondary':
        return 'var(--color-secondary)';
      case 'white':
        return '#ffffff';
      case 'primary':
      default:
        return 'var(--color-primary)';
    }
  };

  return (
    <div className={`loading-spinner-wrapper flex flex-col items-center ${className}`} role="status">
      <div 
        className={`modern-spinner`} 
        aria-hidden="true"
        style={{
          width: sizeMap[size],
          height: sizeMap[size],
          borderColor: `${getColor()} transparent transparent transparent`
        }}
      ></div>
      {assistiveText && <span className="slds-assistive-text">{assistiveText}</span>}
      <style jsx>{`
        .modern-spinner {
          display: inline-block;
          border-width: 2px;
          border-style: solid;
          border-radius: 50%;
          animation: spinner 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        }
        
        @keyframes spinner {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
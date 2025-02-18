import { useEffect, useState } from 'react';

interface StatusManagerProps {
  messages: string[];
}

export function StatusManager({ messages }: StatusManagerProps) {
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      setAnnouncement(latestMessage);
      
      // Clear announcement after 3 seconds
      const timer = setTimeout(() => {
        setAnnouncement('');
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [messages]);

  return (
    <div 
      className="slds-assistive-text" 
      role="status" 
      aria-live="polite"
      aria-atomic="true"
    >
      {announcement}
    </div>
  );
}
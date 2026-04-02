'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

interface TickerTextProps {
  text: string;
  className?: string;
}

export function TickerText({ text, className }: TickerTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState<number | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (container && textEl) {
      const overflow = textEl.scrollWidth - container.clientWidth;
      setOffset(overflow > 2 ? -overflow - 12 : null);
    }
  }, []);

  useEffect(() => {
    measure();
  }, [text, measure]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <span
      ref={containerRef}
      className={`ticker-scroll ${className || ''}`}
      style={offset !== null ? { '--ticker-offset': `${offset}px` } as React.CSSProperties : undefined}
    >
      <span ref={textRef} className="ticker-scroll-text">
        {text}
      </span>
    </span>
  );
}

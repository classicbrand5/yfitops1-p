// src/components/layout/SplitLayout.tsx
// Resizable split pane — pointer events, no library
import React, { useRef, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';

interface SplitLayoutProps {
  top: React.ReactNode;
  bottom: React.ReactNode;
  direction?: 'horizontal' | 'vertical';
}

export function SplitLayout({ top, bottom, direction = 'horizontal' }: SplitLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const { splitRatio, setSplitRatio } = useAppStore();

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDragging.current = true;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (direction === 'horizontal') {
      const ratio = (e.clientY - rect.top) / rect.height;
      setSplitRatio(ratio);
    } else {
      const ratio = (e.clientX - rect.left) / rect.width;
      setSplitRatio(ratio);
    }
  }, [direction, setSplitRatio]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const topSize = `${splitRatio * 100}%`;
  const bottomSize = `${(1 - splitRatio) * 100}%`;

  if (direction === 'horizontal') {
    return (
      <div
        ref={containerRef}
        className="flex flex-col w-full h-full overflow-hidden"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div style={{ height: topSize, minHeight: 100, overflow: 'hidden' }}>
          {top}
        </div>

        {/* Divider */}
        <div
          className="flex-shrink-0 flex items-center justify-center cursor-row-resize group"
          style={{ height: 6, background: 'var(--bg-void)', position: 'relative', zIndex: 1 }}
          onPointerDown={handlePointerDown}
          role="separator"
          aria-label="Resize panels"
          aria-orientation="horizontal"
        >
          <div
            className="w-12 h-0.5 rounded-full transition-all group-hover:opacity-80"
            style={{ background: 'var(--border-strong)' }}
            aria-hidden="true"
          />
        </div>

        <div style={{ height: bottomSize, minHeight: 80, overflow: 'hidden' }}>
          {bottom}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex w-full h-full overflow-hidden"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div style={{ width: topSize, minWidth: 200, overflow: 'hidden' }}>
        {top}
      </div>

      {/* Divider */}
      <div
        className="flex-shrink-0 flex items-center justify-center cursor-col-resize group"
        style={{ width: 6, background: 'var(--bg-void)', position: 'relative', zIndex: 1 }}
        onPointerDown={handlePointerDown}
        role="separator"
        aria-label="Resize panels"
        aria-orientation="vertical"
      >
        <div
          className="h-12 w-0.5 rounded-full transition-all group-hover:opacity-80"
          style={{ background: 'var(--border-strong)' }}
          aria-hidden="true"
        />
      </div>

      <div style={{ width: bottomSize, minWidth: 200, overflow: 'hidden' }}>
        {bottom}
      </div>
    </div>
  );
}

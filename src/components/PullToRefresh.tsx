import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
}

export default function PullToRefresh({ onRefresh, children, disabled = false }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    // Check if we are at the very top of the scroll container
    const isAtTop = window.scrollY === 0;
    if (isAtTop) {
      touchStartY.current = e.touches[0].pageY;
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || disabled || isRefreshing) return;

    const currentY = e.touches[0].pageY;
    const deltaY = currentY - touchStartY.current;

    if (deltaY > 0 && window.scrollY === 0) {
      // Apply exponential resistance to make the pull feel organic and heavy
      const resistance = 0.35;
      const distance = Math.min(deltaY * resistance, 80);
      setPullDistance(distance);
      
      // Prevent browser default pull-to-refresh/scroll bouncing
      if (e.cancelable) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
      setIsDragging(false);
    }
  };

  const handleTouchEnd = async () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (pullDistance >= 55) {
      // Trigger refresh
      setIsRefreshing(true);
      setPullDistance(50); // Keep indicator visible at 50px
      try {
        await onRefresh();
      } catch (err) {
        console.error('[PullToRefresh] Refresh failed:', err);
      } finally {
        // Smooth snap back
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Reset indicator
      setPullDistance(0);
    }
  };

  return (
    <div 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full min-h-full"
    >
      {/* Pull indicator */}
      <div 
        className="absolute left-0 right-0 flex items-center justify-center pointer-events-none transition-all duration-150 ease-out z-40"
        style={{ 
          height: '40px',
          top: `${pullDistance - 40}px`,
          opacity: pullDistance > 15 ? Math.min((pullDistance - 15) / 30, 1) : 0,
          transform: `scale(${pullDistance > 20 ? Math.min((pullDistance - 20) / 40 + 0.6, 1) : 0.6})`
        }}
      >
        <div className="bg-white text-slate-800 rounded-full p-2 shadow-lg border border-slate-100 flex items-center justify-center">
          {isRefreshing ? (
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          ) : (
            <ArrowDown 
              className="w-5 h-5 text-slate-500 transition-transform duration-200" 
              style={{ transform: `rotate(${pullDistance >= 55 ? '180deg' : '0deg'})` }}
            />
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div 
        className="transition-transform duration-150 ease-out"
        style={{ 
          transform: pullDistance > 0 ? `translate3d(0, ${pullDistance}px, 0)` : 'none' 
        }}
      >
        {children}
      </div>
    </div>
  );
}

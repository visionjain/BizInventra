'use client';

import { useEffect, useRef, useState, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const threshold = 80; // Distance needed to trigger refresh

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartY = 0;
    let isAtTop = false;

    const handleTouchStart = (e: TouchEvent) => {
      // Only allow pull-to-refresh when scrolled to top
      if (container.scrollTop === 0) {
        isAtTop = true;
        touchStartY = e.touches[0].clientY;
        startY.current = touchStartY;
      } else {
        isAtTop = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isAtTop || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const distance = currentY - touchStartY;

      // Only pull down (positive distance) and when at top
      if (distance > 0 && container.scrollTop === 0) {
        setIsPulling(true);
        // Apply resistance - the further you pull, the harder it gets
        const adjustedDistance = Math.min(distance * 0.5, threshold * 1.5);
        setPullDistance(adjustedDistance);
        
        // Prevent default scroll behavior when pulling
        if (distance > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling) return;

      setIsPulling(false);

      if (pullDistance >= threshold) {
        // Trigger refresh
        setIsRefreshing(true);
        setPullDistance(threshold); // Lock at threshold while refreshing
        
        try {
          await onRefresh();
        } catch (error) {
          console.error('Refresh failed:', error);
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        // Reset if didn't reach threshold
        setPullDistance(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling, pullDistance, isRefreshing, onRefresh]);

  const getRotation = () => {
    // Rotate icon based on pull distance
    return Math.min((pullDistance / threshold) * 360, 360);
  };

  const getOpacity = () => {
    return Math.min(pullDistance / threshold, 1);
  };

  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      {/* Pull indicator */}
      <div
        className="fixed left-0 right-0 flex justify-center items-center transition-all duration-200 z-50"
        style={{
          top: `calc(${pullDistance}px + env(safe-area-inset-top))`,
          opacity: getOpacity(),
          pointerEvents: 'none'
        }}
      >
        <div className={`bg-white rounded-full p-3 shadow-lg flex items-center justify-center ${
          isRefreshing ? 'animate-pulse' : ''
        }`}>
          <RefreshCw 
            className={`w-6 h-6 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-gray-600'}`}
            style={{
              transform: isRefreshing ? 'none' : `rotate(${getRotation()}deg)`,
              transition: isRefreshing ? 'none' : 'transform 0.1s ease-out'
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: `translateY(${pullDistance * 0.3}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  );
}

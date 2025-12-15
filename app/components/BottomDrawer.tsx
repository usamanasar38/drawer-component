"use client";

import { useEffect, useRef, useState } from "react";

interface BottomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

export default function BottomDrawer({
  isOpen,
  onClose,
  children,
}: BottomDrawerProps) {
  const [internalHeightPx, setInternalHeightPx] = useState(256);
  const [isDragging, setIsDragging] = useState(false);
  const [gestureState, setGestureState] = useState<"unknown" | "vertical" | "horizontal">("unknown");
  const [isContentScrollable, setIsContentScrollable] = useState(true);
  const drawerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startHeightPxRef = useRef(256);
  const startScrollTopRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  
  // Reset height to 256px when drawer is not open
  const heightPx = isOpen ? internalHeightPx : 256;

  // Snap points in pixels
  const SNAP_POINT_1 = 256; // First snap point: 256px
  const getSnapPoint2 = () => window.innerHeight * 0.8; // Second snap point: 80vh
  const getSnapPoint3 = () => window.innerHeight; // Third snap point: 100vh
  
  const CLOSE_THRESHOLD_PX = 200; // Close if dragged below 200px
  const SNAP_THRESHOLD_PX = 50; // Minimum distance in pixels to trigger snap
  const GESTURE_THRESHOLD = 10; // pixels to determine gesture direction
  
  // Check if we're at the first/default snap point
  const isAtFirstSnapPoint = Math.abs(heightPx - SNAP_POINT_1) < 10;

  const getClosestSnapPoint = (currentHeightPx: number, direction: number) => {
    if (currentHeightPx < CLOSE_THRESHOLD_PX) {
      return null;
    }

    const snapPoints = [SNAP_POINT_1, getSnapPoint2(), getSnapPoint3()];

    if (direction < 0) {
      const lowerSnapPoints = snapPoints.filter((point) => point < currentHeightPx - 10);
      if (lowerSnapPoints.length > 0) {
        return lowerSnapPoints[lowerSnapPoints.length - 1];
      }
    } else if (direction > 0) {
      const higherSnapPoints = snapPoints.filter((point) => point > currentHeightPx + 10);
      if (higherSnapPoints.length > 0) {
        return higherSnapPoints[0];
      }
    }

    return snapPoints.reduce((prev, curr) =>
      Math.abs(curr - currentHeightPx) < Math.abs(prev - currentHeightPx)
        ? curr
        : prev
    );
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const isHandleArea = target.closest(".drawer-handle") || target.closest(".drawer-header");
    const isContentArea = target.closest(".drawer-content");
    
    // Handle area always allows dragging
    if (isHandleArea) {
      e.preventDefault();
      pointerIdRef.current = e.pointerId;
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      startHeightPxRef.current = heightPx;
      startScrollTopRef.current = contentRef.current?.scrollTop || 0;
      setGestureState("unknown");
      
      if (drawerRef.current) {
        drawerRef.current.setPointerCapture(e.pointerId);
      }
      return;
    }
    
    // At first snap point, allow dragging from content area (but only if scrolled to top)
    if (isAtFirstSnapPoint && isContentArea) {
      const currentScrollTop = contentRef.current?.scrollTop || 0;
      if (currentScrollTop > 0) {
        return;
      }
      
      // Don't immediately start dragging, wait to determine gesture direction
      pointerIdRef.current = e.pointerId;
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      startHeightPxRef.current = heightPx;
      startScrollTopRef.current = currentScrollTop;
      setGestureState("unknown");
      
      if (drawerRef.current) {
        drawerRef.current.setPointerCapture(e.pointerId);
      }
      return;
    }
    
    // Not at first snap point, only handle area can drag
    if (!isAtFirstSnapPoint && !isHandleArea) {
      return;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointerIdRef.current === null) return;

    const deltaX = Math.abs(e.clientX - startXRef.current);
    const deltaY = e.clientY - startYRef.current;
    const absDeltaY = Math.abs(deltaY);

    // Determine gesture direction if unknown
    if (gestureState === "unknown") {
      // Need to move at least GESTURE_THRESHOLD pixels to determine direction
      if (deltaX > GESTURE_THRESHOLD || absDeltaY > GESTURE_THRESHOLD) {
        if (deltaX > absDeltaY) {
          // Horizontal gesture - allow scrolling
          setGestureState("horizontal");
          if (drawerRef.current && pointerIdRef.current !== null) {
            drawerRef.current.releasePointerCapture(pointerIdRef.current);
          }
          pointerIdRef.current = null;
          return;
        } else {
          // Vertical gesture - start dragging and prevent scroll
          setGestureState("vertical");
          setIsDragging(true);
          setIsContentScrollable(false);
          e.preventDefault();
        }
      } else {
        // Haven't moved enough yet, don't do anything
        return;
      }
    }

    // Only drag if this is a vertical gesture
    if (gestureState === "horizontal") {
      return;
    }

    if (!isDragging) return;

    // Prevent default scroll behavior when dragging vertically
    e.preventDefault();

    const invertedDeltaY = startYRef.current - e.clientY;
    
    // At first snap point with content area drag, only drag up
    if (isAtFirstSnapPoint && startScrollTopRef.current === 0) {
      if (invertedDeltaY < 0) return;
    }

    const newHeightPx = Math.max(0, Math.min(window.innerHeight, startHeightPxRef.current + invertedDeltaY));

    setInternalHeightPx(newHeightPx);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pointerIdRef.current === null && !isDragging) return;

    const wasDragging = isDragging;
    setIsDragging(false);
    setGestureState("unknown");
    setIsContentScrollable(true);
    pointerIdRef.current = null;

    if (!wasDragging) {
      if (drawerRef.current) {
        try {
          drawerRef.current.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore errors if pointer capture is already released
        }
      }
      return;
    }

    const deltaY = startYRef.current - e.clientY;
    const direction = Math.sign(deltaY);

    if (Math.abs(deltaY) > SNAP_THRESHOLD_PX) {
      const snapPoint = getClosestSnapPoint(internalHeightPx, direction);
      if (snapPoint === null) {
        onClose();
      } else {
        setInternalHeightPx(snapPoint);
      }
    } else {
      setInternalHeightPx(startHeightPxRef.current);
    }

    if (drawerRef.current) {
      try {
        drawerRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore errors if pointer capture is already released
      }
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    setIsDragging(false);
    setGestureState("unknown");
    setIsContentScrollable(true);
    pointerIdRef.current = null;
    
    if (drawerRef.current) {
      try {
        drawerRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore errors if pointer capture is already released
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 shadow-2xl z-50 flex flex-col rounded-t-3xl ${
          isDragging ? "" : "transition-all duration-300 ease-out"
        }`}
        style={{
          height: `${heightPx}px`,
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Handle at top when NOT at first snap point */}
        {!isAtFirstSnapPoint && (
          <div className="drawer-header w-full flex justify-center py-3 cursor-grab active:cursor-grabbing flex-shrink-0">
            <div className="drawer-handle w-12 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
          </div>
        )}

        {/* Content */}
        <div 
          ref={contentRef}
          className={`drawer-content px-6 flex-1 ${
            isAtFirstSnapPoint ? "pb-20" : "pb-6"
          } ${isAtFirstSnapPoint ? "cursor-grab active:cursor-grabbing" : ""}`}
          style={{
            overflowY: isContentScrollable ? "auto" : "hidden",
            overflowX: "auto",
          }}
        >
          {children}
        </div>

        {/* Handle at bottom when at first snap point */}
        {isAtFirstSnapPoint && (
          <div className="drawer-header w-full flex justify-center py-3 cursor-grab active:cursor-grabbing flex-shrink-0 absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900">
            <div className="drawer-handle w-12 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
          </div>
        )}
      </div>
    </>
  );
}

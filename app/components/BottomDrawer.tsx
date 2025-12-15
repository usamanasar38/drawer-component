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
  const [internalHeight, setInternalHeight] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [gestureState, setGestureState] = useState<"unknown" | "vertical" | "horizontal">("unknown");
  const [isContentScrollable, setIsContentScrollable] = useState(true);
  const drawerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startHeightRef = useRef(50);
  const startScrollTopRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  
  // Reset height to 50 when drawer is not open
  const height = isOpen ? internalHeight : 50;

  // Snap points in percentage
  const SNAP_POINTS = [50, 80, 100];
  const CLOSE_THRESHOLD = 30;
  const SNAP_THRESHOLD = 10;
  const GESTURE_THRESHOLD = 10; // pixels to determine gesture direction
  const FIRST_SNAP_POINT = SNAP_POINTS[0];
  
  // Check if we're at the first/default snap point
  const isAtFirstSnapPoint = height === FIRST_SNAP_POINT;

  const getClosestSnapPoint = (currentHeight: number, direction: number) => {
    if (currentHeight < CLOSE_THRESHOLD) {
      return null;
    }

    if (direction < 0) {
      const lowerSnapPoints = SNAP_POINTS.filter((point) => point < currentHeight);
      if (lowerSnapPoints.length > 0) {
        return lowerSnapPoints[lowerSnapPoints.length - 1];
      }
    } else if (direction > 0) {
      const higherSnapPoints = SNAP_POINTS.filter((point) => point > currentHeight);
      if (higherSnapPoints.length > 0) {
        return higherSnapPoints[0];
      }
    }

    return SNAP_POINTS.reduce((prev, curr) =>
      Math.abs(curr - currentHeight) < Math.abs(prev - currentHeight)
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
      startHeightRef.current = height;
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
      startHeightRef.current = height;
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

    const windowHeight = window.innerHeight;
    const deltaPercentage = (invertedDeltaY / windowHeight) * 100;
    const newHeight = Math.max(0, Math.min(100, startHeightRef.current + deltaPercentage));

    setInternalHeight(newHeight);
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
    const windowHeight = window.innerHeight;
    const deltaPercentage = (deltaY / windowHeight) * 100;
    const direction = Math.sign(deltaPercentage);

    if (Math.abs(deltaPercentage) > SNAP_THRESHOLD) {
      const snapPoint = getClosestSnapPoint(internalHeight, direction);
      if (snapPoint === null) {
        onClose();
      } else {
        setInternalHeight(snapPoint);
      }
    } else {
      setInternalHeight(startHeightRef.current);
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
          height: `${height}vh`,
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

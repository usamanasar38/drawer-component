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
  const drawerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(50);
  const startScrollTopRef = useRef(0);
  
  // Reset height to 50 when drawer is not open
  const height = isOpen ? internalHeight : 50;

  // Snap points in percentage
  const SNAP_POINTS = [50, 80, 100];
  const CLOSE_THRESHOLD = 30;
  const SNAP_THRESHOLD = 10;
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
    
    // At first snap point, allow dragging from content area (but only if scrolled to top)
    if (isAtFirstSnapPoint && isContentArea) {
      if (contentRef.current && contentRef.current.scrollTop > 0) {
        return;
      }
    } else if (!isHandleArea && !isContentArea) {
      return;
    } else if (!isAtFirstSnapPoint && !isHandleArea) {
      return;
    }

    setIsDragging(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    startScrollTopRef.current = contentRef.current?.scrollTop || 0;
    
    if (drawerRef.current) {
      drawerRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const deltaY = startYRef.current - e.clientY;
    
    // At first snap point with content area drag, only drag up
    if (isAtFirstSnapPoint && startScrollTopRef.current === 0) {
      if (deltaY < 0) return;
    }

    const windowHeight = window.innerHeight;
    const deltaPercentage = (deltaY / windowHeight) * 100;
    const newHeight = Math.max(0, Math.min(100, startHeightRef.current + deltaPercentage));

    setInternalHeight(newHeight);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;

    setIsDragging(false);

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
      drawerRef.current.releasePointerCapture(e.pointerId);
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
        className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 shadow-2xl z-50 flex flex-col ${
          isAtFirstSnapPoint ? "rounded-t-3xl" : "rounded-t-3xl"
        } ${isDragging ? "" : "transition-all duration-300 ease-out"}`}
        style={{
          height: `${height}vh`,
          touchAction: "pan-x",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
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
          className={`drawer-content px-6 overflow-y-auto flex-1 ${
            isAtFirstSnapPoint ? "pb-20" : "pb-6"
          } ${isAtFirstSnapPoint ? "cursor-grab active:cursor-grabbing" : ""}`}
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

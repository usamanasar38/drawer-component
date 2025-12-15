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
  const startYRef = useRef(0);
  const startHeightRef = useRef(50);
  
  // Reset height to 50 when drawer is not open
  const height = isOpen ? internalHeight : 50;

  // Snap points in percentage
  const SNAP_POINTS = [50, 80, 100];
  const CLOSE_THRESHOLD = 30; // Close drawer if dragged below 30%
  const SNAP_THRESHOLD = 10; // Minimum distance to trigger snap to next level

  const getClosestSnapPoint = (currentHeight: number, direction: number) => {
    // If dragged below close threshold, close the drawer
    if (currentHeight < CLOSE_THRESHOLD) {
      return null; // Signal to close
    }

    // Find closest snap point based on direction of drag
    if (direction < 0) {
      // Dragging down
      const lowerSnapPoints = SNAP_POINTS.filter((point) => point < currentHeight);
      if (lowerSnapPoints.length > 0) {
        return lowerSnapPoints[lowerSnapPoints.length - 1];
      }
    } else if (direction > 0) {
      // Dragging up
      const higherSnapPoints = SNAP_POINTS.filter((point) => point > currentHeight);
      if (higherSnapPoints.length > 0) {
        return higherSnapPoints[0];
      }
    }

    // Default to closest snap point
    return SNAP_POINTS.reduce((prev, curr) =>
      Math.abs(curr - currentHeight) < Math.abs(prev - currentHeight)
        ? curr
        : prev
    );
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    
    // Capture pointer to ensure we get all pointer events
    if (drawerRef.current) {
      drawerRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const deltaY = startYRef.current - e.clientY;
    const windowHeight = window.innerHeight;
    const deltaPercentage = (deltaY / windowHeight) * 100;
    const newHeight = Math.max(0, Math.min(100, startHeightRef.current + deltaPercentage));

    setInternalHeight(newHeight);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;

    setIsDragging(false);

    // Calculate drag direction and distance
    const deltaY = startYRef.current - e.clientY;
    const windowHeight = window.innerHeight;
    const deltaPercentage = (deltaY / windowHeight) * 100;
    const direction = Math.sign(deltaPercentage);

    // Check if drag was significant enough to snap
    if (Math.abs(deltaPercentage) > SNAP_THRESHOLD) {
      const snapPoint = getClosestSnapPoint(internalHeight, direction);
      if (snapPoint === null) {
        onClose();
      } else {
        setInternalHeight(snapPoint);
      }
    } else {
      // Snap back to starting height
      setInternalHeight(startHeightRef.current);
    }

    // Release pointer capture
    if (drawerRef.current) {
      drawerRef.current.releasePointerCapture(e.pointerId);
    }
  };

  // Manage body scroll when drawer is open
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
        className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl z-50 ${
          isDragging ? "" : "transition-all duration-300 ease-out"
        }`}
        style={{
          height: `${height}vh`,
          touchAction: "none",
        }}
        onPointerDown={(e) => {
          // Only start drag if clicking on handle or top area
          const target = e.target as HTMLElement;
          if (
            target.closest(".drawer-handle") ||
            target.closest(".drawer-header")
          ) {
            handlePointerDown(e);
          }
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Handle */}
        <div className="drawer-header w-full flex justify-center py-3 cursor-grab active:cursor-grabbing">
          <div className="drawer-handle w-12 h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
        </div>

        {/* Content */}
        <div className="px-6 pb-6 h-[calc(100%-3rem)] overflow-y-auto">
          {children}
        </div>
      </div>
    </>
  );
}

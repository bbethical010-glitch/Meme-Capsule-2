import { useRef, useState, useCallback } from "react";

export interface GestureHandlers {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  onSwipeUp?: () => void;
  onDoubleTap?: () => void;
}

export interface UseCurateGesturesOptions {
  enabled: boolean;
  handlers: GestureHandlers;
  minSwipeDistance?: number;
  minVelocity?: number;
  doubleTapThresholdMs?: number;
}

export function useCurateGestures({
  enabled,
  handlers,
  minSwipeDistance = 90,
  minVelocity = 0.25,
  doubleTapThresholdMs = 300
}: UseCurateGesturesOptions) {
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [swipePreview, setSwipePreview] = useState<"right" | "left" | "up" | null>(null);

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 1) return;
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      };
      setIsDragging(true);
      setDragOffset({ x: 0, y: 0 });
      setSwipePreview(null);
    },
    [enabled]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !touchStartRef.current || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;

      setDragOffset({ x: dx, y: dy });

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx > 40 && absDx > absDy * 1.2) {
        setSwipePreview(dx > 0 ? "right" : "left");
      } else if (dy < -40 && absDy > absDx * 1.2) {
        setSwipePreview("up");
      } else {
        setSwipePreview(null);
      }
    },
    [enabled]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !touchStartRef.current) {
        setIsDragging(false);
        setDragOffset({ x: 0, y: 0 });
        setSwipePreview(null);
        return;
      }

      const touch = e.changedTouches[0];
      const start = touchStartRef.current;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const dt = Math.max(1, Date.now() - start.time);
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const velocity = Math.hypot(dx, dy) / dt;

      touchStartRef.current = null;
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
      setSwipePreview(null);

      // 1. Horizontal Swipe (Right = J4, Left = J5)
      if (absDx >= minSwipeDistance && absDx > absDy * 1.3 && velocity >= minVelocity) {
        if (dx > 0) {
          handlers.onSwipeRight?.();
        } else {
          handlers.onSwipeLeft?.();
        }
        return;
      }

      // 2. Vertical Swipe Up (Open Manual Override)
      if (dy <= -70 && absDy > absDx * 1.3 && velocity >= 0.2) {
        handlers.onSwipeUp?.();
        return;
      }

      // 3. Double-Tap Detection for Force Remove
      if (absDx < 25 && absDy < 25 && dt < 280) {
        const now = Date.now();
        const prevTap = lastTapRef.current;

        if (
          prevTap &&
          now - prevTap.time <= doubleTapThresholdMs &&
          Math.abs(touch.clientX - prevTap.x) < 40 &&
          Math.abs(touch.clientY - prevTap.y) < 40
        ) {
          // Double-tap confirmed
          lastTapRef.current = null;
          if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            try {
              navigator.vibrate(50);
            } catch {
              // Ignore if vibration is restricted
            }
          }
          handlers.onDoubleTap?.();
          return;
        } else {
          lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
        }
      }
    },
    [enabled, handlers, minSwipeDistance, minVelocity, doubleTapThresholdMs]
  );

  const onTouchCancel = useCallback(() => {
    touchStartRef.current = null;
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    setSwipePreview(null);
  }, []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    dragOffset,
    isDragging,
    swipePreview
  };
}

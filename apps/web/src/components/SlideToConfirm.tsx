import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./SlideToConfirm.module.css";

const UNLOCK_THRESHOLD = 0.92;
const THUMB_SIZE = 44;

interface SlideToConfirmProps {
  label?: string;
  unlockedLabel?: string;
  disabled?: boolean;
  isPending?: boolean;
  onUnlock: () => void;
  resetKey?: number | string;
}

export function SlideToConfirm({
  label = "Slide all the way across to unlock deletion",
  unlockedLabel = "Unlocked — you may delete now",
  disabled,
  isPending,
  onUnlock,
  resetKey,
}: SlideToConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [unlocked, setUnlocked] = useState(false);

  const reset = useCallback(() => {
    progressRef.current = 0;
    setProgress(0);
    draggingRef.current = false;
    setUnlocked(false);
  }, []);

  useEffect(() => {
    reset();
  }, [resetKey, reset]);

  const maxOffset = useCallback(() => {
    const track = trackRef.current;
    if (!track) return 0;
    return Math.max(0, track.clientWidth - THUMB_SIZE);
  }, []);

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || disabled || isPending || unlocked) return;
      const rect = track.getBoundingClientRect();
      const max = maxOffset();
      const offset = Math.max(0, Math.min(clientX - rect.left - THUMB_SIZE / 2, max));
      const p = max > 0 ? offset / max : 0;
      progressRef.current = p;
      setProgress(p);
    },
    [disabled, isPending, maxOffset, unlocked],
  );

  const finishDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    if (progressRef.current >= UNLOCK_THRESHOLD && !disabled && !isPending) {
      progressRef.current = 1;
      setProgress(1);
      setUnlocked(true);
      onUnlock();
      return;
    }
    reset();
  }, [disabled, isPending, onUnlock, reset]);

  useEffect(() => {
    const onPointerUp = () => finishDrag();
    const onPointerMove = (e: PointerEvent) => {
      if (draggingRef.current) setFromClientX(e.clientX);
    };
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    return () => {
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [finishDrag, setFromClientX]);

  const offsetPx = (unlocked ? 1 : progress) * maxOffset();
  const inactive = disabled || isPending;
  const hint = unlocked ? unlockedLabel : label;
  const cueOnFill = unlocked || progress >= 0.5;

  return (
    <div className={styles.wrapper}>
      <p className={[styles.hint, unlocked ? styles.hintUnlocked : ""].filter(Boolean).join(" ")}>
        {hint}
      </p>

      <div
        className={[
          styles.track,
          inactive ? styles.trackDisabled : "",
          unlocked ? styles.trackUnlocked : "",
        ]
          .filter(Boolean)
          .join(" ")}
        ref={trackRef}
        role="group"
        aria-label={label}
      >
        <div
          className={[styles.fill, unlocked ? styles.fillReady : ""].filter(Boolean).join(" ")}
          style={{ width: `${THUMB_SIZE / 2 + offsetPx}px` }}
          aria-hidden
        />
        <span
          className={[styles.trackCue, cueOnFill ? styles.trackCueOnFill : ""].filter(Boolean).join(" ")}
          aria-hidden
        >
          ›››
        </span>
        <button
          type="button"
          className={[styles.thumb, unlocked ? styles.thumbReady : ""].filter(Boolean).join(" ")}
          style={{ transform: `translateX(${offsetPx}px)` }}
          disabled={inactive || unlocked}
          aria-label={label}
          onPointerDown={(e) => {
            if (inactive || unlocked) return;
            e.preventDefault();
            draggingRef.current = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            setFromClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (!draggingRef.current) return;
            setFromClientX(e.clientX);
          }}
        >
          <span className={styles.grip} aria-hidden>
            {unlocked ? "✓" : "››"}
          </span>
        </button>
      </div>
    </div>
  );
}

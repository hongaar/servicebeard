import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { iconSm } from "../lib/icons";

export function usePopover() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return {
    open,
    setOpen,
    rootRef,
    toggle: () => setOpen((v) => !v),
    close: () => setOpen(false),
  };
}

interface PopoverChevronProps {
  open: boolean;
  className?: string;
}

export function PopoverChevron({ open, className }: PopoverChevronProps) {
  return (
    <ChevronDown
      {...iconSm}
      className={[className, open ? "popoverChevronOpen" : ""]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

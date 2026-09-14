"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

const GAP = 6;
const EDGE = 8;

/**
 * Hover/focus tooltip for any element. Returns props to spread on the anchor
 * and the tooltip node to render next to it. The tooltip is portalled to
 * <body> because the table's `overflow-x` container would clip it.
 */
export function useTooltip<T extends HTMLElement>(
  content: React.ReactNode,
  enabled = true,
) {
  const anchorRef = React.useRef<T>(null);
  const tipRef = React.useRef<HTMLDivElement>(null);
  const tipId = React.useId();

  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{
    top: number;
    left: number;
  } | null>(null);

  // Place above the anchor, flip below when there is no room, and keep the
  // tooltip inside the viewport horizontally.
  React.useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const anchor = anchorRef.current?.getBoundingClientRect();
    const tip = tipRef.current?.getBoundingClientRect();
    if (!anchor || !tip) return;

    const above = anchor.top - GAP - tip.height;
    const top = above >= EDGE ? above : anchor.bottom + GAP;

    const centered = anchor.left + anchor.width / 2 - tip.width / 2;
    const left = Math.min(
      Math.max(centered, EDGE),
      window.innerWidth - tip.width - EDGE,
    );

    setPosition({ top, left });
  }, [open]);

  // A fixed tooltip would drift away from its anchor on any scroll.
  React.useEffect(() => {
    if (!open) return;

    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const show = () => {
    if (enabled) setOpen(true);
  };
  const hide = () => setOpen(false);

  const anchorProps = {
    ref: anchorRef,
    tabIndex: enabled ? 0 : undefined,
    "aria-describedby": open ? tipId : undefined,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Escape") hide();
    },
  };

  const tooltip = open
    ? createPortal(
        <div
          ref={tipRef}
          id={tipId}
          role="tooltip"
          style={{
            top: position?.top ?? 0,
            left: position?.left ?? 0,
            visibility: position ? "visible" : "hidden",
          }}
          className="pointer-events-none fixed z-50 max-w-80 whitespace-normal break-words rounded-md border border-line bg-surface px-2.5 py-1.5 text-start text-xs font-normal leading-relaxed text-fg shadow-panel"
        >
          {content}
        </div>,
        document.body,
      )
    : null;

  return { anchorProps, tooltip };
}

export const TOOLTIP_ANCHOR =
  "cursor-help rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Inline text that always shows `content` in a tooltip. */
export function Tooltip({ content, children, className }: TooltipProps) {
  const { anchorProps, tooltip } = useTooltip<HTMLSpanElement>(content);

  return (
    <>
      <span {...anchorProps} className={cn(TOOLTIP_ANCHOR, className)}>
        {children}
      </span>
      {tooltip}
    </>
  );
}

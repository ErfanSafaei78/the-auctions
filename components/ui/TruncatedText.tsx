"use client";

import * as React from "react";
import { TOOLTIP_ANCHOR, useTooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

interface TruncatedTextProps {
  children: string;
  /** Must include a `max-w-*` — that is what makes the text truncate. */
  className?: string;
}

/**
 * One line, ellipsised at its max width. The full text appears in a tooltip
 * only when something was actually cut off.
 */
export function TruncatedText({ children, className }: TruncatedTextProps) {
  const [truncated, setTruncated] = React.useState(false);
  const { anchorProps, tooltip } = useTooltip<HTMLSpanElement>(
    children,
    truncated,
  );
  const { ref } = anchorProps;

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => setTruncated(el.scrollWidth > el.clientWidth + 1);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, children]);

  return (
    <>
      <span
        {...anchorProps}
        className={cn("block truncate", truncated && TOOLTIP_ANCHOR, className)}
      >
        {children}
      </span>
      {tooltip}
    </>
  );
}

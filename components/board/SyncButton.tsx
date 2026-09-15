"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { TOOLTIP_ANCHOR, useTooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

/**
 * Manual sync is off because it cannot work from here: the action fetched
 * setadiran server-side, and eauc.setadiran.ir answers Iranian IPs only.
 * Rows now arrive through /api/ingest instead — see the README.
 */
const UNAVAILABLE_NOTE =
  "همگام‌سازی دستی از طریق سایت در دسترس نیست. داده‌ها روزی یک‌بار به‌صورت خودکار به‌روز می‌شود.";

export function SyncButton() {
  const { anchorProps, tooltip } = useTooltip<HTMLSpanElement>(UNAVAILABLE_NOTE);

  return (
    <div className="flex flex-col items-end gap-1.5">
      {/*
        A disabled button is pointer-events:none, so it never fires hover or
        focus itself — the wrapper has to be the tooltip anchor.
      */}
      <span {...anchorProps} className={cn(TOOLTIP_ANCHOR, "inline-flex")}>
        <Button type="button" variant="outline" size="sm" disabled>
          <RefreshCw />
          همگام‌سازی
          <span className="text-subtle">(به‌زودی)</span>
        </Button>
      </span>

      {tooltip}
    </div>
  );
}

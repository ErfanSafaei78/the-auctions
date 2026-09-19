"use client";

import { Send } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import type { AuctionFilters } from "@/lib/eauc/filters";
import { createTelegramSubscriptionAction } from "@/lib/telegram/actions";

interface TelegramSubscribeButtonProps {
  filters: AuctionFilters;
}

export function TelegramSubscribeButton({ filters }: TelegramSubscribeButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const handleClick = () => {
    setFailed(false);
    startTransition(async () => {
      const result = await createTelegramSubscriptionAction(filters);
      if (result.status === "created") {
        window.open(result.startUrl, "_blank", "noopener,noreferrer");
      } else {
        setFailed(true);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
      >
        <Send />
        اطلاع‌رسانی در تلگرام
      </Button>
      {failed ? (
        <p className="text-xs text-danger">اطلاع‌رسانی تلگرام در دسترس نیست.</p>
      ) : null}
    </div>
  );
}

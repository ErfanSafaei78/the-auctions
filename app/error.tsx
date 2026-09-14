"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function BoardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto w-full max-w-[72rem] animate-fade-in px-4 py-10 sm:px-6">
      <div className="rounded-xl border border-danger/40 bg-danger-soft px-6 py-8">
        <p className="font-medium text-danger">بارگذاری تابلو ممکن نشد.</p>
        <p className="mt-1 text-sm text-danger/80">
          ممکن است داده‌ها در حال به‌روزرسانی باشند. دوباره تلاش کنید.
        </p>
        <Button type="button" variant="outline" className="mt-4" onClick={reset}>
          تلاش دوباره
        </Button>
      </div>
    </section>
  );
}

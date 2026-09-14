import Link from "next/link";
import { Gavel } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[112rem] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
            <Gavel className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold tracking-tight transition-colors group-hover:text-accent">
              تابلوی مزایده‌ها
            </span>
            <span className="block truncate text-xs text-subtle">
              اموال منقول · ستاد ایران
            </span>
          </span>
        </Link>

        <ThemeToggle />
      </div>
    </header>
  );
}

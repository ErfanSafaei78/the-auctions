import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface DetailHeaderProps {
  title: string;
  children?: React.ReactNode;
}

/**
 * A back link rather than a breadcrumb trail: this site is two levels deep,
 * so a trail would only ever read "تابلو / X". The browser's own Back is the
 * primary route home — this is the affordance for arriving via a shared link.
 *
 * ChevronLeft is correct here: the page is RTL, so "back" points left.
 */
export function DetailHeader({ title, children }: DetailHeaderProps) {
  return (
    <header className="mb-6 space-y-3">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-accent"
      >
        <ChevronLeft className="size-4" />
        بازگشت به تابلو
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {title}
      </h1>

      {children}
    </header>
  );
}

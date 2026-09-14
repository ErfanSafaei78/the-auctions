import Link from "next/link";

/**
 * Rendered directly rather than via notFound(). The detail routes are
 * force-dynamic, so the layout shell has already flushed by the time the page
 * could throw — notFound() there yields an empty body instead of this panel.
 */
export function NotFoundPanel() {
  return (
    <section className="mx-auto w-full max-w-[72rem] animate-fade-in px-4 py-10 sm:px-6">
      <div className="rounded-xl border border-line bg-surface px-6 py-12 text-center">
        <p className="text-xs tracking-wide text-subtle">۴۰۴</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          این شناسه در ستاد پیدا نشد
        </h1>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-accent underline-offset-4 hover:underline"
        >
          بازگشت به تابلو
        </Link>
      </div>
    </section>
  );
}

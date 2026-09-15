import Link from "next/link";
import { EAUC_WELCOME_URL } from "@/lib/eauc/constants";

import { DetailHeader } from "./DetailHeader";

/**
 * The upstream board is intermittently unavailable. That is an expected state
 * to render, not a crash — a 500 page here would be the wrong trade.
 */
export function DetailError({ title }: { title: string }) {
  return (
    <section className="mx-auto w-full max-w-[72rem] animate-fade-in px-4 py-10 sm:px-6">
      <DetailHeader title={title} />

      <div className="rounded-xl border border-danger/40 bg-danger-soft px-6 py-8">
        <p className="font-medium text-danger">
          بارگذاری این صفحه از ستاد ایران ممکن نشد.
        </p>
        <p className="mt-1 text-sm text-danger/80">
          تابلوی ستاد گاهی موقتاً در دسترس نیست. دوباره تلاش کنید یا مستقیم در
          ستاد باز کنید.
        </p>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link
            href="/"
            className="text-accent underline-offset-4 hover:underline"
          >
            بازگشت به تابلو
          </Link>
          <a
            href={EAUC_WELCOME_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent underline-offset-4 hover:underline"
          >
            مشاهده در ستاد ایران
          </a>
        </div>
      </div>
    </section>
  );
}

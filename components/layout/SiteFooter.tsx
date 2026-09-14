import { EAUC_WELCOME_URL } from "@/lib/eauc/constants";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-[112rem] flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-subtle sm:px-6">
        <p>
          داده‌ها از تابلوی عمومی ستاد ایران خوانده می‌شود. این سایت وابسته به
          ستاد ایران نیست.
        </p>
        <a
          href={EAUC_WELCOME_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent underline-offset-4 hover:underline"
        >
          eauc.setadiran.ir
        </a>
      </div>
    </footer>
  );
}

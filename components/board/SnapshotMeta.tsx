import { toPersianDigits } from "@/lib/format/digits";
import { formatCount } from "@/lib/format/number";

interface SnapshotMetaProps {
  fetchedAtJalali: string;
  records: number;
  isStale: boolean;
}

export function SnapshotMeta({
  fetchedAtJalali,
  records,
  isStale,
}: SnapshotMetaProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
      {/* Absolute, never relative: a "۳ ساعت پیش" computed on both server and
          client is a guaranteed hydration mismatch. */}
      <span>به‌روزرسانی {toPersianDigits(fetchedAtJalali)}</span>
      <span aria-hidden className="text-subtle">
        ·
      </span>
      <span>{formatCount(records)} پارتی</span>

      {isStale ? (
        <span className="rounded-full border border-danger/40 bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
          قدیمی
        </span>
      ) : null}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <section className="mx-auto w-full max-w-[72rem] animate-fade-in px-4 py-10 sm:px-6">
      <div className="mb-8 space-y-3">
        <div className="h-4 w-48 animate-pulse rounded bg-raised" />
        <div className="h-9 w-72 animate-pulse rounded bg-raised" />
      </div>

      <div className="rounded-xl border border-line bg-surface p-6">
        <div className="mb-4 h-5 w-32 animate-pulse rounded bg-raised" />
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 15 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <div className="h-3 w-28 animate-pulse rounded bg-raised" />
              <div className="h-4 w-44 animate-pulse rounded bg-raised" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import type { DetailField } from "@/lib/eauc/types";

interface ScrapedFieldsProps {
  fields: DetailField[];
}

/** Labels and values both come from setadiran and are rendered verbatim. */
export function ScrapedFields({ fields }: ScrapedFieldsProps) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field, index) => (
        <div key={`${field.label}-${index}`} className="min-w-0">
          <dt className="text-xs text-subtle">{field.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-fg">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

import { cn } from "@/lib/utils";

export function FieldNoteLabel({
  label = "Field note",
  required = false,
  className,
}: {
  label?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center justify-between gap-3 text-sm font-bold text-[var(--tl-ink)]",
        className,
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "text-xs font-semibold",
          required
            ? "text-[var(--tl-danger)]"
            : "text-[var(--tl-ink-muted)]",
        )}
      >
        {required ? "Required" : "Optional"}
      </span>
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const map = {
    neutral: "bg-neutral-2 text-neutral-7 border-neutral-4",
    success: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
    warning: "bg-amber-500/15 text-amber-800 border-amber-500/30 dark:text-amber-200",
    danger: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-300",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium ${map[tone]}`}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-neutral-4 bg-neutral-1 p-6 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

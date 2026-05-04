import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-1 disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-primary-1 text-white hover:bg-primary-2"
      : variant === "secondary"
        ? "bg-secondary-1 text-white hover:opacity-90"
        : "bg-transparent text-neutral-8 hover:bg-neutral-2 dark:hover:bg-neutral-2";
  return (
    <button type={type} className={`${base} ${styles} ${className}`} {...props} />
  );
}

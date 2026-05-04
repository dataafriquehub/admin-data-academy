import type { InputHTMLAttributes } from "react";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-neutral-4 bg-neutral-2 px-3 py-2 text-base text-neutral-8 placeholder:text-neutral-5 focus:border-primary-1 focus:outline-none ${className}`}
      {...props}
    />
  );
}

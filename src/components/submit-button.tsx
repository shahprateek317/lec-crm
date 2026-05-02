"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Label shown when idle. */
  children: ReactNode;
  /** Optional override for the pending label. Defaults to children. */
  pendingLabel?: ReactNode;
};

/**
 * Submit button that automatically reflects the parent <form>'s pending state
 * via React's `useFormStatus`. Shows a spinner + disables itself while the
 * server action is in flight, so the user gets immediate visual feedback even
 * when the function cold-starts on Vercel.
 */
export function SubmitButton({ children, pendingLabel, className, disabled, ...rest }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-busy={pending}
      disabled={pending || disabled}
      className={`relative inline-flex items-center justify-center transition-opacity disabled:cursor-wait disabled:opacity-70 ${className ?? ""}`}
      {...rest}
    >
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
      <span>{pending ? (pendingLabel ?? children) : children}</span>
    </button>
  );
}

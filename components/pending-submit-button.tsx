"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function PendingSubmitButton({ children, className }: { children: ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-busy={pending}
    className={`${className} disabled:cursor-wait disabled:opacity-50`}>{children}</button>;
}

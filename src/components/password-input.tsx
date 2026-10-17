"use client";

import { useState, type ComponentProps } from "react";
import { Input } from "./ui";

/** A password box with a Show/Hide button, so it isn't typed blind on a phone. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className={`pr-18 ${className ?? ""}`} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 min-w-16 rounded-r-sm px-3 text-sm font-semibold text-brand hover:underline"
      >
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}

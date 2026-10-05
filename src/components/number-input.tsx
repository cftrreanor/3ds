"use client";

import type { ComponentProps } from "react";
import { Input } from "./ui";

/**
 * House rule: number fields are plain type-in boxes, never up/down spinners.
 * Only digits can be entered, and phones show the number keypad. Limits are
 * checked by the server when the form is saved.
 */
export function NumberInput({
  onChange,
  maxLength = 4,
  ...props
}: Omit<ComponentProps<typeof Input>, "type" | "min" | "max" | "step">) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      maxLength={maxLength}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        if (digits !== e.target.value) e.target.value = digits;
        onChange?.(e);
      }}
    />
  );
}

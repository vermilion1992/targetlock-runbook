"use client";

import { LoaderCircle } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FieldActionVariant = "primary" | "secondary" | "danger";
type FieldActionSize = "large" | "major";

const variantClasses: Record<FieldActionVariant, string> = {
  primary:
    "tl-action-primary border border-transparent text-white shadow-[var(--tl-shadow-sm)]",
  secondary:
    "border border-[var(--tl-border-strong)] bg-[var(--tl-surface)] text-[var(--tl-ink)]",
  danger:
    "border border-transparent bg-[var(--tl-danger)] text-white",
};

interface FieldActionButtonProps
  extends Omit<ButtonProps, "variant" | "size"> {
  variant?: FieldActionVariant;
  fieldSize?: FieldActionSize;
  busy?: boolean;
  fullWidth?: boolean;
}

export function FieldActionButton({
  children,
  variant = "primary",
  fieldSize = "large",
  busy = false,
  fullWidth = false,
  disabled,
  type,
  className,
  ...buttonProps
}: FieldActionButtonProps) {
  return (
    <Button
      {...buttonProps}
      type={type ?? "button"}
      variant="default"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-field-size={fieldSize}
      className={cn(
        "tl-field-action rounded-[var(--tl-radius-md)] px-5 text-base font-bold transition-[filter,transform] active:translate-y-px",
        variantClasses[variant],
        fieldSize === "major" && "px-6 text-lg",
        fullWidth && "w-full",
        className,
      )}
    >
      {busy ? (
        <>
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}

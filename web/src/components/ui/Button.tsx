import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
}

export function Button({ variant = "secondary", loading = false, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={`btn btn-${variant}`} disabled={disabled || loading} {...rest}>
      {loading ? <span className="spinner" aria-hidden /> : null}
      {children}
    </button>
  );
}
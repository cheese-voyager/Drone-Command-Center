import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, id, ...rest }: InputProps) {
  const inputId = id ?? rest.name ?? rest.placeholder;
  return (
    <div className="field">
      {label ? <label className="label" htmlFor={inputId}>{label}</label> : null}
      <input
        id={inputId}
        className="input"
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error ? <span className="field-error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

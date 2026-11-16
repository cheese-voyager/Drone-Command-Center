import type { InputHTMLAttributes } from "react";

interface SliderProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  valueLabel?: string;
}

export function Slider({ label, valueLabel, id, ...rest }: SliderProps) {
  const sliderId = id ?? rest.name ?? "slider";
  return (
    <div className="field">
      {label ? <label className="label" htmlFor={sliderId}>{label}</label> : null}
      <div className="slider-row">
        <input id={sliderId} type="range" className="slider" {...rest} />
        <span className="slider-value mono">{valueLabel ?? String(rest.value ?? "")}</span>
      </div>
    </div>
  );
}

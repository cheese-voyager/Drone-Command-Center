import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function Card({ title, meta, actions, children, className = "", ...rest }: CardProps) {
  return (
    <section className={`card ${className}`} {...rest}>
      {title || actions || meta ? (
        <header className="card-header">
          <h3 className="card-title">{title}</h3>
          {meta ? <span className="card-meta">{meta}</span> : null}
          {actions}
        </header>
      ) : null}
      <div className="card-body">{children}</div>
    </section>
  );
}

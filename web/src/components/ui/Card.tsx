import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function Card({ title, actions, children, className = "", ...rest }: CardProps) {
  return (
    <section className={`card ${className}`} {...rest}>
      {title || actions ? (
        <header className="card-header">
          <h3 className="card-title">{title}</h3>
          {actions}
        </header>
      ) : null}
      <div className="card-body">{children}</div>
    </section>
  );
}

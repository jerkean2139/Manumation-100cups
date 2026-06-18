import { type ReactNode, type ButtonHTMLAttributes } from "react";
import { cn, scoreBar, scoreTone } from "../lib/utils";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-paper border border-sand shadow-soft",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("p-5", className)}>
      {title && (
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const variants: Record<string, string> = {
    primary: "bg-ink text-canvas hover:bg-ink/90",
    ghost: "bg-transparent text-ink hover:bg-sand",
    outline: "bg-transparent text-ink border border-sand hover:bg-sand",
    danger: "bg-transparent text-clay border border-clay/30 hover:bg-clay/10",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-sand px-2.5 py-0.5 text-xs font-medium text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A single relationship score as a quiet labeled meter. */
export function ScoreMeter({
  label,
  value,
  hero,
}: {
  label: string;
  value: number;
  hero?: boolean;
}) {
  return (
    <div className={cn(hero && "rounded-xl bg-canvas p-3")}>
      <div className="flex items-baseline justify-between">
        <span className={cn("text-sm", hero ? "font-semibold text-ink" : "text-muted")}>
          {label}
        </span>
        <span className={cn("text-sm font-semibold tabular-nums", scoreTone(value))}>
          {value}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-sand">
        <div
          className={cn("h-full rounded-full", scoreBar(value))}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-sand border-t-ink" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

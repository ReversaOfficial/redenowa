import type { ReactNode } from "react";

export function TopBar({
  title,
  right,
  left,
  subtitle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  left?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {left}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {right}
      </div>
    </header>
  );
}

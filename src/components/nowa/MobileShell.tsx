import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function MobileShell({
  children,
  hideNav = false,
}: {
  children: ReactNode;
  hideNav?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto min-h-screen w-full max-w-md bg-background">
        <main className={hideNav ? "" : "pb-28"}>{children}</main>
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
}

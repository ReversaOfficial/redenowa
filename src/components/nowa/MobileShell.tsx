import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function MobileShell({
  children,
  hideNav = false,
  fullBleed = false,
}: {
  children: ReactNode;
  hideNav?: boolean;
  /** Quando true, o conteúdo cobre a viewport inteira (sem padding-bottom para a nav). */
  fullBleed?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div
        className={`mx-auto w-full max-w-md ${
          fullBleed ? "min-h-[100dvh] bg-black" : "min-h-screen bg-background"
        }`}
      >
        <main className={hideNav || fullBleed ? "" : "pb-28"}>{children}</main>
      </div>
      {!hideNav && <BottomNav transparent={fullBleed} />}
    </div>
  );
}


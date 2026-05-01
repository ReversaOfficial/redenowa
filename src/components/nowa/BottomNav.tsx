import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Camera, User, Archive } from "lucide-react";
import { motion } from "framer-motion";

type NavItem = {
  to: "/" | "/archive" | "/post" | "/profile";
  icon: typeof Home;
  label: string;
  primary?: boolean;
};

const items: NavItem[] = [
  { to: "/", icon: Home, label: "Agora" },
  { to: "/archive", icon: Archive, label: "Arquivo" },
  { to: "/post", icon: Camera, label: "Postar", primary: true },
  { to: "/profile", icon: User, label: "Perfil" },
];

export function BottomNav({ transparent = false }: { transparent?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 border-t ${
        transparent
          ? "border-white/10 bg-black/55 backdrop-blur-xl"
          : "border-border bg-background/85 backdrop-blur-xl"
      }`}
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
        {items.map((item) => {
          const active = path === item.to;
          const Icon = item.icon;
          if (item.primary) {
            return (
              <Link key={item.to} to={item.to} className="nowa-tap relative -mt-6">
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-[var(--shadow-glow)]"
                >
                  <span className="absolute inset-0 rounded-full nowa-pulse-ring" />
                  <Icon className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
                </motion.div>
              </Link>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              className="nowa-tap flex flex-1 flex-col items-center gap-1 py-2"
            >
              <Icon
                className={`h-5 w-5 transition-colors ${
                  active
                    ? transparent ? "text-white" : "text-foreground"
                    : transparent ? "text-white/60" : "text-muted-foreground"
                }`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span
                className={`text-[10px] font-medium tracking-wide transition-colors ${
                  active
                    ? transparent ? "text-white" : "text-foreground"
                    : transparent ? "text-white/60" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

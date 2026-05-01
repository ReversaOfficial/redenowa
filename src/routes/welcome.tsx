import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Bem-vindo ao NOWA — O momento é agora." },
      {
        name: "description",
        content:
          "Entre ou crie sua conta no NOWA. Sem filtro. Sem passado. Quem viu, viu.",
      },
      { property: "og:title", content: "Bem-vindo ao NOWA" },
      {
        property: "og:description",
        content: "Sem filtro. Sem passado. Quem viu, viu.",
      },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Navigate to="/" />;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Glow de fundo */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(60% 50% at 50% 10%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[55%]"
        aria-hidden
        style={{
          background:
            "radial-gradient(55% 60% at 50% 100%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 70%)",
        }}
      />

      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),28px)]">
        <header className="mt-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            O momento é agora
          </p>
          <h1 className="mt-2 flex items-baseline gap-2 text-5xl font-bold tracking-tight text-foreground">
            NOWA
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
          </h1>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mt-auto"
        >
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-foreground">
            Sem filtro.
            <br />
            Sem passado.
            <br />
            <span className="text-primary">Quem viu, viu.</span>
          </h2>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            A rede social do agora. Posts duram 24 horas e somem do feed —
            poste o momento ou perca.
          </p>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-10 space-y-3"
        >
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="flex w-full items-center justify-center rounded-full bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] active:scale-[0.99]"
          >
            Criar conta
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signin" }}
            className="flex w-full items-center justify-center rounded-full border border-border bg-card py-4 text-sm font-semibold text-foreground active:scale-[0.99]"
          >
            Já tenho conta
          </Link>
        </motion.div>

        <p className="mt-8 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Poste agora ou perca.
        </p>
      </main>
    </div>
  );
}

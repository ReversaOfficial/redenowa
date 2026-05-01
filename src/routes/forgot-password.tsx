import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Esqueci minha senha — NOWA" },
      {
        name: "description",
        content:
          "Recupere o acesso à sua conta no NOWA. Enviaremos um link para redefinir sua senha.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

const schema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
});

function ForgotPasswordPage() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (!loading && session) return <Navigate to="/" />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Email inválido");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        parsed.data.email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        },
      );
      if (error) throw error;
      // Por segurança, sempre mostramos sucesso (não confirma se a conta existe).
      setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Algo deu errado";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),24px)]">
        <div className="mt-2">
          <Link
            to="/auth"
            search={{ mode: "signin" }}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para o login
          </Link>
        </div>

        <header className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Recuperar acesso
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Esqueceu a senha?
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sem drama. Informe seu e-mail e enviamos um link para você criar uma
            nova.
          </p>
        </header>

        {sent ? (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 rounded-2xl border border-border bg-card p-6 text-center"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
              <MailCheck className="h-6 w-6 text-primary" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              Verifique seu e-mail
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Se existe uma conta para{" "}
              <span className="font-medium text-foreground">{email}</span>,
              enviamos um link para redefinir a senha. O link expira em algumas
              horas.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Não chegou? Confira o spam ou tente novamente em instantes.
            </p>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-border bg-background py-3 text-sm font-semibold text-foreground"
            >
              Enviar para outro e-mail
            </button>
          </motion.section>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                E-mail da conta
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                required
                className="mt-1 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none"
              />
            </label>
            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={busy}
              type="submit"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Enviando..." : "Enviar link de redefinição"}
            </motion.button>
          </form>
        )}

        <p className="mt-auto pt-10 text-center text-[11px] text-muted-foreground">
          Lembrou a senha?{" "}
          <Link
            to="/auth"
            search={{ mode: "signin" }}
            className="font-semibold text-foreground"
          >
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}

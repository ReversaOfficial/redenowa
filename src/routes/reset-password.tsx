import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Definir nova senha — NOWA" },
      {
        name: "description",
        content: "Defina uma nova senha para acessar sua conta no NOWA.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z
      .string()
      .min(6, "Senha deve ter ao menos 6 caracteres")
      .max(72, "Senha muito longa"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não conferem",
    path: ["confirm"],
  });

type Status = "checking" | "ready" | "invalid" | "done";

function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  // O Supabase entrega o usuário aqui via link de e-mail (type=recovery).
  // O detectSessionInUrl do client troca o token automaticamente — esperamos
  // o evento PASSWORD_RECOVERY ou uma sessão válida pra liberar o formulário.
  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setStatus("ready");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setStatus("ready");
      } else {
        // dá um tempinho pro detectSessionInUrl processar o hash
        timeout = setTimeout(() => {
          if (!cancelled && status === "checking") setStatus("invalid");
        }, 1500);
      }
    });

    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
      if (timeout) clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (error) throw error;
      setStatus("done");
      // desloga para forçar o usuário a entrar com a nova senha
      await supabase.auth.signOut();
      toast.success("Senha redefinida");
      setTimeout(() => {
        router.navigate({ to: "/auth", search: { mode: "signin" } });
      }, 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível atualizar";
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
            Nova senha
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Defina sua nova senha
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Crie uma senha forte. Você usará ela no próximo login.
          </p>
        </header>

        {status === "checking" && (
          <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validando seu link...
          </div>
        )}

        {status === "invalid" && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 rounded-2xl border border-border bg-card p-6 text-center"
          >
            <h2 className="text-lg font-semibold text-foreground">
              Link inválido ou expirado
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              O link de redefinição pode ter expirado ou já ter sido usado.
              Solicite um novo para continuar.
            </p>
            <Link
              to="/forgot-password"
              className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              Pedir novo link
            </Link>
          </motion.section>
        )}

        {status === "done" && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 rounded-2xl border border-border bg-card p-6 text-center"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              Senha atualizada
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Redirecionando para o login...
            </p>
          </motion.section>
        )}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <PasswordField
              label="Nova senha"
              value={password}
              onChange={setPassword}
              show={show}
              onToggleShow={() => setShow((v) => !v)}
              autoComplete="new-password"
            />
            <PasswordField
              label="Confirme a nova senha"
              value={confirm}
              onChange={setConfirm}
              show={show}
              onToggleShow={() => setShow((v) => !v)}
              autoComplete="new-password"
            />
            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={busy}
              type="submit"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Salvando..." : "Salvar nova senha"}
            </motion.button>
          </form>
        )}

        <p className="mt-auto pt-10 text-center text-[11px] text-muted-foreground">
          Poste agora ou perca.
        </p>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <div className="relative mt-1">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          autoComplete={autoComplete}
          required
          minLength={6}
          maxLength={72}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none"
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          className="absolute inset-y-0 right-2 my-auto flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}

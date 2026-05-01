import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";

type Mode = "signin" | "signup";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Entrar — NOWA" },
      { name: "description", content: "Entre no NOWA. O momento é agora." },
    ],
  }),
  component: AuthPage,
});

function getAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome")
    .max(60, "Nome muito longo"),
  city: z
    .string()
    .trim()
    .min(2, "Informe sua cidade")
    .max(60, "Cidade muito longa"),
  state: z
    .string()
    .trim()
    .min(2, "Informe seu estado")
    .max(60, "Estado muito longo"),
  country: z
    .string()
    .trim()
    .min(2, "Informe seu país")
    .max(60, "País muito longo"),
  dateOfBirth: z
    .string()
    .min(1, "Informe sua data de nascimento")
    .refine((v) => {
      const d = new Date(v);
      return !isNaN(d.getTime()) && getAge(d) >= 16;
    }, "Você precisa ter pelo menos 16 anos para se cadastrar"),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(72),
});

const signinSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Senha inválida").max(72),
});

function AuthPage() {
  const { session, loading } = useAuth();
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (search.mode) setMode(search.mode);
  }, [search.mode]);

  if (!loading && session) return <Navigate to="/" />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse({
          name,
          city,
          country,
          dateOfBirth,
          email,
          password,
        });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
          setBusy(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              display_name: parsed.data.name,
              city: parsed.data.city,
              country: parsed.data.country,
              date_of_birth: parsed.data.dateOfBirth,
            },
          },
        });
        if (error) throw error;
        toast.success("Bem-vindo ao NOWA");
      } else {
        const parsed = signinSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
          setBusy(false);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Algo deu errado";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Não foi possível entrar com o Google");
        setBusy(false);
        return;
      }
      if (result.redirected) return;
    } catch {
      toast.error("Falha no login com Google");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),24px)]">
        <div className="mt-2">
          <Link
            to="/welcome"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Link>
        </div>

        <header className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            O momento é agora
          </p>
          <h1 className="mt-2 flex items-baseline gap-2 text-4xl font-bold tracking-tight text-foreground">
            NOWA
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Crie sua conta e comece a postar agora."
              : "Entre para ver o que está rolando agora."}
          </p>
        </header>

        <div className="mt-8 flex gap-1 rounded-full bg-card p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                mode === m
                  ? "bg-background text-foreground shadow-[var(--shadow-soft)]"
                  : "text-muted-foreground"
              }`}
            >
              {m === "signin" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          {mode === "signup" && (
            <>
              <Field
                label="Nome"
                type="text"
                value={name}
                onChange={setName}
                placeholder="Como quer ser chamado"
                autoComplete="name"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Cidade"
                  type="text"
                  value={city}
                  onChange={setCity}
                  placeholder="São Paulo"
                  autoComplete="address-level2"
                  required
                />
                <Field
                  label="País"
                  type="text"
                  value={country}
                  onChange={setCountry}
                  placeholder="Brasil"
                  autoComplete="country-name"
                  required
                />
              </div>
              <Field
                label="Data de nascimento"
                type="date"
                value={dateOfBirth}
                onChange={setDateOfBirth}
                placeholder=""
                autoComplete="bday"
                required
              />
            </>
          )}
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="seu@email.com"
            autoComplete="email"
            required
          />
          <Field
            label="Senha"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            minLength={6}
          />

          {mode === "signin" && (
            <div className="flex justify-end -mt-1">
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Esqueci minha senha
              </Link>
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={busy}
            type="submit"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signup" ? "Criar conta" : "Entrar"}
          </motion.button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            ou
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-full border border-border bg-background py-3 text-sm font-semibold text-foreground transition-colors hover:bg-card disabled:opacity-60"
        >
          <GoogleIcon />
          Continuar com Google
        </button>

        <p className="mt-auto pt-10 text-center text-[11px] text-muted-foreground">
          Poste agora ou perca.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  minLength,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className="mt-1 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none"
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.49h4.84c-.21 1.13-.84 2.08-1.79 2.72v2.26h2.9c1.7-1.56 2.69-3.87 2.69-6.63z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.34A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.41 5.41 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.96H.96A8.996 8.996 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.99-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.99 2.34C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}

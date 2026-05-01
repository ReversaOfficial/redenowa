import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { MobileShell } from "@/components/nowa/MobileShell";
import { Avatar } from "@/components/nowa/PostCard";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Bem-vindo — NOWA" },
      {
        name: "description",
        content: "Confirme seu perfil e personalize as cores antes de entrar.",
      },
    ],
  }),
  component: OnboardingPage,
});

const DEFAULT_BG = "#0F0F12";
const DEFAULT_RING = "#FF2E63";

const PRESET_BGS = [
  "#0F0F12",
  "#1B1F2A",
  "#2A1B3D",
  "#0E2A1F",
  "#3D1B1B",
  "#F4F1EA",
  "#FFE9E3",
  "#E3F0FF",
];

const PRESET_RINGS = [
  "#FF2E63",
  "#FFB100",
  "#19C37D",
  "#3B82F6",
  "#A855F7",
  "#FF7849",
  "#000000",
  "#FFFFFF",
];

const schema = z.object({
  display_name: z.string().trim().min(2, "Informe seu nome").max(40),
  city: z.string().trim().min(2, "Informe sua cidade").max(60),
  country: z.string().trim().min(2, "Informe seu país").max(60),
});

function OnboardingPage() {
  const { profile, user, refreshProfile, loading } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [bg, setBg] = useState(DEFAULT_BG);
  const [ring, setRing] = useState(DEFAULT_RING);
  const [saving, setSaving] = useState(false);

  // Hidrata os campos com o que veio do cadastro
  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name ?? "");
    setCity(profile.city ?? "");
    setCountry(profile.country ?? "");
    if (profile.theme_bg) setBg(profile.theme_bg);
    if (profile.theme_ring) setRing(profile.theme_ring);
  }, [profile]);

  // Se já completou o onboarding, manda pro feed
  useEffect(() => {
    if (!loading && profile?.onboarded_at) {
      router.navigate({ to: "/" });
    }
  }, [loading, profile?.onboarded_at, router]);

  const previewTextColor = useMemo(() => readableTextOn(bg), [bg]);
  const previewMutedColor = useMemo(
    () => withAlpha(previewTextColor, 0.65),
    [previewTextColor],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || saving) return;
    const parsed = schema.safeParse({
      display_name: name,
      city,
      country,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.display_name,
        city: parsed.data.city,
        country: parsed.data.country,
        theme_bg: bg,
        theme_ring: ring,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: error.message });
      return;
    }
    await refreshProfile();
    toast.success("Tudo certo. Bem-vindo ao agora.");
    router.navigate({ to: "/" });
  }

  return (
    <MobileShell>
      <div className="px-5 pb-10 pt-[max(env(safe-area-inset-top),20px)]">
        <header className="pt-2">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-3 w-3" /> Quase lá
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            Confirme seu perfil
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Veja como ele vai aparecer e dê o seu toque com as cores.
          </p>
        </header>

        {/* PREVIEW */}
        <motion.section
          layout
          aria-label="Pré-visualização do perfil"
          className="relative mt-6 overflow-hidden rounded-3xl border border-border"
          style={{ background: bg, color: previewTextColor }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-24"
            aria-hidden
            style={{
              background: `radial-gradient(60% 100% at 50% 0%, ${withAlpha(ring, 0.35)}, transparent 70%)`,
            }}
          />
          <div className="relative flex flex-col items-center px-6 py-7 text-center">
            <Avatar
              src={profile?.avatar_url ?? null}
              name={name || "?"}
              size={88}
              ringColor={ring}
              ringWidth={4}
            />
            <h2
              className="mt-3 text-xl font-bold leading-tight"
              style={{ color: previewTextColor }}
            >
              {name || "Seu nome"}
            </h2>
            <p
              className="mt-0.5 text-xs"
              style={{ color: previewMutedColor }}
            >
              @{profile?.handle ?? "voce"}
            </p>
            <p
              className="mt-2 text-xs"
              style={{ color: previewMutedColor }}
            >
              {[city, country].filter(Boolean).join(" · ") ||
                "Cidade · País"}
            </p>
          </div>
        </motion.section>

        {/* FORM */}
        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <Field
            label="Nome"
            value={name}
            onChange={setName}
            placeholder="Como quer ser chamado"
            maxLength={40}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Cidade"
              value={city}
              onChange={setCity}
              placeholder="São Paulo"
              maxLength={60}
            />
            <Field
              label="País"
              value={country}
              onChange={setCountry}
              placeholder="Brasil"
              maxLength={60}
            />
          </div>

          <ColorPicker
            label="Cor de fundo do perfil"
            value={bg}
            onChange={setBg}
            presets={PRESET_BGS}
          />
          <ColorPicker
            label="Cor da moldura do avatar"
            value={ring}
            onChange={setRing}
            presets={PRESET_RINGS}
          />

          <button
            type="submit"
            disabled={saving}
            className="nowa-tap mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Salvando..." : "Entrar no NOWA"}
          </button>
        </form>
      </div>
    </MobileShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-1 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none"
      />
    </label>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
  presets,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  presets: string[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {value.toUpperCase()}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label
          className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border"
          style={{ background: value }}
          aria-label={`Escolher ${label}`}
        >
          <input
            type="color"
            value={normalizeHex(value)}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <div className="grid flex-1 grid-cols-8 gap-1.5">
          {presets.map((c) => {
            const selected = c.toLowerCase() === value.toLowerCase();
            return (
              <button
                type="button"
                key={c}
                onClick={() => onChange(c)}
                aria-label={c}
                className="relative h-7 w-full rounded-md border border-border"
                style={{ background: c }}
              >
                {selected && (
                  <Check
                    className="absolute inset-0 m-auto h-3.5 w-3.5"
                    style={{ color: readableTextOn(c) }}
                    strokeWidth={3}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Helpers de cor (puramente client-side)
function normalizeHex(c: string): string {
  if (/^#([0-9a-f]{6})$/i.test(c)) return c;
  if (/^#([0-9a-f]{3})$/i.test(c)) {
    return (
      "#" +
      c
        .slice(1)
        .split("")
        .map((ch) => ch + ch)
        .join("")
    );
  }
  return "#000000";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function readableTextOn(bg: string): string {
  const { r, g, b } = hexToRgb(bg);
  // luminância relativa simplificada
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0F0F12" : "#FFFFFF";
}

function withAlpha(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

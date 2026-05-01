import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Camera as CameraIcon, RotateCcw, Send, Circle, ArrowLeft } from "lucide-react";
import { MobileShell } from "@/components/nowa/MobileShell";
import { ME, postsStore } from "@/lib/posts-store";

export const Route = createFileRoute("/post")({
  head: () => ({
    meta: [
      { title: "Postar agora — NOWA" },
      { name: "description", content: "Capture o momento. Sem filtros, sem passado." },
    ],
  }),
  component: PostPage,
});

type Stage = "camera" | "preview";

function PostPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stage, setStage] = useState<Stage>("camera");
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [snap, setSnap] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (stage !== "camera") return;
    let cancelled = false;

    async function start() {
      try {
        setError(null);
        setReady(false);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : "Não foi possível acessar a câmera.";
        setError(msg);
      }
    }
    start();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facing, stage]);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    const data = canvas.toDataURL("image/jpeg", 0.9);
    setSnap(data);
    setStage("preview");
  }

  function publish() {
    if (!snap) return;
    postsStore.add({
      authorId: ME.id,
      authorName: ME.name,
      authorHandle: ME.handle,
      authorAvatar: ME.avatar,
      mediaUrl: snap,
      mediaType: "image",
      caption: caption.trim(),
    });
    navigate({ to: "/" });
  }

  return (
    <MobileShell hideNav>
      <div className="relative h-screen w-full overflow-hidden bg-black text-white">
        {stage === "camera" && (
          <>
            {/* Top bar */}
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
              <button
                onClick={() => navigate({ to: "/" })}
                className="nowa-tap flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/70">
                  ao vivo
                </p>
                <p className="text-sm font-semibold">Capture o agora</p>
              </div>
              <button
                onClick={() => setFacing(facing === "user" ? "environment" : "user")}
                className="nowa-tap flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur"
                aria-label="Virar câmera"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            </div>

            {/* Video */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`h-full w-full object-cover ${
                facing === "user" ? "scale-x-[-1]" : ""
              }`}
            />

            {!ready && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="text-center">
                  <CameraIcon className="mx-auto mb-3 h-8 w-8 text-white/70" />
                  <p className="text-sm text-white/70">Iniciando câmera...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black px-8 text-center">
                <CameraIcon className="mb-4 h-10 w-10 text-primary" />
                <h2 className="text-lg font-bold">Câmera necessária</h2>
                <p className="mt-2 max-w-xs text-sm text-white/70">
                  Permita o acesso à câmera. NOWA não aceita uploads — apenas o
                  momento agora.
                </p>
                <p className="mt-4 text-xs text-white/40">{error}</p>
                <button
                  onClick={() => navigate({ to: "/" })}
                  className="nowa-tap mt-6 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
                >
                  Voltar
                </button>
              </div>
            )}

            {/* Bottom controls */}
            <div className="absolute inset-x-0 bottom-0 z-20 pb-[max(env(safe-area-inset-bottom),24px)] pt-6">
              <p className="mb-5 text-center text-xs font-medium uppercase tracking-[0.2em] text-white/70">
                sem filtro · sem passado
              </p>
              <div className="flex items-center justify-center">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={capture}
                  disabled={!ready}
                  className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white disabled:opacity-50"
                  aria-label="Capturar"
                >
                  <Circle className="h-16 w-16 fill-white text-white" />
                </motion.button>
              </div>
            </div>
          </>
        )}

        {stage === "preview" && snap && (
          <div className="flex h-full flex-col bg-background text-foreground">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
              <button
                onClick={() => {
                  setSnap(null);
                  setCaption("");
                  setStage("camera");
                }}
                className="nowa-tap flex h-9 w-9 items-center justify-center rounded-full bg-card"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <p className="text-sm font-semibold">Novo momento</p>
              <div className="w-9" />
            </div>

            <div className="flex-1 overflow-y-auto">
              <img
                src={snap}
                alt="Captura"
                className="aspect-[4/5] w-full bg-black object-cover"
              />
              <div className="px-4 py-4">
                <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Legenda (opcional)
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, 140))}
                  placeholder="Diga algo sobre este momento..."
                  rows={3}
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>Sem edição. Sem cortes.</span>
                  <span className="tabular-nums">{caption.length}/140</span>
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-background px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)]">
              <button
                onClick={publish}
                className="nowa-tap flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
              >
                <Send className="h-4 w-4" strokeWidth={2.5} />
                Publicar agora
              </button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Este post some em 24h. Quem viu, viu.
              </p>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}

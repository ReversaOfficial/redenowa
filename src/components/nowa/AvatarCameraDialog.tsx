import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { X, RotateCcw, Camera as CameraIcon, Check, ArrowLeft } from "lucide-react";
import { CameraErrorFallback } from "@/components/nowa/CameraErrorFallback";
import { classifyCameraError, type CameraErrorInfo } from "@/lib/camera-errors";

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (blob: Blob) => void;
};

function dataURLtoBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(header)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function AvatarCameraDialog({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [snap, setSnap] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open || snap) return;
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
          e instanceof Error ? e.message : "Não foi possível acessar a câmera.";
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
  }, [facing, open, snap]);

  function close() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setSnap(null);
    setError(null);
    setReady(false);
    onClose();
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    // crop quadrado central
    const size = Math.min(w, h);
    const sx = (w - size) / 2;
    const sy = (h - size) / 2;
    const target = 720;
    const canvas = document.createElement("canvas");
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      ctx.translate(target, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, size, size, 0, 0, target, target);
    const data = canvas.toDataURL("image/jpeg", 0.9);
    setSnap(data);
  }

  function confirm() {
    if (!snap) return;
    onCapture(dataURLtoBlob(snap));
    close();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black text-white">
      {/* topbar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <button
          type="button"
          onClick={snap ? () => setSnap(null) : close}
          className="nowa-tap flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur"
          aria-label={snap ? "Refazer" : "Fechar"}
        >
          {snap ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </button>
        <div className="text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/70">
            ao vivo
          </p>
          <p className="text-sm font-semibold">Novo avatar</p>
        </div>
        {!snap ? (
          <button
            type="button"
            onClick={() =>
              setFacing(facing === "user" ? "environment" : "user")
            }
            className="nowa-tap flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur"
            aria-label="Virar câmera"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* área quadrada com máscara */}
      <div className="relative flex h-full w-full items-center justify-center">
        {snap ? (
          <img
            src={snap}
            alt="Pré-visualização"
            className="h-auto w-[min(85vw,420px)] rounded-full object-cover aspect-square"
          />
        ) : (
          <div className="relative aspect-square w-[min(85vw,420px)] overflow-hidden rounded-full ring-4 ring-white/15">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`h-full w-full object-cover ${
                facing === "user" ? "scale-x-[-1]" : ""
              }`}
            />
          </div>
        )}

        {!ready && !error && !snap && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <CameraIcon className="mx-auto mb-3 h-8 w-8 text-white/70" />
              <p className="text-sm text-white/70">Iniciando câmera...</p>
            </div>
          </div>
        )}

        {error && !snap && (
          <CameraErrorFallback
            info={error}
            onRetry={() => setRetryToken((n) => n + 1)}
            onCancel={close}
            cancelLabel="Fechar"
            onDark
          />
        )}
      </div>

      {/* controles */}
      <div className="absolute inset-x-0 bottom-0 z-20 pb-[max(env(safe-area-inset-bottom),24px)] pt-6">
        <p className="mb-5 text-center text-xs font-medium uppercase tracking-[0.2em] text-white/70">
          {snap ? "Confirma este momento?" : "sem filtro · sem galeria"}
        </p>
        <div className="flex items-center justify-center">
          {snap ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={confirm}
              className="nowa-tap inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)]"
            >
              <Check className="h-5 w-5" strokeWidth={3} />
              Usar este avatar
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={capture}
              disabled={!ready}
              className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white disabled:opacity-50"
              aria-label="Capturar"
            >
              <span className="h-16 w-16 rounded-full bg-white" />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}

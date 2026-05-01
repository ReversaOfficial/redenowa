import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  X,
  Camera as CameraIcon,
  RotateCcw,
  Send,
  Circle,
  ArrowLeft,
  Loader2,
  Video,
  Square,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { MobileShell } from "@/components/nowa/MobileShell";
import { CameraErrorFallback } from "@/components/nowa/CameraErrorFallback";
import { useAuth } from "@/lib/auth-context";
import { createPost, uploadMedia } from "@/lib/posts-api";
import { classifyCameraError, type CameraErrorInfo } from "@/lib/camera-errors";
import { moderateImage } from "@/server/moderate.functions";

const CAPTION_MIN = 3;
const CAPTION_MAX = 80;
const MAX_VIDEO_MS = 60_000; // 1 minute
const captionSchema = z
  .string()
  .trim()
  .min(CAPTION_MIN, `Mínimo ${CAPTION_MIN} caracteres`)
  .max(CAPTION_MAX, `Máximo ${CAPTION_MAX} caracteres`);

export const Route = createFileRoute("/_authenticated/post")({
  head: () => ({
    meta: [
      { title: "Postar agora — NOWA" },
      { name: "description", content: "Capture o momento. Sem filtros, sem passado." },
    ],
  }),
  component: PostPage,
});

type Stage = "camera" | "preview";
type MediaMode = "photo" | "video";

function dataURLtoBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(header)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function formatTimer(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PostPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [stage, setStage] = useState<Stage>("camera");
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [mode, setMode] = useState<MediaMode>("photo");
  const [snap, setSnap] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<CameraErrorInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);

  // Start camera
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
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("MediaDevices not supported");
        }
        const constraints: MediaStreamConstraints = {
          video: { facingMode: facing },
          audio: mode === "video",
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
        if (cancelled) return;
        const info = classifyCameraError(e);
        setError(info);
        toast.error(info.title, { description: info.message });
      }
    }
    start();

    return () => {
      cancelled = true;
      stopRecordingCleanup();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facing, stage, retryToken, mode]);

  function stopRecordingCleanup() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
  }

  // Photo capture
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
    const data = canvas.toDataURL("image/jpeg", 0.88);
    setSnap(data);
    setStage("preview");
  }

  // Video recording
  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setVideoBlob(blob);
      const url = URL.createObjectURL(blob);
      setVideoPreviewUrl(url);
      setStage("preview");
      setRecording(false);
      setRecordMs(0);
    };

    recorder.start(500);
    setRecording(true);
    setRecordMs(0);

    const t0 = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - t0;
      setRecordMs(elapsed);
      if (elapsed >= MAX_VIDEO_MS) {
        stopRecordingCleanup();
      }
    }, 200);
  }, []);

  function stopRecording() {
    stopRecordingCleanup();
  }

  // Publish
  async function publish() {
    if (!user || publishing) return;
    const isVideo = mode === "video" && videoBlob;
    if (!isVideo && !snap) return;

    const parsed = captionSchema.safeParse(caption);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Legenda inválida");
      return;
    }
    setPublishing(true);
    try {
      let blob: Blob;
      let ext: string;
      let mediaType: "image" | "video";

      if (isVideo && videoBlob) {
        blob = videoBlob;
        ext = videoBlob.type.includes("mp4") ? "mp4" : "webm";
        mediaType = "video";
      } else {
        blob = dataURLtoBlob(snap!);
        ext = "jpg";
        mediaType = "image";
      }

      const url = await uploadMedia(user.id, blob, ext);
      await createPost({ authorId: user.id, mediaUrl: url, caption: parsed.data, mediaType });
      qc.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Publicado. O momento é agora.");
      navigate({ to: "/" });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Falha ao publicar";
      toast.error(msg);
      setPublishing(false);
    }
  }

  function resetCamera() {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setSnap(null);
    setVideoBlob(null);
    setVideoPreviewUrl(null);
    setCaption("");
    setStage("camera");
  }

  const previewSrc = mode === "video" ? videoPreviewUrl : snap;

  return (
    <MobileShell hideNav>
      <div className="relative h-screen w-full overflow-hidden bg-black text-white">
        {stage === "camera" && (
          <>
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
              <button
                onClick={() => navigate({ to: "/" })}
                className="nowa-tap flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="text-center">
                {recording && (
                  <p className="text-sm font-bold text-red-500 tabular-nums">
                    ● {formatTimer(recordMs)}
                  </p>
                )}
                {!recording && (
                  <>
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/70">
                      ao vivo
                    </p>
                    <p className="text-sm font-semibold">Capture o agora</p>
                  </>
                )}
              </div>
              <button
                onClick={() => setFacing(facing === "user" ? "environment" : "user")}
                className="nowa-tap flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur"
                aria-label="Virar câmera"
                disabled={recording}
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            </div>

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
              <CameraErrorFallback
                info={error}
                onRetry={() => setRetryToken((n) => n + 1)}
                onCancel={() => navigate({ to: "/" })}
                cancelLabel="Voltar ao feed"
                onDark
              />
            )}

            <div className="absolute inset-x-0 bottom-0 z-20 pb-[max(env(safe-area-inset-bottom),24px)] pt-6">
              {/* Mode switcher */}
              {!recording && (
                <div className="mb-4 flex items-center justify-center gap-6">
                  <button
                    onClick={() => setMode("photo")}
                    className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                      mode === "photo" ? "text-white" : "text-white/40"
                    }`}
                  >
                    Foto
                  </button>
                  <button
                    onClick={() => setMode("video")}
                    className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                      mode === "video" ? "text-white" : "text-white/40"
                    }`}
                  >
                    Vídeo
                  </button>
                </div>
              )}

              <p className="mb-5 text-center text-xs font-medium uppercase tracking-[0.2em] text-white/70">
                {mode === "video"
                  ? recording
                    ? `máx ${formatTimer(MAX_VIDEO_MS)}`
                    : "toque para gravar · máx 1min"
                  : "sem filtro · sem passado"}
              </p>

              <div className="flex items-center justify-center">
                {mode === "photo" ? (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={capture}
                    disabled={!ready}
                    className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white disabled:opacity-50"
                    aria-label="Capturar"
                  >
                    <Circle className="h-16 w-16 fill-white text-white" />
                  </motion.button>
                ) : recording ? (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={stopRecording}
                    className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-red-500"
                    aria-label="Parar gravação"
                  >
                    <Square className="h-8 w-8 fill-red-500 text-red-500" />
                  </motion.button>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={startRecording}
                    disabled={!ready}
                    className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-red-500 disabled:opacity-50"
                    aria-label="Gravar vídeo"
                  >
                    <Circle className="h-16 w-16 fill-red-500 text-red-500" />
                  </motion.button>
                )}
              </div>

              {/* Progress bar for video */}
              {recording && (
                <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all"
                    style={{ width: `${Math.min((recordMs / MAX_VIDEO_MS) * 100, 100)}%` }}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {stage === "preview" && previewSrc && (
          <div className="flex h-full flex-col bg-background text-foreground">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
              <button
                onClick={resetCamera}
                className="nowa-tap flex h-9 w-9 items-center justify-center rounded-full bg-card"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <p className="text-sm font-semibold">
                {mode === "video" ? "Novo vídeo" : "Novo momento"}
              </p>
              <div className="w-9" />
            </div>

            <div className="flex-1 overflow-y-auto">
              {mode === "video" && videoPreviewUrl ? (
                <video
                  src={videoPreviewUrl}
                  controls
                  playsInline
                  className="aspect-[4/5] w-full bg-black object-cover"
                />
              ) : (
                <img
                  src={snap!}
                  alt="Captura"
                  className="aspect-[4/5] w-full bg-black object-cover"
                />
              )}
              <div className="px-4 py-4">
                <label
                  htmlFor="caption"
                  className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Legenda <span className="text-primary">*</span>
                </label>
                <textarea
                  id="caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
                  placeholder={`Diga algo curto (mín ${CAPTION_MIN}, máx ${CAPTION_MAX})…`}
                  rows={2}
                  maxLength={CAPTION_MAX}
                  required
                  aria-invalid={
                    caption.trim().length > 0 &&
                    caption.trim().length < CAPTION_MIN
                  }
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none aria-[invalid=true]:border-destructive"
                />
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>
                    {caption.trim().length === 0
                      ? "Obrigatório. Sem edição, sem cortes."
                      : caption.trim().length < CAPTION_MIN
                      ? `Faltam ${CAPTION_MIN - caption.trim().length} caracteres`
                      : "Pronto para publicar."}
                  </span>
                  <span
                    className={`tabular-nums ${
                      caption.length >= CAPTION_MAX ? "text-destructive" : ""
                    }`}
                  >
                    {caption.length}/{CAPTION_MAX}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-background px-4 py-3 pb-[max(env(safe-area-inset-bottom),12px)]">
              {(() => {
                const valid = captionSchema.safeParse(caption).success;
                return (
                  <button
                    onClick={publish}
                    disabled={publishing || !valid}
                    className="nowa-tap flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-opacity disabled:opacity-50"
                  >
                    {publishing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" strokeWidth={2.5} />
                    )}
                    {publishing ? "Publicando..." : "Publicar agora"}
                  </button>
                );
              })()}
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

import { Camera as CameraIcon, RefreshCw, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import type { CameraErrorInfo } from "@/lib/camera-errors";

type Props = {
  info: CameraErrorInfo;
  onRetry: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  /** Quando true, usa cores claras para fundo escuro (overlay sobre câmera). */
  onDark?: boolean;
};

export function CameraErrorFallback({
  info,
  onRetry,
  onCancel,
  cancelLabel = "Voltar",
  onDark = true,
}: Props) {
  const textMuted = onDark ? "text-white/70" : "text-muted-foreground";
  const textRaw = onDark ? "text-white/40" : "text-muted-foreground/70";
  const stepBg = onDark ? "bg-white/10" : "bg-muted";
  const stepBorder = onDark ? "border-white/10" : "border-border";
  const numBg = onDark ? "bg-primary text-primary-foreground" : "bg-primary text-primary-foreground";
  const titleColor = onDark ? "text-white" : "text-foreground";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-y-auto px-6 py-10 text-center"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
        <CameraIcon className="h-8 w-8 text-primary" />
      </div>
      <h2 className={`text-lg font-bold ${titleColor}`}>{info.title}</h2>
      <p className={`mt-2 max-w-xs text-sm ${textMuted}`}>{info.message}</p>

      <ul
        className={`mt-5 w-full max-w-xs space-y-2 rounded-2xl border ${stepBorder} ${stepBg} p-3 text-left`}
      >
        {info.steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-bold ${numBg}`}
            >
              {i + 1}
            </span>
            <span className={`text-xs leading-snug ${onDark ? "text-white/90" : "text-foreground"}`}>
              {step}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col items-center gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={onRetry}
          className="nowa-tap inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={2.5} />
          Tentar de novo
        </motion.button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={`nowa-tap inline-flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold ${onDark ? "text-white/80" : "text-muted-foreground"}`}
          >
            {cancelLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {info.raw && (
        <p className={`mt-5 max-w-xs text-[10px] ${textRaw}`}>{info.raw}</p>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const HOUR = 60 * 60 * 1000;
const POST_TTL = 24 * HOUR;

function format(msLeft: number): { label: string; urgent: boolean; expired: boolean } {
  if (msLeft <= 0) return { label: "expirado", urgent: true, expired: true };
  const totalSec = Math.floor(msLeft / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  // Última hora: precisão em min:seg
  if (h < 1) {
    return {
      label: `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")} restantes`,
      urgent: true,
      expired: false,
    };
  }
  // Demais: horas + minutos
  return {
    label: `${h}h ${m.toString().padStart(2, "0")}m restantes`,
    urgent: false,
    expired: false,
  };
}

export function ExpiryCountdown({
  createdAt,
  className,
}: {
  createdAt: string;
  className?: string;
}) {
  const expiresAt = new Date(createdAt).getTime() + POST_TTL;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const msLeft = expiresAt - Date.now();
    // < 1h → tick a cada 1s. Caso contrário, a cada 30s.
    const interval = msLeft <= HOUR ? 1000 : 30_000;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [expiresAt, now]);

  const { label, urgent, expired } = format(expiresAt - now);

  const tone = expired
    ? "bg-muted text-muted-foreground"
    : urgent
      ? "bg-destructive/15 text-destructive animate-pulse"
      : "bg-accent text-primary";

  return (
    <span
      role="timer"
      aria-live="polite"
      aria-label={`Tempo restante: ${label}`}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium tabular-nums ${tone} ${className ?? ""}`}
    >
      <Clock className="h-3 w-3" strokeWidth={2.5} />
      {label}
    </span>
  );
}

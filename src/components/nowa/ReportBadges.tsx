import { Award, ThumbsDown } from "lucide-react";

/**
 * Shows reputation badges based on report counts:
 * - valid_reports_count >= 1 → Community contributor badge
 * - invalid_reports_count >= 1 → "fakenewsever" badge
 */
export function ReportBadges({
  validCount,
  invalidCount,
}: {
  validCount: number;
  invalidCount: number;
}) {
  if (validCount === 0 && invalidCount === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {validCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
          <Award className="h-3.5 w-3.5" strokeWidth={2.5} />
          Contribuinte da comunidade
          {validCount > 1 && (
            <span className="ml-0.5 rounded-full bg-emerald-500/25 px-1.5 text-[10px] tabular-nums">
              ×{validCount}
            </span>
          )}
        </span>
      )}
      {invalidCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-400">
          <ThumbsDown className="h-3.5 w-3.5" strokeWidth={2.5} />
          fakenewsever
          {invalidCount > 1 && (
            <span className="ml-0.5 rounded-full bg-red-500/25 px-1.5 text-[10px] tabular-nums">
              ×{invalidCount}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

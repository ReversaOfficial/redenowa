import { Check } from "lucide-react";
import { normalizeHex, readableTextOn } from "@/lib/color";

export const PRESET_BGS = [
  "#0F0F12",
  "#1B1F2A",
  "#2A1B3D",
  "#0E2A1F",
  "#3D1B1B",
  "#F4F1EA",
  "#FFE9E3",
  "#E3F0FF",
];

export const PRESET_RINGS = [
  "#FF2E63",
  "#FFB100",
  "#19C37D",
  "#3B82F6",
  "#A855F7",
  "#FF7849",
  "#000000",
  "#FFFFFF",
];

export function ColorPicker({
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

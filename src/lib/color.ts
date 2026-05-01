// Pequenos helpers de cor usados em previews e telas que aceitam temas custom.
export function normalizeHex(c: string): string {
  if (!c) return "#000000";
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

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Retorna preto ou branco para garantir contraste sobre o fundo informado. */
export function readableTextOn(bg: string): string {
  const { r, g, b } = hexToRgb(bg);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0F0F12" : "#FFFFFF";
}

export function withAlpha(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

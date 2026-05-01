// Compressão/redimensionamento de imagens 100% client-side (canvas).
// Útil para reduzir avatares e mídia antes de enviar ao storage.

export type CompressOptions = {
  /** Largura/altura máxima (px). Mantém aspecto. */
  maxSize?: number;
  /** Qualidade JPEG/WebP (0-1). */
  quality?: number;
  /** Tipo MIME de saída. */
  mimeType?: "image/jpeg" | "image/webp" | "image/png";
  /** Se true, faz crop quadrado central antes de redimensionar. */
  square?: boolean;
};

export type CompressResult = {
  blob: Blob;
  width: number;
  height: number;
  /** Tamanho final em bytes */
  size: number;
  /** Tamanho original em bytes */
  originalSize: number;
  /** % do tamanho original (0-1). 0.4 = ficou com 40% do original. */
  ratio: number;
};

/** Lê um Blob como HTMLImageElement (com fallback para createImageBitmap). */
async function loadImage(blob: Blob): Promise<{
  width: number;
  height: number;
  draw: (
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ) => void;
  close?: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(blob);
      return {
        width: bmp.width,
        height: bmp.height,
        draw: (ctx, sx, sy, sw, sh, dx, dy, dw, dh) =>
          ctx.drawImage(bmp, sx, sy, sw, sh, dx, dy, dw, dh),
        close: () => bmp.close?.(),
      };
    } catch {
      // segue para fallback
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Falha ao decodificar imagem"));
      i.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, sx, sy, sw, sh, dx, dy, dw, dh) =>
        ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh),
    };
  } finally {
    // libera depois que o canvas já desenhou
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))),
      type,
      quality,
    );
  });
}

/**
 * Compressão genérica com redimensionamento. Mantém aspecto.
 * Se `square: true`, recorta o quadrado central.
 */
export async function compressImage(
  input: Blob,
  options: CompressOptions = {},
): Promise<CompressResult> {
  const {
    maxSize = 1280,
    quality = 0.82,
    mimeType = "image/jpeg",
    square = false,
  } = options;

  const originalSize = input.size;
  const src = await loadImage(input);
  const sw = src.width;
  const sh = src.height;

  // Cálculo de origem (crop quadrado opcional)
  let cropX = 0;
  let cropY = 0;
  let cropW = sw;
  let cropH = sh;
  if (square) {
    const side = Math.min(sw, sh);
    cropX = Math.floor((sw - side) / 2);
    cropY = Math.floor((sh - side) / 2);
    cropW = side;
    cropH = side;
  }

  // Cálculo do destino (cabe em maxSize)
  let dw = cropW;
  let dh = cropH;
  if (Math.max(cropW, cropH) > maxSize) {
    const scale = maxSize / Math.max(cropW, cropH);
    dw = Math.round(cropW * scale);
    dh = Math.round(cropH * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");
  // qualidade do downscale
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  src.draw(ctx, cropX, cropY, cropW, cropH, 0, 0, dw, dh);
  src.close?.();

  const blob = await canvasToBlob(canvas, mimeType, quality);

  return {
    blob,
    width: dw,
    height: dh,
    size: blob.size,
    originalSize,
    ratio: originalSize > 0 ? blob.size / originalSize : 1,
  };
}

/** Avatares: 512x512 quadrado, JPEG 0.85 (~30-80KB). */
export function compressAvatar(input: Blob): Promise<CompressResult> {
  return compressImage(input, {
    maxSize: 512,
    quality: 0.85,
    mimeType: "image/jpeg",
    square: true,
  });
}

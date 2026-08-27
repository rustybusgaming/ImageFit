import type { ExportSettings, ImageEffect, ImageTransform, OutputFormat } from "./imageProcessor";

export type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
export type AnyContext2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export interface CanvasBackend {
  create(width: number, height: number): { canvas: AnyCanvas; ctx: AnyContext2D };
  toBlob(canvas: AnyCanvas, type: string, quality?: number): Promise<Blob>;
}

export interface PresetSize {
  width: number;
  height: number;
}

export const MIME_TYPES: Record<OutputFormat, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function getCanvasFilter(effect: ImageEffect): string {
  switch (effect) {
    case "mono":
      return "grayscale(1) contrast(1.15)";
    case "warm":
      return "sepia(0.45) saturate(1.25) contrast(1.05)";
    case "pop":
      return "saturate(1.6) contrast(1.15)";
    default:
      return "none";
  }
}

function drawBackground(
  ctx: AnyContext2D,
  canvas: PresetSize,
  image: ImageBitmap,
  settings: ExportSettings
): void {
  if (settings.background === "transparent") {
    return;
  }
  if (settings.background === "solid" || settings.background === "cover") {
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  if (settings.background === "gradient") {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, settings.backgroundColor);
    gradient.addColorStop(1, "#171d35");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  ctx.save();
  ctx.filter = "blur(28px) brightness(0.72)";
  const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  ctx.restore();
}

export interface ResizeOptions {
  source: ImageBitmap;
  foreground: ImageBitmap;
  canvasFilter: string;
  preset: PresetSize;
  transform?: ImageTransform;
  settings: ExportSettings;
}

export async function renderResize(backend: CanvasBackend, options: ResizeOptions): Promise<Blob> {
  const { source, foreground, canvasFilter, preset, transform, settings } = options;
  const { canvas, ctx } = backend.create(preset.width, preset.height);

  // FIX: Force integers to prevent subpixel edge bleeding/cutoffs
  const rawCrop = transform?.crop ?? { x: 0, y: 0, width: foreground.width, height: foreground.height };
  const crop = {
    x: Math.max(0, Math.round(rawCrop.x)),
    y: Math.max(0, Math.round(rawCrop.y)),
    width: Math.round(rawCrop.width),
    height: Math.round(rawCrop.height),
  };

  const isContain = settings.background !== "cover";
  const scale = isContain
    ? Math.min(preset.width / crop.width, preset.height / crop.height)
    : Math.max(preset.width / crop.width, preset.height / crop.height);

  const width = crop.width * scale;
  const height = crop.height * scale;
  const x = (preset.width - width) / 2;
  const y = (preset.height - height) / 2;

  drawBackground(ctx, preset, source, settings);
  ctx.filter = canvasFilter;

  if (transform?.rotation) {
    const radians = (transform.rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));

    const rotated = backend.create(
      Math.ceil(foreground.width * cos + foreground.height * sin),
      Math.ceil(foreground.width * sin + foreground.height * cos)
    );

    rotated.ctx.translate(rotated.canvas.width / 2, rotated.canvas.height / 2);
    rotated.ctx.rotate(radians);
    rotated.ctx.drawImage(foreground, -foreground.width / 2, -foreground.height / 2);

    ctx.drawImage(rotated.canvas, crop.x, crop.y, crop.width, crop.height, x, y, width, height);
  } else {
    ctx.drawImage(foreground, crop.x, crop.y, crop.width, crop.height, x, y, width, height);
  }

  return backend.toBlob(
    canvas,
    MIME_TYPES[settings.format],
    settings.format === "png" ? undefined : settings.quality
  );
}

export interface CompressOptions {
  foreground: ImageBitmap;
  canvasFilter: string;
  scale: number;
  quality: number;
  format: Exclude<OutputFormat, "png">;
}

export async function renderCompress(backend: CanvasBackend, options: CompressOptions): Promise<Blob> {
  const { foreground, canvasFilter, scale, quality, format } = options;
  const { canvas, ctx } = backend.create(
    Math.max(1, Math.round(foreground.width * scale)),
    Math.max(1, Math.round(foreground.height * scale))
  );

  ctx.filter = canvasFilter;
  ctx.drawImage(foreground, 0, 0, canvas.width, canvas.height);

  return backend.toBlob(canvas, MIME_TYPES[format], quality);
}

export const offscreenBackend: CanvasBackend = {
  create(width, height) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not available");
    return { canvas, ctx };
  },
  toBlob(canvas, type, quality) {
    return (canvas as OffscreenCanvas).convertToBlob({ type, quality });
  },
};
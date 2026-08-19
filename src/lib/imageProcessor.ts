import type { PlatformPreset } from "../data/platforms";
import { applyEffectOnGPU } from "./webglEffects";
import { getCanvasFilter, renderCompress, renderResize } from "./imageRenderCore";
import type { AnyCanvas, CanvasBackend } from "./imageRenderCore";
import { runRenderJob } from "./renderPool";

export interface ImageTransform {
  crop: { x: number; y: number; width: number; height: number };
  rotation: number;
}

export type OutputFormat = "jpg" | "png" | "webp";
export type BackgroundMode = "cover" | "blur" | "solid" | "gradient" | "transparent";
export type ImageEffect = "none" | "mono" | "warm" | "pop";

export interface ExportSettings {
  format: OutputFormat;
  quality: number;
  background: BackgroundMode;
  backgroundColor: string;
  effect: ImageEffect;
}

export interface CompressionSettings {
  format: Exclude<OutputFormat, "png">;
  quality: number;
  scale: number;
  effect: ImageEffect;
}

export interface TargetCompressionSettings extends CompressionSettings {
  maxBytes: number;
}

const domBackend: CanvasBackend = {
  create(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not available");
    return { canvas, ctx };
  },
  toBlob(canvas: AnyCanvas, type, quality) {
    return new Promise((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error(`Failed to create ${type} blob`))),
        type,
        quality
      );
    });
  },
};

/**
 * Object URLs are re-read once per export batch, so the fetched Blob is held for the active
 * source. The Blob is only a handle to the already-loaded bytes; the decode is what costs.
 */
let sourceCache: { key: string; blob: Promise<Blob> } | null = null;

function getSourceBlob(imageSrc: string): Promise<Blob> {
  if (sourceCache?.key === imageSrc) return sourceCache.blob;

  const blob = fetch(imageSrc).then((response) => {
    if (!response.ok) throw new Error("Failed to load image");
    return response.blob();
  });

  sourceCache = { key: imageSrc, blob };
  return blob;
}

/** Main-thread fallback for browsers without Worker + OffscreenCanvas support. */
async function decodeOnMainThread(imageSrc: string): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(await getSourceBlob(imageSrc));
  } catch (error) {
    throw new Error("Failed to load image", { cause: error });
  }
}

export async function resizeImage(
  imageSrc: string,
  preset: PlatformPreset,
  transform?: ImageTransform,
  settings: ExportSettings = {
    format: preset.format,
    quality: 0.92,
    background: "cover",
    backgroundColor: "#101828",
    effect: "none",
  }
): Promise<Blob> {
  const job = {
    kind: "resize",
    preset: { width: preset.width, height: preset.height },
    transform,
    settings,
  } as const;

  const queued = runRenderJob(imageSrc, await getSourceBlob(imageSrc), job);
  if (queued) return queued;

  const source = await decodeOnMainThread(imageSrc);
  const treated = await applyEffectOnGPU(source, settings.effect);

  try {
    return await renderResize(domBackend, {
      source,
      foreground: treated ?? source,
      canvasFilter: treated ? "none" : getCanvasFilter(settings.effect),
      preset,
      transform,
      settings,
    });
  } finally {
    treated?.close();
    source.close();
  }
}

export async function compressImage(imageSrc: string, settings: CompressionSettings): Promise<Blob> {
  const job = { kind: "compress", scale: settings.scale, settings } as const;

  const queued = runRenderJob(imageSrc, await getSourceBlob(imageSrc), job);
  if (queued) return queued;

  const source = await decodeOnMainThread(imageSrc);
  const treated = await applyEffectOnGPU(source, settings.effect);

  try {
    return await renderCompress(domBackend, {
      foreground: treated ?? source,
      canvasFilter: treated ? "none" : getCanvasFilter(settings.effect),
      scale: settings.scale,
      quality: settings.quality,
      format: settings.format,
    });
  } finally {
    treated?.close();
    source.close();
  }
}

const MIN_TARGET_QUALITY = 0.42;
const MIN_TARGET_SCALE = 0.2;

export async function compressImageToTarget(imageSrc: string, settings: TargetCompressionSettings): Promise<Blob> {
  let quality = settings.quality;
  let scale = settings.scale;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await compressImage(imageSrc, { ...settings, quality, scale });

    if (result.size <= settings.maxBytes) {
      return result;
    }

    if (quality > MIN_TARGET_QUALITY) {
      quality = Math.max(MIN_TARGET_QUALITY, quality - 0.1);
    } else if (scale > MIN_TARGET_SCALE) {
      scale = Math.max(MIN_TARGET_SCALE, scale * 0.82);
    } else {
      // Both dials are already at their floor, so further attempts would repeat this one.
      break;
    }
  }

  throw new Error("This image could not be reduced to the selected file-size limit.");
}

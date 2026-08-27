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
  forcePOT?: boolean;
  stripMetadata?: boolean;
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
    format: preset.format || "jpg",
    quality: 0.92,
    background: "cover",
    backgroundColor: "#101828",
    effect: "none",
  }
): Promise<Blob> {
  
  // Power of Two (POT) Calculation
  let targetWidth = preset.width;
  let targetHeight = preset.height;
  
  if (settings.forcePOT) {
    targetWidth = Math.pow(2, Math.ceil(Math.log2(targetWidth)));
    targetHeight = Math.pow(2, Math.ceil(Math.log2(targetHeight)));
  }

  // Create a modified preset so all downstream renderers use the POT dimensions
  const activePreset = {
    ...preset,
    width: targetWidth,
    height: targetHeight,
  };

  const job = {
    kind: "resize",
    preset: { width: activePreset.width, height: activePreset.height },
    transform,
    settings,
  } as const;

  const queued = runRenderJob(imageSrc, await getSourceBlob(imageSrc), job);
  if (queued) return queued;

  const source = await decodeOnMainThread(imageSrc);
  const treated = await applyEffectOnGPU(source, settings.effect);

  // Note: EXIF/Metadata is naturally stripped here when drawing the ImageBitmap to the Canvas Backend
  try {
    return await renderResize(domBackend, {
      source,
      foreground: treated ?? source,
      canvasFilter: treated ? "none" : getCanvasFilter(settings.effect),
      preset: activePreset,
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
const MAX_TARGET_ATTEMPTS = 8;
const QUALITY_PRECISION = 0.04;

export async function compressImageToTarget(imageSrc: string, settings: TargetCompressionSettings): Promise<Blob> {
  let scale = settings.scale;
  let attempts = 0;

  const encode = async (quality: number) => {
    attempts += 1;
    return compressImage(imageSrc, { ...settings, quality, scale });
  };

  while (attempts < MAX_TARGET_ATTEMPTS) {
    const requested = await encode(settings.quality);
    if (requested.size <= settings.maxBytes) return requested;

    const floor = await encode(MIN_TARGET_QUALITY);
    if (floor.size <= settings.maxBytes) {
      let low = MIN_TARGET_QUALITY;
      let high = settings.quality;
      let best = floor;

      while (attempts < MAX_TARGET_ATTEMPTS && high - low > QUALITY_PRECISION) {
        const mid = (low + high) / 2;
        const candidate = await encode(mid);

        if (candidate.size <= settings.maxBytes) {
          best = candidate;
          low = mid;
        } else {
          high = mid;
        }
      }

      return best;
    }

    if (scale <= MIN_TARGET_SCALE) break;
    scale = Math.max(MIN_TARGET_SCALE, scale * 0.7);
  }

  throw new Error("This image could not be reduced to the selected file-size limit.");
}
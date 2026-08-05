import type { PlatformPreset } from "../data/platforms";

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

const MIME_TYPES: Record<OutputFormat, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function drawBackground(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
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

function getCanvasFilter(effect: ImageEffect): string {
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
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = preset.width;
        canvas.height = preset.height;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Canvas 2D context not available"));
          return;
        }

        const source = transform?.crop ?? {
          x: 0,
          y: 0,
          width: img.width,
          height: img.height,
        };
        const isContain = settings.background !== "cover";
        const scale = isContain
          ? Math.min(preset.width / source.width, preset.height / source.height)
          : Math.max(preset.width / source.width, preset.height / source.height);

        const width = source.width * scale;
        const height = source.height * scale;
        const x = (preset.width - width) / 2;
        const y = (preset.height - height) / 2;

        drawBackground(ctx, canvas, img, settings);
        ctx.filter = getCanvasFilter(settings.effect);

        if (transform?.rotation) {
          const rotationCanvas = document.createElement("canvas");
          const rotationContext = rotationCanvas.getContext("2d");

          if (!rotationContext) {
            reject(new Error("Canvas 2D context not available"));
            return;
          }

          const radians = (transform.rotation * Math.PI) / 180;
          const sin = Math.abs(Math.sin(radians));
          const cos = Math.abs(Math.cos(radians));
          rotationCanvas.width = Math.ceil(img.width * cos + img.height * sin);
          rotationCanvas.height = Math.ceil(img.width * sin + img.height * cos);
          rotationContext.translate(rotationCanvas.width / 2, rotationCanvas.height / 2);
          rotationContext.rotate(radians);
          rotationContext.drawImage(img, -img.width / 2, -img.height / 2);
          ctx.drawImage(rotationCanvas, source.x, source.y, source.width, source.height, x, y, width, height);
        } else {
          ctx.drawImage(img, source.x, source.y, source.width, source.height, x, y, width, height);
        }

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error(              `Failed to create ${settings.format} blob`));
            }
          },
          MIME_TYPES[settings.format],
          settings.format === "png" ? undefined : settings.quality
        );
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Unknown error during image processing"));
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = imageSrc;
  });
}

export async function compressImage(imageSrc: string, settings: CompressionSettings): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * settings.scale));
      canvas.height = Math.max(1, Math.round(image.height * settings.scale));
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas 2D context not available"));
        return;
      }

      ctx.filter = getCanvasFilter(settings.effect);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error(`Failed to compress image as ${settings.format}`));
          }
        },
        MIME_TYPES[settings.format],
        settings.quality
      );
    };

    image.onerror = () => reject(new Error("Failed to load image for compression"));
    image.src = imageSrc;
  });
}

export async function compressImageToTarget(imageSrc: string, settings: TargetCompressionSettings): Promise<Blob> {
  let quality = settings.quality;
  let scale = settings.scale;
  let smallestResult: Blob | null = null;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await compressImage(imageSrc, { ...settings, quality, scale });

    if (!smallestResult || result.size < smallestResult.size) {
      smallestResult = result;
    }

    if (result.size <= settings.maxBytes) {
      return result;
    }

    if (quality > 0.42) {
      quality = Math.max(0.42, quality - 0.1);
    } else {
      scale = Math.max(0.2, scale * 0.82);
    }
  }

  if (smallestResult && smallestResult.size <= settings.maxBytes) {
    return smallestResult;
  }

  throw new Error("This image could not be reduced to the selected file-size limit.");
}
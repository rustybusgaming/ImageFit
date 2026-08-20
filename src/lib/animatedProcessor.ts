/**
 * Animated-image compression.
 *
 * The canvas pipeline flattens animation to a single frame, so animated sources are routed
 * through FFmpeg instead. Output is always animated WebP: for the same visual result it is
 * several times smaller than re-encoding to GIF, and far smaller than APNG.
 *
 * Only GIF and APNG can be read back frame by frame. FFmpeg writes animated WebP but its
 * decoder yields only the first frame, so animated WebP input is never re-encoded here.
 */

import { getFFmpeg } from "./videoProcessor";
import type { ImageEffect } from "./imageProcessor";

export interface AnimatedCompressionSettings {
  quality: number;
  scale: number;
  effect: ImageEffect;
  maxBytes?: number;
}

/**
 * Successive reductions applied while a size target is missed. Frame rate is given up before
 * resolution, because dropping frames is less noticeable than a soft, undersized image.
 */
const FALLBACK_STEPS: Array<{ scale: number; fps: number | null }> = [
  { scale: 1, fps: null },
  { scale: 1, fps: 15 },
  { scale: 0.75, fps: 15 },
  { scale: 0.6, fps: 12 },
  { scale: 0.45, fps: 10 },
  { scale: 0.3, fps: 8 },
];

const EFFECT_FILTERS: Record<ImageEffect, string> = {
  none: "",
  mono: "colorchannelmixer=.2126:.7152:.0722:0:.2126:.7152:.0722:0:.2126:.7152:.0722,eq=contrast=1.15",
  warm: "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,eq=saturation=1.25:contrast=1.05",
  pop: "eq=saturation=1.6:contrast=1.15",
};

function buildFilter(scale: number, fps: number | null, effect: ImageEffect): string {
  const stages: string[] = [];
  if (fps !== null) stages.push(`fps=${fps}`);
  if (scale !== 1) {
    // -2 keeps the dimension even, which several encoders require.
    stages.push(`scale=trunc(iw*${scale}/2)*2:-2:flags=lanczos`);
  }
  const effectFilter = EFFECT_FILTERS[effect];
  if (effectFilter) stages.push(effectFilter);

  return stages.join(",");
}

/**
 * Re-encodes an animated image, preserving its animation. When `maxBytes` is set, quality and
 * then frame rate and resolution are stepped down until the result fits.
 */
export async function compressAnimatedImage(
  file: File,
  settings: AnimatedCompressionSettings
): Promise<{ blob: Blob; extension: string }> {
  const encoder = await getFFmpeg();
  const stamp = Date.now();
  const inputName = `animated-${stamp}.${file.name.split(".").pop() ?? "gif"}`;
  const outputName = `animated-${stamp}.webp`;
  // libwebp takes 0-100 where higher is better, while the app's presets use 0-1.
  const quality = Math.round(Math.min(1, Math.max(0.05, settings.quality)) * 100);

  await encoder.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));

  try {
    let best: Blob | null = null;

    for (const step of FALLBACK_STEPS) {
      const filter = buildFilter(step.scale * settings.scale, step.fps, settings.effect);
      const exitCode = await encoder.exec([
        "-i", inputName,
        ...(filter ? ["-vf", filter] : []),
        "-c:v", "libwebp_anim",
        "-loop", "0",
        "-q:v", `${quality}`,
        "-preset", "picture",
        outputName,
      ]);

      if (exitCode !== 0) {
        throw new Error("Could not re-encode this animation. Try a different file.");
      }

      const output = await encoder.readFile(outputName);
      if (typeof output === "string") throw new Error("The encoder returned an invalid animation.");

      const bytes = new Uint8Array(output.byteLength);
      bytes.set(output);
      const blob = new Blob([bytes.buffer], { type: "image/webp" });

      if (!best || blob.size < best.size) best = blob;
      if (settings.maxBytes === undefined || blob.size <= settings.maxBytes) {
        return { blob, extension: "webp" };
      }
    }

    if (best && settings.maxBytes !== undefined && best.size > settings.maxBytes) {
      throw new Error("This animation could not be reduced to the selected file-size limit.");
    }

    return { blob: best!, extension: "webp" };
  } finally {
    await encoder.deleteFile(inputName).catch(() => undefined);
    await encoder.deleteFile(outputName).catch(() => undefined);
  }
}

/**
 * Converts a format browsers cannot decode (TIFF, PSD, QOI, Targa, JPEG 2000, DDS…) into a
 * PNG, so the ordinary canvas pipeline can take it from there.
 */
export async function convertToBrowserImage(file: File): Promise<Blob> {
  const encoder = await getFFmpeg();
  const stamp = Date.now();
  const inputName = `convert-${stamp}.${file.name.split(".").pop() ?? "bin"}`;
  const outputName = `convert-${stamp}.png`;

  await encoder.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));

  try {
    const exitCode = await encoder.exec(["-i", inputName, "-frames:v", "1", outputName]);
    if (exitCode !== 0) throw new Error("ImageFit could not read this image format.");

    const output = await encoder.readFile(outputName);
    if (typeof output === "string") throw new Error("ImageFit could not read this image format.");

    const bytes = new Uint8Array(output.byteLength);
    bytes.set(output);
    return new Blob([bytes.buffer], { type: "image/png" });
  } finally {
    await encoder.deleteFile(inputName).catch(() => undefined);
    await encoder.deleteFile(outputName).catch(() => undefined);
  }
}

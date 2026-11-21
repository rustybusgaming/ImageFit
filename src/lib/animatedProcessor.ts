/**
 * Animated-image compression.
 *
 * The canvas pipeline flattens animation to a single frame and cannot write GIF at all, so
 * these sources are routed through FFmpeg instead.
 *
 * - GIF stays GIF, animated or not: people uploading a GIF expect a GIF back, and plenty of
 *   places that take GIF do not take animated WebP.
 * - APNG becomes animated WebP, which is far smaller than re-encoded APNG.
 *
 * Only GIF and APNG can be read back frame by frame. FFmpeg writes animated WebP but its
 * decoder yields only the first frame, so animated WebP input is never re-encoded here.
 */

import { MAX_GIF_ATTEMPTS, MIN_GIF_FRAME_RATE, getFFmpeg, planGifRetry } from "./videoProcessor";
import type { GifStep } from "./videoProcessor";
import type { ImageEffect } from "./imageProcessor";

export type AnimatedOutputFormat = "gif" | "webp";

export interface AnimatedCompressionSettings {
  quality: number;
  scale: number;
  effect: ImageEffect;
  maxBytes?: number;
  output: AnimatedOutputFormat;
  /** False for a single-frame GIF, so a size target is met by scaling rather than dropping frames. */
  isAnimated: boolean;
}

/**
 * WebP size fallbacks, applied while a size target is missed. Frame rate is given up before
 * resolution, because dropping frames is less noticeable than a soft, undersized image.
 */
const WEBP_FALLBACK_STEPS: Array<{ scale: number; fps: number | null }> = [
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

/**
 * GIF palette size per preset quality. Halving the palette was measured to cut a typical GIF by
 * roughly a quarter, which makes it the gentlest lever for the lossier presets.
 */
function getGifColours(quality: number): number {
  if (quality >= 0.8) return 256;
  if (quality >= 0.5) return 128;
  if (quality >= 0.25) return 64;
  return 32;
}

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
 * GIF palette stage. Dithering is off: on a source that is already paletted it only adds noise
 * (Bayer dropped SSIM from 0.99999 to 0.88 on an untouched re-encode), and on scaled frames it
 * still came out larger and no closer to the source than plain palette mapping.
 * `palettegen` reserves a transparent entry by default, so transparency survives.
 */
function buildGifFilter(base: string, colours: number): string {
  const palette = `split[palettesource][frames];[palettesource]palettegen=stats_mode=diff:max_colors=${colours}[palette];[frames][palette]paletteuse=dither=none:diff_mode=rectangle`;
  return base ? `${base},${palette}` : palette;
}

/** The source frame rate as FFmpeg reports it ("16.67 fps"), or null if it said nothing. */
function readFrameRate(logs: string[]): number | null {
  for (const line of logs) {
    const match = / (\d+(?:\.\d+)?) fps/.exec(line);
    if (match && /Video:/.test(line)) return Number(match[1]);
  }
  return null;
}

/**
 * Re-encodes an animated image (or any GIF), preserving its animation. When `maxBytes` is set,
 * frame rate and resolution are stepped down until the result fits.
 */
export async function compressAnimatedImage(
  file: File,
  settings: AnimatedCompressionSettings
): Promise<{ blob: Blob; extension: AnimatedOutputFormat }> {
  const encoder = await getFFmpeg();
  const stamp = Date.now();
  const inputName = `animated-${stamp}.${file.name.split(".").pop() ?? "gif"}`;
  // Distinct from the input name: GIF in and GIF out would otherwise be the same file.
  const outputName = `animated-${stamp}-out.${settings.output}`;
  const mimeType = settings.output === "gif" ? "image/gif" : "image/webp";
  const logs: string[] = [];
  const logHandler = ({ message }: { message: string }) => {
    if (logs.length < 200) logs.push(message);
  };

  await encoder.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
  encoder.on("log", logHandler);

  async function encode(args: string[]): Promise<Blob> {
    const exitCode = await encoder.exec(["-i", inputName, ...args, outputName]);
    if (exitCode !== 0) throw new Error("Could not re-encode this animation. Try a different file.");

    const output = await encoder.readFile(outputName);
    if (typeof output === "string") throw new Error("The encoder returned an invalid animation.");

    const bytes = new Uint8Array(output.byteLength);
    bytes.set(output);
    return new Blob([bytes.buffer], { type: mimeType });
  }

  try {
    if (settings.output === "gif") {
      return { blob: await encodeGif(file, settings, encode, logs), extension: "gif" };
    }

    // libwebp takes 0-100 where higher is better, while the app's presets use 0-1.
    const quality = Math.round(Math.min(1, Math.max(0.05, settings.quality)) * 100);
    let best: Blob | null = null;

    for (const step of WEBP_FALLBACK_STEPS) {
      const filter = buildFilter(step.scale * settings.scale, step.fps, settings.effect);
      const blob = await encode([
        ...(filter ? ["-vf", filter] : []),
        "-c:v", "libwebp_anim",
        "-loop", "0",
        "-q:v", `${quality}`,
        "-preset", "picture",
      ]);

      if (!best || blob.size < best.size) best = blob;
      if (settings.maxBytes === undefined || blob.size <= settings.maxBytes) {
        return { blob, extension: "webp" };
      }
    }

    throw new Error("This animation could not be reduced to the selected file-size limit.");
  } finally {
    encoder.off("log", logHandler);
    await encoder.deleteFile(inputName).catch(() => undefined);
    await encoder.deleteFile(outputName).catch(() => undefined);
  }
}

/**
 * GIF to GIF. A size target is met with `planGifRetry`, the same measured model the video-to-GIF
 * export uses, so each retry is computed from the size produced instead of stepped blindly.
 */
async function encodeGif(
  file: File,
  settings: AnimatedCompressionSettings,
  encode: (args: string[]) => Promise<Blob>,
  logs: string[]
): Promise<Blob> {
  const colours = getGifColours(settings.quality);
  // A preset that changes nothing visible may hand back the original when re-encoding could not
  // beat it — an already well-optimised GIF often comes out slightly larger.
  const isUntouched = settings.scale === 1 && settings.effect === "none" && colours === 256;
  let sourceFrameRate: number | null = null;
  let step: GifStep = { frameRate: Number.POSITIVE_INFINITY, scale: settings.scale };

  for (let attempt = 0; attempt < MAX_GIF_ATTEMPTS; attempt += 1) {
    // Frames are only resampled once a retry asks for fewer than the source has.
    const fps = sourceFrameRate !== null && step.frameRate < sourceFrameRate ? step.frameRate : null;
    const blob = await encode([
      "-vf", buildGifFilter(buildFilter(step.scale, fps, settings.effect), colours),
      "-loop", "0",
    ]);

    if (sourceFrameRate === null) {
      // A still GIF is pinned at the frame-rate floor so the planner takes everything from scale.
      sourceFrameRate = settings.isAnimated ? readFrameRate(logs) ?? 15 : MIN_GIF_FRAME_RATE;
      step = { frameRate: sourceFrameRate, scale: step.scale };
    }

    const result = isUntouched && attempt === 0 && blob.size >= file.size
      ? new Blob([file], { type: "image/gif" })
      : blob;

    if (settings.maxBytes === undefined || result.size <= settings.maxBytes) return result;

    const next = planGifRetry(step, result.size, settings.maxBytes);
    if (next === null) break;
    step = next;
  }

  throw new Error("This GIF could not be reduced to the selected file-size limit.");
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

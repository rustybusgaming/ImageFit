/**
 * Turns any accepted upload into something the rest of the app can render.
 *
 * The editor, the export preview and the platform exports all work from an object URL that a
 * browser has to be able to display, so formats it cannot decode are converted once here at
 * load time rather than separately in each consumer.
 */

import { readImageFormat } from "./imageFormats";
import type { ImageFormatInfo } from "./imageFormats";
import { convertToBrowserImage } from "./animatedProcessor";
import { decodeHeic } from "./heicDecoder";

export interface PreparedImage {
  /** The blob to display, converted where the original was not renderable. */
  blob: Blob;
  /** True when `blob` is a conversion rather than the original file. */
  converted: boolean;
  info: ImageFormatInfo;
}

/** Long edge an SVG is rasterised to, so platform-sized exports are not upscaled from a tiny raster. */
const SVG_MIN_LONG_EDGE = 2048;
const SVG_MAX_LONG_EDGE = 4096;

/**
 * `createImageBitmap` rejects SVG blobs ("The source image could not be decoded"), which is
 * what both the render workers and the main-thread fallback decode with. An `<img>` can draw
 * one, so it is rasterised once here, at a size large enough for any preset.
 */
async function rasterizeSvg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch (error) {
      throw new Error("ImageFit could not read this SVG.", { cause: error });
    }

    // An SVG with only a viewBox can report no intrinsic size; treat it as square.
    const naturalWidth = image.naturalWidth || SVG_MIN_LONG_EDGE;
    const naturalHeight = image.naturalHeight || SVG_MIN_LONG_EDGE;
    const longEdge = Math.max(naturalWidth, naturalHeight);
    const scale = Math.min(SVG_MAX_LONG_EDGE, Math.max(SVG_MIN_LONG_EDGE, longEdge)) / longEdge;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context not available");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("ImageFit could not read this SVG."))), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const info = await readImageFormat(file);

  if (info.kind === "svg") return { blob: await rasterizeSvg(file), converted: true, info };

  if (info.isBrowserDecodable) return { blob: file, converted: false, info };

  if (info.kind === "heic") {
    return { blob: await decodeHeic(file), converted: true, info };
  }

  if (info.isFFmpegDecodable) {
    return { blob: await convertToBrowserImage(file), converted: true, info };
  }

  throw new Error("ImageFit cannot read this image format.");
}

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

export async function prepareImage(file: File): Promise<PreparedImage> {
  const info = await readImageFormat(file);

  if (info.isBrowserDecodable) return { blob: file, converted: false, info };

  if (info.kind === "heic") {
    return { blob: await decodeHeic(file), converted: true, info };
  }

  if (info.isFFmpegDecodable) {
    return { blob: await convertToBrowserImage(file), converted: true, info };
  }

  throw new Error("ImageFit cannot read this image format.");
}

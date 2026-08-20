/**
 * Format sniffing for image uploads.
 *
 * Extensions and MIME types are unreliable here — `image/gif` says nothing about whether a
 * file is animated, and several formats ImageFit can now accept arrive as
 * `application/octet-stream` because browsers do not recognise them at all. Everything below
 * is decided from the file's own bytes.
 */

export type ImageKind =
  | "gif"
  | "png"
  | "apng"
  | "webp"
  | "animated-webp"
  | "jpeg"
  | "bmp"
  | "tiff"
  | "psd"
  | "qoi"
  | "jpeg2000"
  | "dds"
  | "targa"
  | "ico"
  | "avif"
  | "heic"
  | "svg"
  | "unknown";

export interface ImageFormatInfo {
  kind: ImageKind;
  /** True when the file carries more than one frame. */
  isAnimated: boolean;
  /**
   * True when a browser can decode it into a canvas. Anything else has to be converted by
   * FFmpeg before the canvas pipeline can touch it.
   */
  isBrowserDecodable: boolean;
  /**
   * True when FFmpeg can read every frame. Animated WebP is the notable exception: FFmpeg
   * writes it but its decoder only ever yields the first frame.
   */
  isFFmpegDecodable: boolean;
}

const HEADER_BYTES = 4096;

/**
 * Media classification cannot rely on `File.type`: the browser derives it from the operating
 * system's extension mapping, and the uncommon formats ImageFit accepts usually come through
 * as an empty string or `application/octet-stream`. The extension is the reliable signal.
 */
const IMAGE_EXTENSIONS = new Set([
  "png", "apng", "jpg", "jpeg", "jfif", "gif", "webp", "svg", "avif", "heic", "heif",
  "bmp", "ico", "tif", "tiff", "psd", "qoi", "tga", "targa", "dds", "jp2", "j2k", "jpf", "jpx",
]);

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "avi", "mkv", "ogv", "m2ts", "mts", "wmv", "flv"]);

export type MediaKind = "image" | "video" | "unsupported";

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function classifyMedia(file: File): MediaKind {
  const extension = getExtension(file.name);

  if (VIDEO_EXTENSIONS.has(extension)) return "video";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";

  // Fall back to the declared type for files with no useful extension.
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";

  return "unsupported";
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function indexOfAscii(bytes: Uint8Array, text: string, limit = bytes.length): boolean {
  const target = [...text].map((character) => character.charCodeAt(0));
  const end = Math.min(limit, bytes.length) - target.length;

  for (let index = 0; index <= end; index += 1) {
    if (target.every((value, offset) => bytes[index + offset] === value)) return true;
  }

  return false;
}

/** APNG is a PNG with an `acTL` control chunk ahead of the first `IDAT`. */
function isAnimatedPng(bytes: Uint8Array): boolean {
  for (let index = 8; index + 8 <= bytes.length; ) {
    const length = (bytes[index] << 24) | (bytes[index + 1] << 16) | (bytes[index + 2] << 8) | bytes[index + 3];
    const type = String.fromCharCode(bytes[index + 4], bytes[index + 5], bytes[index + 6], bytes[index + 7]);

    if (type === "acTL") return true;
    if (type === "IDAT") return false;
    if (length < 0) return false;

    index += 12 + length;
  }

  return false;
}

/**
 * A static GIF carries at most one Graphic Control Extension; an animated one carries a
 * block per frame. Counting two is enough to answer the question without a full parse.
 */
function isAnimatedGif(bytes: Uint8Array): boolean {
  let found = 0;

  for (let index = 0; index + 2 < bytes.length; index += 1) {
    if (bytes[index] === 0x21 && bytes[index + 1] === 0xf9 && bytes[index + 2] === 0x04) {
      found += 1;
      if (found > 1) return true;
    }
  }

  return false;
}

function readKind(bytes: Uint8Array): ImageKind {
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "gif";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return isAnimatedPng(bytes) ? "apng" : "png";
  }
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return indexOfAscii(bytes, "ANIM", 512) ? "animated-webp" : "webp";
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x42, 0x4d])) return "bmp";
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) return "tiff";
  if (startsWith(bytes, [0x38, 0x42, 0x50, 0x53])) return "psd";
  if (startsWith(bytes, [0x71, 0x6f, 0x69, 0x66])) return "qoi";
  if (startsWith(bytes, [0x44, 0x44, 0x53, 0x20])) return "dds";
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) return "ico";
  if (startsWith(bytes, [0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20]) || startsWith(bytes, [0xff, 0x4f, 0xff, 0x51])) {
    return "jpeg2000";
  }
  // ISO base media: the brand sits just after the `ftyp` box header.
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    if (indexOfAscii(bytes, "avif", 32) || indexOfAscii(bytes, "avis", 32)) return "avif";
    if (indexOfAscii(bytes, "heic", 32) || indexOfAscii(bytes, "heix", 32) || indexOfAscii(bytes, "mif1", 32)) return "heic";
  }
  if (indexOfAscii(bytes, "<svg", 1024)) return "svg";

  return "unknown";
}

// Formats every current browser can put on a canvas. Anything omitted needs converting first.
const BROWSER_DECODABLE = new Set<ImageKind>(["gif", "png", "apng", "webp", "animated-webp", "jpeg", "bmp", "ico", "svg", "avif"]);

// FFmpeg reads all of these. Animated WebP is deliberately absent: the decoder returns only
// the first frame, so re-encoding one would silently discard the animation.
const FFMPEG_DECODABLE = new Set<ImageKind>([
  "gif", "png", "apng", "webp", "jpeg", "bmp", "tiff", "psd", "qoi", "jpeg2000", "dds", "targa", "ico",
]);

export async function readImageFormat(file: File): Promise<ImageFormatInfo> {
  const bytes = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  let kind = readKind(bytes);

  // Targa has no signature worth trusting, so it is the one format identified by extension.
  if (kind === "unknown" && /\.(tga|targa|icb|vda|vst)$/i.test(file.name)) kind = "targa";

  const isAnimated =
    kind === "apng" ||
    kind === "animated-webp" ||
    (kind === "gif" && isAnimatedGif(new Uint8Array(await file.slice(0, 1024 * 512).arrayBuffer())));

  return {
    kind,
    isAnimated,
    isBrowserDecodable: BROWSER_DECODABLE.has(kind),
    isFFmpegDecodable: FFMPEG_DECODABLE.has(kind),
  };
}

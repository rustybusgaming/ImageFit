import { inspectVideo } from "./videoProcessor";
import type { VideoExportSettings, VideoResolution } from "./videoProcessor";

const VIDEO_HEIGHTS: Record<VideoResolution, number> = {
  "1080p": 1080,
  "720p": 720,
  "480p": 480,
};

/**
 * Files opened through the native dialog or a file association arrive as bytes and are rebuilt
 * into `File` objects in the renderer. Those are not backed by disk, so `getPathForFile` returns
 * an empty string for them; their original path is remembered here instead.
 */
const openedFilePaths = new WeakMap<File, string>();

export function rememberDesktopFilePath(file: File, path: string): void {
  if (path) openedFilePaths.set(file, path);
}

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && Boolean(window.imageFitDesktop);
}

export async function getAvailableVideoEncoders(): Promise<string[]> {
  return window.imageFitDesktop?.availableVideoEncoders() ?? [];
}

export function cancelDesktopVideoEncoding(): void {
  void window.imageFitDesktop?.cancelVideoEncode().catch(() => undefined);
}

export async function compressDesktopVideoToTarget(
  file: File,
  settings: VideoExportSettings,
  presetId: string,
  onProgress: (progress: number) => void
): Promise<{ outputPath: string; size: number }> {
  const desktop = window.imageFitDesktop;
  if (!desktop) throw new Error("Native video encoding is only available in ImageFit Desktop.");

  const inputPath = desktop.getFilePath(file) || openedFilePaths.get(file);
  if (!inputPath) throw new Error("ImageFit Desktop could not access the selected video file.");

  const metadata = await inspectVideo(file);
  return desktop.encodeVideo({
    inputPath,
    presetId,
    maxBytes: settings.maxBytes,
    duration: metadata.duration,
    height: VIDEO_HEIGHTS[settings.resolution],
    audio: settings.audio,
    frameRate: settings.frameRate,
    format: settings.format,
    codec: settings.codec,
    encoder: settings.encoder,
  }, onProgress);
}
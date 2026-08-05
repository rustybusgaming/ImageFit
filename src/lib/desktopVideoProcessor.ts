import { inspectVideo } from "./videoProcessor";
import type { VideoExportSettings, VideoResolution } from "./videoProcessor";

const VIDEO_HEIGHTS: Record<VideoResolution, number> = {
  "1080p": 1080,
  "720p": 720,
  "480p": 480,
};

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && Boolean(window.imageFitDesktop);
}

export async function getNvencSupport(): Promise<boolean> {
  return window.imageFitDesktop?.nvencSupported() ?? false;
}

export async function compressDesktopVideoToTarget(
  file: File,
  settings: VideoExportSettings,
  presetId: string,
  useNvenc: boolean,
  onProgress: (progress: number) => void
): Promise<{ outputPath: string; size: number }> {
  const desktop = window.imageFitDesktop;
  if (!desktop) throw new Error("Native video encoding is only available in ImageFit Desktop.");

  const inputPath = desktop.getFilePath(file);
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
    useNvenc,
  }, onProgress);
}
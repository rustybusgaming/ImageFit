/**
 * A file opened through the native dialog or a file association. Images arrive as bytes;
 * videos are streamed from disk through `url` and never cross IPC; `error` reports a file that
 * could not be opened at all.
 */
type DesktopOpenedFile =
  | { name: string; path: string; bytes: Uint8Array }
  | { name: string; path: string; url: string }
  | { name: string; path: string; error: string };

interface Window {
  imageFitDesktop?: {
    getOutputDirectory(): Promise<string>;
    chooseOutputDirectory(): Promise<string>;
    saveFile(filename: string, bytes: Uint8Array): Promise<string | null>;
    openMediaDialog(): Promise<DesktopOpenedFile[]>;
    readMediaFiles(paths: string[]): Promise<DesktopOpenedFile[]>;
    onOpenPaths(callback: (paths: string[]) => void): () => void;
    onUpdateStatus(callback: (status: { state: "checking" | "downloading" | "ready" | "available" | "unavailable"; version?: string }) => void): () => void;
    installUpdate(): Promise<boolean>;
    checkForUpdates(): Promise<boolean>;
    openReleasePage(): Promise<boolean>;
    getFilePath(file: File): string;
    availableVideoEncoders(): Promise<string[]>;
    encodeVideo(
      payload: {
        inputPath: string;
        presetId: string;
        maxBytes: number;
        duration: number;
        height: number;
        audio: "keep" | "reduced" | "mute";
        frameRate: 30 | 24 | 15;
        format: "mp4" | "webm" | "mov" | "avi" | "ogv" | "gif";
        codec: "h264" | "h265" | "av1" | "vp8" | "vp9" | "mpeg4" | "prores" | "dnxhd" | "mjpeg" | "theora";
        encoder: "software" | "nvenc" | "qsv" | "amf" | "videotoolbox" | "vaapi" | "mf";
      },
      onProgress: (progress: number) => void
    ): Promise<{ outputPath: string; size: number }>;
    cancelVideoEncode(): Promise<boolean>;
  };
}